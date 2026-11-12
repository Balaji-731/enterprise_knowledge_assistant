"""System prompts and context assembly templates for Enterprise RAG Grounding."""

from typing import List, Tuple
from src.rag.schemas import CitationRecord
from src.retrieval.schemas import RetrievedChunk

TECHNOVA_SYSTEM_PROMPT = """You are the official Enterprise AI Knowledge Assistant for TechNova Solutions Pvt. Ltd.

Your responsibility is to assist employees by answering questions accurately based strictly on authorized internal documents (handbooks, policies, standards, and guidelines).

STRICT GROUNDING & SECURITY RULES:
1. ONLY use information explicitly stated in the "AUTHORIZED ENTERPRISE CONTEXT" provided below.
2. DO NOT use outside general knowledge, assumptions, or speculation about TechNova rules.
3. If the provided context does NOT contain sufficient information to answer the question, explicitly respond:
   "I cannot find this information in your authorized company documents."
4. IN-TEXT CITATIONS: Whenever you state a rule, policy threshold, timeline, allowance, or requirement, you MUST cite the source number in square brackets, e.g. [1] or [2].
5. MULTIPLE SOURCES: If multiple documents support a statement, combine citations, e.g. [1][2].
6. Be concise, direct, professional, and well-structured (use bullet points where appropriate).
"""


def build_grounded_prompt(
    query: str,
    chunks: List[RetrievedChunk],
) -> Tuple[str, str, List[CitationRecord]]:
    """Assemble grounded system prompt, user prompt with numbered context sources, and citation records.
    
    Returns:
        (system_prompt, user_prompt, citation_records)
    """
    context_sections: List[str] = []
    citation_records: List[CitationRecord] = []

    for idx, chunk in enumerate(chunks, start=1):
        # Create structured citation record
        record = CitationRecord(
            source_index=idx,
            document_title=chunk.document_title,
            version_number=chunk.version_number,
            section_header=chunk.section_header or "General",
            page_number=chunk.page_number,
            category=chunk.category,
            citation_tag=chunk.format_citation(),
        )
        citation_records.append(record)

        # Build clean source context block
        sec_label = f" | Section: {chunk.section_header}" if chunk.section_header else ""
        header = f"--- [SOURCE {idx}]: {chunk.document_title} (v{chunk.version_number}){sec_label} | Page {chunk.page_number} ---"
        context_sections.append(f"{header}\n{chunk.text.strip()}")

    joined_context = "\n\n".join(context_sections)

    user_prompt = f"""AUTHORIZED ENTERPRISE CONTEXT:
================================================================================
{joined_context}
================================================================================

EMPLOYEE QUESTION:
{query}

ANSWER (grounded strictly in the sources above, with in-text citations [1], [2], etc.):"""

    return TECHNOVA_SYSTEM_PROMPT, user_prompt, citation_records
