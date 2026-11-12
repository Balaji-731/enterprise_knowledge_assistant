"""Text cleaning and normalization module for the Ingestion Pipeline.

Cleans raw extracted page text to improve semantic search and vector embedding quality:
- Detects and strips recurring headers and footers across document pages.
- Fixes line-wrap hyphenated word splits (e.g. "organi-\\nzation" -> "organization").
- Normalizes non-breaking spaces, control characters, and bullet points.
- Consolidates excessive line breaks while preserving paragraph boundaries.
"""

import re
from collections import Counter
from typing import List

from src.ingestion.schemas import RawExtractedPage


def fix_hyphenated_words(text: str) -> str:
    """Recombine words split across line breaks by hyphens (e.g., 'pol-\\nicy' -> 'policy')."""
    # Matches a word character, a hyphen, a newline, optional whitespace, and lower-case word character
    pattern = re.compile(r"(\b[a-zA-Z]+)-\s*\n\s*([a-z]+\b)")
    return pattern.sub(r"\1\2", text)


def normalize_whitespace(text: str) -> str:
    """Clean control characters, non-breaking spaces, bullet points, and blank line gaps."""
    # Replace non-breaking spaces and zero-width spaces
    text = text.replace("\xa0", " ").replace("\u200b", "")

    # Standardize bullet characters
    bullet_pattern = re.compile(r"^[ \t]*[•▪⁃◦➢]\s*", re.MULTILINE)
    text = bullet_pattern.sub("- ", text)

    # Convert tabs to spaces
    text = text.replace("\t", " ")

    # Strip trailing whitespace on individual lines
    lines = [line.rstrip() for line in text.splitlines()]
    text = "\n".join(lines)

    # Collapse 3 or more consecutive newlines down to 2 (paragraph break)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def remove_page_numbers_and_footers(text: str) -> str:
    """Strip standard page numbering footers (e.g., 'Page 1 of 10', '- Page 2 -')."""
    patterns = [
        re.compile(r"^\s*Page\s+\d+\s+of\s+\d+\s*$", re.IGNORECASE | re.MULTILINE),
        re.compile(r"^\s*-\s*Page\s+\d+\s*-\s*$", re.IGNORECASE | re.MULTILINE),
        re.compile(r"^\s*Page\s+\d+\s*$", re.IGNORECASE | re.MULTILINE),
        re.compile(r"^\s*\d+\s*/\s*\d+\s*$", re.MULTILINE),
    ]
    for pattern in patterns:
        text = pattern.sub("", text)
    return text.strip()


def detect_and_remove_recurring_headers(
    pages: List[RawExtractedPage], threshold_ratio: float = 0.6
) -> List[RawExtractedPage]:
    """Identify lines that repeat across most pages (headers/footers) and strip them.
    
    If a line appears in the top 2 lines or bottom 2 lines of >= threshold_ratio of pages
    (minimum 3 pages), it is classified as a header/footer artifact and removed.
    """
    if len(pages) < 3:
        return pages

    header_candidates = Counter()
    footer_candidates = Counter()

    for page in pages:
        lines = [l.strip() for l in page.text.splitlines() if l.strip()]
        if not lines:
            continue

        # Top 2 lines
        for top_line in lines[:2]:
            if len(top_line) > 3 and not top_line.isdigit():
                header_candidates[top_line] += 1

        # Bottom 2 lines
        for bottom_line in lines[-2:]:
            if len(bottom_line) > 3 and not bottom_line.isdigit():
                footer_candidates[bottom_line] += 1

    min_occurrences = max(2, int(len(pages) * threshold_ratio))

    recurring_lines = set()
    for line, count in header_candidates.items():
        if count >= min_occurrences:
            recurring_lines.add(line)

    for line, count in footer_candidates.items():
        if count >= min_occurrences:
            recurring_lines.add(line)

    cleaned_pages: List[RawExtractedPage] = []
    for page in pages:
        lines = page.text.splitlines()
        filtered_lines = [line for line in lines if line.strip() not in recurring_lines]
        cleaned_text = "\n".join(filtered_lines).strip()
        cleaned_pages.append(
            RawExtractedPage(
                page_number=page.page_number,
                text=cleaned_text,
                char_count=len(cleaned_text),
            )
        )

    return cleaned_pages


def clean_extracted_pages(pages: List[RawExtractedPage]) -> List[RawExtractedPage]:
    """Master cleaning function: runs full normalization pipeline across extracted pages."""
    # Step 1: Remove recurring headers and footers across multi-page docs
    pages = detect_and_remove_recurring_headers(pages)

    # Step 2: Per-page text hygiene
    cleaned_pages: List[RawExtractedPage] = []
    for page in pages:
        text = page.text
        text = fix_hyphenated_words(text)
        text = remove_page_numbers_and_footers(text)
        text = normalize_whitespace(text)

        cleaned_pages.append(
            RawExtractedPage(
                page_number=page.page_number,
                text=text,
                char_count=len(text),
            )
        )

    return cleaned_pages
