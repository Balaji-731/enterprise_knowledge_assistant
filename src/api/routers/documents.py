"""Document management and ingestion upload router."""

import shutil
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from src.auth.dependencies import get_current_user, get_current_user_context, require_hr_or_admin
from src.database.models import AuditLog, Document, DocumentVersion, User
from src.database.session import get_db
from src.ingestion.pipeline import IngestionPipeline
from src.ingestion.schemas import AccessPolicy, DocumentCategory, IngestionResult, UserRole, VersionStatus
from src.retrieval.permissions import is_chunk_authorized
from src.retrieval.schemas import UserContext

router = APIRouter(prefix="/documents", tags=["Document Management"])

UPLOAD_DIR = Path("./storage/uploads").resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

_ingestion_pipeline = None


def get_ingestion_pipeline() -> IngestionPipeline:
    global _ingestion_pipeline
    if _ingestion_pipeline is None:
        _ingestion_pipeline = IngestionPipeline()
    return _ingestion_pipeline


@router.post("/upload", response_model=IngestionResult, dependencies=[Depends(require_hr_or_admin)])
def upload_document(
    file: UploadFile = File(...),
    category: DocumentCategory = Form(DocumentCategory.OPERATIONS),
    manual_version: Optional[str] = Form(None),
    change_summary: Optional[str] = Form(None),
    allowed_roles: Optional[str] = Form(None),
    allowed_departments: Optional[str] = Form(None),
    allowed_users: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload, parse, chunk, embed, and index an enterprise document (HR & Admin only)."""
    # Save uploaded file to disk
    file_path = UPLOAD_DIR / file.filename
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save uploaded file: {e}",
        )

    manual_policy: Optional[AccessPolicy] = None
    if allowed_roles is not None or allowed_departments is not None or allowed_users is not None:
        parsed_roles = []
        if allowed_roles:
            for r in allowed_roles.split(","):
                r_clean = r.strip().lower()
                if r_clean:
                    try:
                        parsed_roles.append(UserRole(r_clean))
                    except ValueError:
                        pass
        if not parsed_roles:
            parsed_roles = [UserRole.ADMINISTRATOR]

        parsed_depts = [d.strip().lower() for d in (allowed_departments or "").split(",") if d.strip()] or ["all"]
        parsed_users = [u.strip().lower() for u in (allowed_users or "").split(",") if u.strip()]
        manual_policy = AccessPolicy(
            allowed_roles=parsed_roles,
            allowed_departments=parsed_depts,
            allowed_users=parsed_users,
        )

    try:
        pipeline = get_ingestion_pipeline()
        result = pipeline.ingest_document(
            file_path=file_path,
            category=category,
            manual_policy=manual_policy,
            manual_version=manual_version,
            uploader_id=current_user.id,
        )

        # ---------------------------------------------------------
        # Commit to Authoritative Relational Database (PostgreSQL/SQLite)
        # ---------------------------------------------------------
        # Check if parent Document family already exists by title
        db_doc = db.query(Document).filter(Document.title == result.document_title).first()
        if not db_doc:
            db_doc = Document(
                id=result.document_id,
                title=result.document_title,
                category=result.category.value,
            )
            db.add(db_doc)
            db.flush()

        # Archive prior active versions in relational DB
        prior_versions = (
            db.query(DocumentVersion)
            .filter(DocumentVersion.document_id == db_doc.id, DocumentVersion.is_active == True)
            .all()
        )
        for pv in prior_versions:
            pv.is_active = False
            pv.status = VersionStatus.ARCHIVED.value

        # Create new version record
        policy_meta = result.access_policy.to_metadata_strings()
        new_version = DocumentVersion(
            id=result.version_id,
            document_id=db_doc.id,
            version_number=result.version_number,
            status=VersionStatus.ACTIVE.value,
            is_active=True,
            file_path=str(file_path),
            file_hash=result.file_hash,
            uploaded_by=current_user.id,
            change_summary=change_summary,
            allowed_roles=policy_meta["allowed_roles"],
            allowed_departments=policy_meta["allowed_departments"],
            allowed_users=policy_meta["allowed_users"],
        )
        db.add(new_version)

        # Audit log the upload
        audit = AuditLog(
            user_id=current_user.id,
            username=current_user.username,
            action="DOC_UPLOAD",
            resource=f"{result.document_title} (v{result.version_number})",
            outcome="SUCCESS",
            details=f"Ingested {result.total_chunks} chunks across {result.total_pages} pages.",
        )
        db.add(audit)
        db.commit()

        return result

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ingestion failed: {e}",
        )


@router.get("")
@router.get("/")
def list_documents(
    category: Optional[DocumentCategory] = None,
    current_user: User = Depends(get_current_user),
    user_ctx: UserContext = Depends(get_current_user_context),
    db: Session = Depends(get_db),
):
    """List authorized enterprise documents with their active versions."""
    query = db.query(Document)
    if category:
        query = query.filter(Document.category == category.value)
    docs = query.all()

    response = []
    for d in docs:
        active_ver = next((v for v in d.versions if v.is_active), None)
        if active_ver:
            meta = {
                "is_active": active_ver.is_active,
                "status": active_ver.status,
                "allowed_roles": active_ver.allowed_roles,
                "allowed_departments": active_ver.allowed_departments,
                "allowed_users": active_ver.allowed_users,
            }
            if not is_chunk_authorized(meta, user_ctx, include_historical=False) and active_ver.uploaded_by != current_user.id:
                continue

        uploader_name = active_ver.uploader.full_name if (active_ver and active_ver.uploader) else "System"
        response.append({
            "id": d.id,
            "title": d.title,
            "category": d.category,
            "active_version": active_ver.version_number if active_ver else None,
            "total_versions": len(d.versions),
            "created_at": d.created_at,
            "updated_at": active_ver.upload_date if active_ver else d.created_at,
            "status": active_ver.status if active_ver else "active",
            "allowed_roles": active_ver.allowed_roles if active_ver else "",
            "allowed_departments": active_ver.allowed_departments if active_ver else "",
            "allowed_users": active_ver.allowed_users if active_ver else "",
            "uploaded_by": uploader_name,
            "change_summary": active_ver.change_summary if active_ver else None,
        })
    return response
