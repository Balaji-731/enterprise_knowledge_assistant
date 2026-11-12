"""Core data models and schemas for the TechNova Ingestion Pipeline.

These schemas define the contracts between parsers, chunkers, access control
policies, vector indexers, and the relational database.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4
from pydantic import BaseModel, Field


class DocumentCategory(str, Enum):
    """Enterprise document categories recognized by TechNova."""
    HR = "HR"
    ENGINEERING = "ENGINEERING"
    FINANCE = "FINANCE"
    OPERATIONS = "OPERATIONS"
    ADMINISTRATION = "ADMINISTRATION"


class UserRole(str, Enum):
    """Standard Role-Based Access Control (RBAC) tiers."""
    EMPLOYEE = "employee"
    HR = "hr"
    MANAGER = "manager"
    ADMINISTRATOR = "administrator"


class VersionStatus(str, Enum):
    """Lifecycle status of a document version."""
    ACTIVE = "active"
    ARCHIVED = "archived"
    DRAFT = "draft"
    DEPRECATED = "deprecated"


class AccessPolicy(BaseModel):
    """Defines permission boundaries for a document version and its chunks."""
    allowed_roles: list[UserRole] = Field(
        default_factory=lambda: [
            UserRole.EMPLOYEE,
            UserRole.HR,
            UserRole.MANAGER,
            UserRole.ADMINISTRATOR,
        ],
        description="Roles authorized to view this document/chunk",
    )
    allowed_departments: list[str] = Field(
        default_factory=lambda: ["all"],
        description="Department codes authorized (e.g. ['all'], ['engineering'], ['finance'])",
    )
    allowed_users: list[str] = Field(
        default_factory=list,
        description="Specific user IDs with explicit grants, overriding standard RBAC if present",
    )

    def to_metadata_strings(self) -> dict[str, str]:
        """Convert policy fields to comma-separated strings for ChromaDB metadata compatibility."""
        return {
            "allowed_roles": ",".join(r.value for r in self.allowed_roles),
            "allowed_departments": ",".join(d.strip().lower() for d in self.allowed_departments),
            "allowed_users": ",".join(u.strip() for u in self.allowed_users),
        }


class RawExtractedPage(BaseModel):
    """Raw text and structural information extracted from a single document page."""
    page_number: int = Field(ge=1, description="1-indexed page number")
    text: str = Field(description="Extracted page text")
    char_count: int = Field(ge=0, description="Total characters in this page")


class VersionDetectionResult(BaseModel):
    """Result from analyzing an uploaded file for versioning and metadata indicators."""
    detected_version: str = Field(default="1.0", description="Semantic version string, e.g. '1.0', '2.1'")
    detected_title: str | None = Field(default=None, description="Inferred document title / type, e.g. 'Operations / Business Continuity Policy'")
    doc_code: str | None = Field(default=None, description="Enterprise Document ID, e.g. 'TN-OPS-POL-003'")
    document_owner: str | None = Field(default=None, description="Document owner / department, e.g. 'Operations Department'")
    classification: str | None = Field(default=None, description="Access classification, e.g. 'Internal — Operations'")
    effective_date: str | None = Field(default=None, description="Effective date string, e.g. '01 April 2026'")
    detection_source: str = Field(
        default="default",
        description="Source of version detection ('explicit', 'metadata_table', 'cover_page', 'filename', 'table', 'llm', 'default')",
    )
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence score of detection")
    is_duplicate: bool = Field(default=False, description="True if identical SHA-256 hash already exists")


class ChunkMetadata(BaseModel):
    """Metadata envelope attached to every chunk in vector storage."""
    chunk_id: str = Field(default_factory=lambda: str(uuid4()))
    document_id: str = Field(description="UUID of parent Document")
    version_id: str = Field(description="UUID of DocumentVersion")
    document_title: str = Field(description="Human-readable document title")
    category: str = Field(description="Document category name")
    version_number: str = Field(description="Version string e.g. '1.0'")
    is_active: bool = Field(default=True, description="True if this chunk belongs to the current active policy")
    status: str = Field(default=VersionStatus.ACTIVE.value, description="Lifecycle status")
    page_number: int = Field(ge=1, description="Source page number for accurate citations")
    section_header: str | None = Field(default=None, description="Nearest section or clause heading")
    
    # Comma-separated strings for ChromaDB scalar metadata filtering
    allowed_roles: str = Field(description="Comma-separated allowed roles")
    allowed_departments: str = Field(description="Comma-separated allowed departments")
    allowed_users: str = Field(default="", description="Comma-separated allowed user IDs")
    token_count: int = Field(ge=0, description="Approximate token count of chunk text")

    def to_chroma_dict(self) -> dict[str, Any]:
        """Convert metadata to a flat dictionary acceptable by ChromaDB."""
        return {
            "chunk_id": self.chunk_id,
            "document_id": self.document_id,
            "version_id": self.version_id,
            "document_title": self.document_title,
            "category": self.category,
            "version_number": self.version_number,
            "is_active": self.is_active,
            "status": self.status,
            "page_number": self.page_number,
            "section_header": self.section_header or "",
            "allowed_roles": self.allowed_roles,
            "allowed_departments": self.allowed_departments,
            "allowed_users": self.allowed_users,
            "token_count": self.token_count,
        }


class Chunk(BaseModel):
    """A semantic text chunk with its enriched metadata."""
    text: str = Field(description="Processed chunk text including context prefix")
    metadata: ChunkMetadata = Field(description="Associated chunk metadata")


class DocumentVersionMetadata(BaseModel):
    """Structured record for a specific document version."""
    version_id: str = Field(default_factory=lambda: str(uuid4()))
    document_id: str = Field(description="UUID of parent Document")
    version_number: str = Field(description="Version string, e.g. '1.0'")
    file_hash: str = Field(description="SHA-256 cryptographic checksum")
    file_path: str = Field(description="Storage path to the document file")
    uploaded_by: str = Field(description="User ID or email of uploader")
    upload_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: VersionStatus = Field(default=VersionStatus.ACTIVE)
    change_summary: str | None = Field(default=None, description="Optional release notes or summary of changes")
    access_policy: AccessPolicy = Field(default_factory=AccessPolicy)


class IngestionResult(BaseModel):
    """Result summary produced upon completing document ingestion."""
    document_id: str
    version_id: str
    document_title: str
    version_number: str
    category: DocumentCategory
    total_pages: int
    total_chunks: int
    file_hash: str
    status: VersionStatus
    access_policy: AccessPolicy
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
