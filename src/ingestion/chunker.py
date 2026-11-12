"""Intelligent structure-aware chunking engine for TechNova Ingestion Pipeline.

Splits document text into semantic chunks with:
- Section header detection (Markdown #, clause numbers e.g. '1.2 Policy', ALL CAPS headings).
- Configurable target character/token size and sliding overlap window.
- Contextual text enrichment (prepends document title, version, and section to chunk body).
- Strict metadata and access policy inheritance on every chunk.
"""

import re
from typing import List, Optional
from uuid import uuid4

from src.ingestion.schemas import (
    AccessPolicy,
    Chunk,
    ChunkMetadata,
    RawExtractedPage,
    VersionStatus,
)

# Regex patterns to detect section headings in enterprise documents
HEADING_PATTERNS = [
    re.compile(r"^(?:[#]{1,4}\s+)(.+)$", re.MULTILINE),  # Markdown headers (# Header)
    re.compile(r"^(?:\d+\.(?:\d+)*\s+)([A-Z0-9].+)$", re.MULTILINE),  # Numbered clauses (1.2 Policy Title)
    re.compile(r"^(?:Section\s+\d+(?:\.\d+)*[:\s]+)(.+)$", re.IGNORECASE | re.MULTILINE),  # Section 2.1 Title
    re.compile(r"^[A-Z0-9\s]{4,60}$", re.MULTILINE),  # Short ALL CAPS lines
]


def is_heading(line: str) -> bool:
    """Check if a line matches common enterprise heading structures."""
    line_clean = line.strip()
    if not line_clean or len(line_clean) > 80:
        return False
    return any(pattern.match(line_clean) for pattern in HEADING_PATTERNS)


def estimate_token_count(text: str) -> int:
    """Approximate token count (roughly 4 characters per token in English)."""
    return len(text) // 4


def chunk_document_pages(
    pages: List[RawExtractedPage],
    document_id: str,
    version_id: str,
    document_title: str,
    category: str,
    version_number: str,
    access_policy: AccessPolicy,
    status: VersionStatus = VersionStatus.ACTIVE,
    is_active: bool = True,
    target_chunk_chars: int = 2000,
    overlap_chars: int = 400,
) -> List[Chunk]:
    """Chunk clean document pages into enriched, metadata-tagged Chunk objects."""
    chunks: List[Chunk] = []

    # Flatten pages into structural blocks (paragraph / section units) with page attribution
    blocks: List[tuple[int, Optional[str], str]] = []  # (page_num, current_section, text_block)
    current_section: Optional[str] = None

    for page in pages:
        lines = page.text.splitlines()
        current_block_lines: List[str] = []

        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue

            if is_heading(line_str):
                # Save previous block if present
                if current_block_lines:
                    blocks.append((page.page_number, current_section, "\n".join(current_block_lines)))
                    current_block_lines = []
                current_section = line_str
                current_block_lines.append(line_str)
            else:
                current_block_lines.append(line_str)

        if current_block_lines:
            blocks.append((page.page_number, current_section, "\n".join(current_block_lines)))

    if not blocks:
        return []

    # Slidably combine blocks into chunks adhering to target_chunk_chars
    current_chunk_text = ""
    current_page_num = blocks[0][0]
    current_section_header = blocks[0][1]

    for page_num, sec_header, block_text in blocks:
        # Check if adding this block exceeds limit
        if current_chunk_text and len(current_chunk_text) + len(block_text) > target_chunk_chars:
            # Finalize current chunk
            enriched_text = (
                f"[Document: {document_title} (v{version_number}) | Section: {current_section_header or 'General'}]\n"
                f"{current_chunk_text.strip()}"
            )
            policy_strings = access_policy.to_metadata_strings()

            metadata = ChunkMetadata(
                chunk_id=str(uuid4()),
                document_id=document_id,
                version_id=version_id,
                document_title=document_title,
                category=category,
                version_number=version_number,
                is_active=is_active,
                status=status.value if isinstance(status, VersionStatus) else str(status),
                page_number=current_page_num,
                section_header=current_section_header,
                allowed_roles=policy_strings["allowed_roles"],
                allowed_departments=policy_strings["allowed_departments"],
                allowed_users=policy_strings["allowed_users"],
                token_count=estimate_token_count(enriched_text),
            )
            chunks.append(Chunk(text=enriched_text, metadata=metadata))

            # Maintain overlap window
            overlap_offset = max(0, len(current_chunk_text) - overlap_chars)
            current_chunk_text = current_chunk_text[overlap_offset:] + "\n" + block_text
            current_page_num = page_num
            if sec_header:
                current_section_header = sec_header
        else:
            if current_chunk_text:
                current_chunk_text += "\n\n" + block_text
            else:
                current_chunk_text = block_text
                current_page_num = page_num
                if sec_header:
                    current_section_header = sec_header

    # Final trailing chunk
    if current_chunk_text.strip():
        enriched_text = (
            f"[Document: {document_title} (v{version_number}) | Section: {current_section_header or 'General'}]\n"
            f"{current_chunk_text.strip()}"
        )
        policy_strings = access_policy.to_metadata_strings()

        metadata = ChunkMetadata(
            chunk_id=str(uuid4()),
            document_id=document_id,
            version_id=version_id,
            document_title=document_title,
            category=category,
            version_number=version_number,
            is_active=is_active,
            status=status.value if isinstance(status, VersionStatus) else str(status),
            page_number=current_page_num,
            section_header=current_section_header,
            allowed_roles=policy_strings["allowed_roles"],
            allowed_departments=policy_strings["allowed_departments"],
            allowed_users=policy_strings["allowed_users"],
            token_count=estimate_token_count(enriched_text),
        )
        chunks.append(Chunk(text=enriched_text, metadata=metadata))

    return chunks
