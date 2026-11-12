"""Schemas and data models for Secure Hybrid Retrieval and Permission Engine."""

from typing import Any, List, Optional
from pydantic import BaseModel, Field

from src.ingestion.schemas import UserRole


class UserContext(BaseModel):
    """Context of the authenticated user making the retrieval request."""
    user_id: str = Field(description="Unique identifier of user")
    username: str = Field(description="Username or corporate email")
    role: UserRole = Field(description="RBAC role of user: employee, hr, manager, administrator")
    department: str = Field(description="Department of user, e.g. engineering, hr, finance, operations")

    @property
    def is_admin(self) -> bool:
        return self.role == UserRole.ADMINISTRATOR


class RetrievalQuery(BaseModel):
    """Specification of a retrieval query with access controls and filters."""
    query: str = Field(description="User natural-language question or search query")
    top_k: int = Field(default=5, ge=1, le=50, description="Number of final context chunks to return")
    include_historical: bool = Field(
        default=False,
        description="Whether to include archived/historical document versions (requires manager/HR/admin)",
    )
    target_document_id: Optional[str] = Field(
        default=None,
        description="Optional specific document ID filter for single-doc search or version comparison",
    )
    target_version_number: Optional[str] = Field(
        default=None,
        description="Optional specific version number filter, e.g. '1.0' or '2.1'",
    )


class RetrievedChunk(BaseModel):
    """A single retrieved chunk with all scores and citation metadata."""
    chunk_id: str
    document_id: str
    version_id: str
    document_title: str
    version_number: str
    category: str
    page_number: int
    section_header: str
    text: str
    allowed_roles: str
    allowed_departments: str
    allowed_users: str = ""
    is_active: bool = True

    # Scoring breakdown
    dense_score: float = 0.0
    sparse_score: float = 0.0
    rrf_score: float = 0.0
    rerank_score: float = 0.0

    def format_citation(self) -> str:
        """Format chunk source citation for context building."""
        sec = f" | Section: {self.section_header}" if self.section_header else ""
        return f"[Document: {self.document_title} (v{self.version_number}){sec} | Page: {self.page_number}]"


class RetrievalResponse(BaseModel):
    """Result of secure hybrid retrieval with grounded context for LLM generation."""
    query: str
    user_id: str
    user_role: str
    user_department: str
    chunks: List[RetrievedChunk]
    total_candidates_found: int
    authorized_context: str
    citations: List[str]
    audit_metadata: dict[str, Any] = Field(default_factory=dict)
