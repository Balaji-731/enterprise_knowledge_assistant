"""Pydantic schemas for Authentication, Users, and Auditing."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from src.ingestion.schemas import UserRole


class UserLogin(BaseModel):
    """Payload for username/password login."""
    username: str
    password: str


class UserCreate(BaseModel):
    """Schema for registering or creating a new employee user."""
    username: str = Field(min_length=3, max_length=64)
    email: str = Field(min_length=5, max_length=128, description="Corporate email address")
    full_name: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=6, max_length=128)
    role: UserRole = Field(default=UserRole.EMPLOYEE)
    department: str = Field(default="engineering")


class UserRead(BaseModel):
    """Public user identity representation."""
    id: str
    username: str
    email: str
    full_name: str
    role: str
    department: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserStatusUpdate(BaseModel):
    """Schema for activating or deactivating an employee account."""
    is_active: bool


class TokenResponse(BaseModel):
    """JWT Token response returned upon successful authentication."""
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class AuditLogRead(BaseModel):
    """Audit log entry representation."""
    id: str
    username: Optional[str]
    action: str
    resource: Optional[str]
    outcome: str
    details: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True
