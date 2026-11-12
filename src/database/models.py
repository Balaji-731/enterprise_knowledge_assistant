"""Authoritative SQLAlchemy Relational Models for TechNova Enterprise AI.

Defines:
1. User (Identity, Department, RBAC Role)
2. Document (Parent family container for enterprise knowledge)
3. DocumentVersion (Concrete versions, file hash, lifecycle state, ACLs)
4. AuditLog (Complete audit trail of queries, uploads, denials, and administrative actions)
"""

from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from src.database.session import Base
from src.ingestion.schemas import DocumentCategory, UserRole, VersionStatus


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    """Authoritative user record with role and department assignments."""
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    username = Column(String(64), unique=True, index=True, nullable=False)
    email = Column(String(128), unique=True, index=True, nullable=False)
    full_name = Column(String(128), nullable=False)
    hashed_password = Column(String(256), nullable=False)
    role = Column(String(32), default=UserRole.EMPLOYEE.value, nullable=False)
    department = Column(String(64), default="engineering", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Relationships
    uploaded_versions = relationship("DocumentVersion", back_populates="uploader")
    audit_logs = relationship("AuditLog", back_populates="user")


class Document(Base):
    """Parent document container representing an enterprise policy family."""
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    doc_code = Column(String(64), unique=True, index=True, nullable=True)
    title = Column(String(256), index=True, nullable=False)
    category = Column(String(32), default=DocumentCategory.OPERATIONS.value, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Relationships
    versions = relationship("DocumentVersion", back_populates="document", cascade="all, delete-orphan")


class DocumentVersion(Base):
    """Specific concrete revision of an enterprise document."""
    __tablename__ = "document_versions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(String(32), nullable=False, default="1.0")
    status = Column(String(32), default=VersionStatus.ACTIVE.value, nullable=False)
    is_active = Column(Boolean, default=True, index=True, nullable=False)
    file_path = Column(String(512), nullable=False)
    file_hash = Column(String(64), index=True, nullable=False)  # SHA-256
    uploaded_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    upload_date = Column(DateTime, default=utc_now, nullable=False)
    change_summary = Column(Text, nullable=True)

    # Serialized Access Control Lists (Authoritative ACLs)
    allowed_roles = Column(String(256), default="employee,hr,manager,administrator", nullable=False)
    allowed_departments = Column(String(256), default="all", nullable=False)
    allowed_users = Column(Text, default="", nullable=False)

    # Relationships
    document = relationship("Document", back_populates="versions")
    uploader = relationship("User", back_populates="uploaded_versions")


class AuditLog(Base):
    """Security and compliance audit trail recording all system actions."""
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    username = Column(String(64), nullable=True)
    action = Column(String(64), index=True, nullable=False)  # e.g. "AUTH_LOGIN", "QUERY_SEARCH", "DOC_UPLOAD", "PERMISSION_DENIAL"
    resource = Column(String(512), nullable=True)  # Doc ID, query text, or endpoint
    outcome = Column(String(32), nullable=False)   # "SUCCESS", "DENIED", "FAILED"
    details = Column(Text, nullable=True)
    ip_address = Column(String(64), nullable=True)
    timestamp = Column(DateTime, default=utc_now, index=True, nullable=False)

    # Relationships
    user = relationship("User", back_populates="audit_logs")
