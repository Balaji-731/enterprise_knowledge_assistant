"""Multi-format document parsers and version detection for the Ingestion Pipeline.

Supports:
- PDF (.pdf) via PyMuPDF (fitz) with exact page tracking.
- Word documents (.docx) via python-docx in exact sequential document order.
- Text & Markdown (.txt, .md).
- Cryptographic SHA-256 checksumming for deduplication.
- Heuristic and regex-based version and title detection.
"""

import hashlib
import re
from pathlib import Path
from typing import Tuple

import docx
import pymupdf

from src.ingestion.schemas import RawExtractedPage, VersionDetectionResult


def calculate_file_hash(file_path: Path | str) -> str:
    """Calculate the SHA-256 cryptographic checksum of a file."""
    path = Path(file_path)
    if not path.is_file():
        raise FileNotFoundError(f"File not found: {path}")

    sha256 = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            sha256.update(chunk)
    return sha256.hexdigest()


def parse_pdf(file_path: Path | str) -> list[RawExtractedPage]:
    """Extract page-by-page text from a PDF preserving 1-indexed page numbers."""
    path = Path(file_path)
    pages: list[RawExtractedPage] = []
    doc = pymupdf.open(path)
    try:
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            text = page.get_text("text").strip()
            pages.append(
                RawExtractedPage(
                    page_number=page_idx + 1,
                    text=text,
                    char_count=len(text),
                )
            )
    finally:
        doc.close()
    return pages or [RawExtractedPage(page_number=1, text="", char_count=0)]


def parse_docx(file_path: Path | str) -> list[RawExtractedPage]:
    """Extract text from a Word document (.docx).

    Extracts paragraphs and tables in exact sequential document flow order.
    Groups lines into logical synthetic pages (~500 words per page).
    """
    path = Path(file_path)
    doc = docx.Document(path)
    lines: list[str] = []

    for child in doc.element.body:
        if child.tag.endswith("p"):
            para = docx.text.paragraph.Paragraph(child, doc)
            cleaned = para.text.strip()
            if cleaned:
                lines.append(cleaned)
        elif child.tag.endswith("tbl"):
            table = docx.table.Table(child, doc)
            for row in table.rows:
                row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if row_text:
                    lines.append(row_text)

    # Chunk lines into synthetic pages of roughly 500 words
    pages: list[RawExtractedPage] = []
    current_page_lines: list[str] = []
    current_word_count = 0
    page_num = 1

    for line in lines:
        current_page_lines.append(line)
        current_word_count += len(line.split())
        if current_word_count >= 500:
            full_text = "\n".join(current_page_lines)
            pages.append(
                RawExtractedPage(
                    page_number=page_num,
                    text=full_text,
                    char_count=len(full_text),
                )
            )
            page_num += 1
            current_page_lines = []
            current_word_count = 0

    if current_page_lines:
        full_text = "\n".join(current_page_lines)
        pages.append(
            RawExtractedPage(
                page_number=page_num,
                text=full_text,
                char_count=len(full_text),
            )
        )

    return pages or [RawExtractedPage(page_number=1, text="", char_count=0)]


def parse_text(file_path: Path | str) -> list[RawExtractedPage]:
    """Extract text from plain text or Markdown files."""
    path = Path(file_path)
    text = path.read_text(encoding="utf-8", errors="ignore").strip()
    return [RawExtractedPage(page_number=1, text=text, char_count=len(text))]


def parse_metadata_table(header_text: str) -> dict[str, str]:
    """Parse standard TechNova enterprise metadata table from header text.
    
    Extracts key-value pairs (Document ID, Document Type, Version, Document Owner, etc.)
    supporting single-line, table-pipe formatted, and multiline formats.
    """
    metadata: dict[str, str] = {}
    lines = [line.strip() for line in header_text.splitlines() if line.strip()]

    target_keys = {
        "document id": "doc_code",
        "document code": "doc_code",
        "document type": "detected_title",
        "document name": "detected_title",
        "document title": "detected_title",
        "document owner": "document_owner",
        "classification": "classification",
        "version": "detected_version",
        "effective date": "effective_date",
    }

    # 1. Single-line pattern: [optional |] Key [delimiter] Value
    for line in lines:
        for raw_key, field_name in target_keys.items():
            if field_name not in metadata:
                pattern = re.compile(
                    rf"^(?:[|\s]*){re.escape(raw_key)}\s*[:|\t\-–—]\s*(.+?)\s*\|?$", re.IGNORECASE
                )
                match = pattern.search(line)
                if match:
                    val = match.group(1).strip(" |")
                    if val:
                        metadata[field_name] = val

    # 2. Multiline pattern: Key on line i (ignoring colons/pipes), Value on line i+1
    for i, line in enumerate(lines):
        cleaned_key_line = line.strip(" |:\t-").lower()
        for raw_key, field_name in target_keys.items():
            if cleaned_key_line == raw_key and field_name not in metadata:
                if i + 1 < len(lines):
                    candidate_val = lines[i + 1].strip(" |")
                    if candidate_val.lower().strip(" |:\t-") not in target_keys:
                        metadata[field_name] = candidate_val

    return metadata


def detect_version_and_title(
    file_path: Path | str, pages: list[RawExtractedPage]
) -> VersionDetectionResult:
    """Analyze document header metadata table, filename, and cover pages to detect title and version."""
    path = Path(file_path)
    stem = path.stem

    if not pages:
        pages = [RawExtractedPage(page_number=1, text="", char_count=0)]

    # --- Step 1: Extract Metadata Table from First 2 Pages ---
    header_sample = "\n".join(page.text for page in pages[:2])
    table_meta = parse_metadata_table(header_sample)

    # Version candidate from metadata table
    detected_version = table_meta.get("detected_version")

    # --- Step 2: Check Filename for Version ---
    filename_version_pattern = re.compile(
        r"[_\-\s](?:v|version|rev|revision)[_\-\s]?(\d+(?:\.\d+)?)", re.IGNORECASE
    )
    filename_match = filename_version_pattern.search(stem)

    if not detected_version and filename_match:
        detected_version = filename_match.group(1)

    # --- Step 3: Check Cover Page Text for Version ---
    content_version_patterns = [
        re.compile(r"(?:Document\s+)?Version\s*[:#\-]?\s*(\d+(?:\.\d+)?)", re.IGNORECASE),
        re.compile(r"Revision\s*[:#\-]?\s*(\d+(?:\.\d+)?)", re.IGNORECASE),
        re.compile(r"\bRev\s*[:#\-]?\s*(\d+(?:\.\d+)?)", re.IGNORECASE),
        re.compile(r"Policy\s+Version\s*[:#\-]?\s*(\d+(?:\.\d+)?)", re.IGNORECASE),
    ]
    if not detected_version:
        for pattern in content_version_patterns:
            content_match = pattern.search(header_sample)
            if content_match:
                detected_version = content_match.group(1)
                break

    # Standardize version string
    version = detected_version or "1.0"
    if "." not in version:
        version = f"{version}.0"

    # --- Title Detection ---
    title = table_meta.get("detected_title")
    # If Document Type is generic (e.g. "Finance Policy"), prefer specific title from cover header
    if title and title.lower() in {
        "finance policy",
        "hr policy",
        "operations policy",
        "engineering policy",
        "administration policy",
    }:
        first_lines = [l.strip() for l in pages[0].text.splitlines() if l.strip()]
        if first_lines and "—" in first_lines[0]:
            specific = first_lines[0].split("—", 1)[1].strip()
            if specific:
                title = specific
    if not title and filename_match:
        title = filename_version_pattern.sub("", stem).replace("_", " ").replace("-", " ").strip().title()
    if not title:
        first_lines = [l.strip() for l in pages[0].text.splitlines() if l.strip()]
        title = first_lines[0] if first_lines else stem.replace("_", " ").replace("-", " ").title()

    # --- Source & Confidence Attribution ---
    if table_meta.get("detected_version") or table_meta.get("detected_title") or table_meta.get("doc_code"):
        source = "metadata_table"
        confidence = 0.95
    elif filename_match:
        source = "filename"
        confidence = 0.90
    elif detected_version and detected_version != "1.0":
        source = "cover_page"
        confidence = 0.85
    else:
        source = "default"
        confidence = 0.50

    return VersionDetectionResult(
        detected_version=version,
        detected_title=title,
        doc_code=table_meta.get("doc_code"),
        document_owner=table_meta.get("document_owner"),
        classification=table_meta.get("classification"),
        effective_date=table_meta.get("effective_date"),
        detection_source=source,
        confidence=confidence,
    )


def extract_document(
    file_path: Path | str,
) -> Tuple[list[RawExtractedPage], str, VersionDetectionResult]:
    """Unified entrypoint: calculates hash, parses content, and detects version."""
    path = Path(file_path).resolve()
    if not path.is_file():
        raise FileNotFoundError(f"Document not found at: {path}")

    # 1. Compute SHA-256 for deduplication and version integrity
    file_hash = calculate_file_hash(path)

    # 2. Parse pages based on file extension
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        pages = parse_pdf(path)
    elif suffix in (".docx", ".doc"):
        pages = parse_docx(path)
    elif suffix in (".txt", ".md"):
        pages = parse_text(path)
    else:
        raise ValueError(f"Unsupported document format '{suffix}'. Supported: .pdf, .docx, .txt, .md")

    # 3. Detect version & title metadata
    detection_result = detect_version_and_title(path, pages)

    return pages, file_hash, detection_result
