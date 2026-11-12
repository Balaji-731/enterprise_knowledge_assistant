"""Data models and schemas for the RAG Generation Engine."""

from typing import Any, List, Optional
from pydantic import BaseModel, Field


class CitationRecord(BaseModel):
    """Structured record of a cited document source."""
    source_index: int = Field(description="Sequential source identifier [1], [2], etc.")
    document_title: str
    version_number: str
    section_header: str
    page_number: int
    category: str
    citation_tag: str

    def format_footnote(self) -> str:
        """Format as a clear footnote citation."""
        sec = f", Section: {self.section_header}" if self.section_header else ""
        return f"[{self.source_index}] {self.document_title} (v{self.version_number}){sec}, Page {self.page_number}"


class RAGQuery(BaseModel):
    """Query parameters for RAG response generation."""
    query: str = Field(description="User question or knowledge inquiry")
    top_k: int = Field(default=4, ge=1, le=20, description="Max context chunks to retrieve")
    include_historical: bool = Field(default=False, description="Whether to query archived versions (HR/Admin only)")
    model_name: str = Field(default="llama3.2:latest", description="Target Ollama model name")
    temperature: float = Field(default=0.1, ge=0.0, le=1.0, description="Sampling temperature (lower = more deterministic)")
    stream: bool = Field(default=False, description="Whether to stream response tokens")


class RAGResponse(BaseModel):
    """Complete grounded answer with verified source citations."""
    query: str
    answer: str
    citations: List[CitationRecord]
    user_id: str
    user_role: str
    user_department: str
    model_used: str
    latency_ms: float
    grounded: bool = Field(default=True, description="True if answer is derived from authorized context")
    raw_context: Optional[str] = Field(default=None, description="Full context passed to LLM for auditing")

    def format_full_response(self) -> str:
        """Format answer with full footnotes list."""
        output = [self.answer.strip(), "\n\n--- Verified Sources ---"]
        if self.citations:
            for cit in self.citations:
                output.append(cit.format_footnote())
        else:
            output.append("No specific enterprise sources cited.")
        return "\n".join(output)
