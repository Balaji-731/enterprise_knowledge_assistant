"""Audit logging router for security compliance and monitoring."""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin
from src.auth.schemas import AuditLogRead
from src.database.models import AuditLog
from src.database.session import get_db

router = APIRouter(prefix="/audit", tags=["Security & Compliance Audit"])


@router.get("/logs", response_model=List[AuditLogRead], dependencies=[Depends(require_admin)])
def get_audit_logs(
    action: Optional[str] = Query(None, description="Filter by action name e.g. DOC_UPLOAD, QUERY_RAG_ASK"),
    outcome: Optional[str] = Query(None, description="Filter by outcome e.g. SUCCESS, DENIED"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Retrieve system security audit trail (Administrators only)."""
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action.upper())
    if outcome:
        query = query.filter(AuditLog.outcome == outcome.upper())

    logs = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
    return logs
