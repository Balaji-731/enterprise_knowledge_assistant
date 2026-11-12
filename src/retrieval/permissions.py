"""Permission Engine and Defense-in-Depth Authorization for Knowledge Retrieval.

Enforces zero-leakage access control:
1. Pre-retrieval permission filters (ensuring unauthorized chunks never enter candidate scoring).
2. Role and Department matching against chunk security envelopes.
3. Explicit user grants and historical version access gates.
4. Post-retrieval defense-in-depth re-validation before context assembly.
"""

from typing import Any, List, Tuple
from src.ingestion.schemas import UserRole
from src.retrieval.schemas import RetrievalQuery, RetrievedChunk, UserContext


def is_chunk_authorized(
    metadata: dict[str, Any],
    user: UserContext,
    include_historical: bool = False,
) -> bool:
    """Evaluate whether an authenticated user has permission to view a chunk.
    
    Security Rules:
    1. Active Status: Inactive/archived chunks are blocked unless include_historical=True.
    2. Administrator: Superuser access across all enterprise categories and departments.
    3. Explicit User Grants: If user ID or username is in allowed_users, access is granted.
    4. RBAC Role Match: User's role must be present in chunk's allowed_roles.
    5. ABAC Department Match: User's department must match chunk's allowed_departments (or 'all').
    """
    # 1. Active policy filter and historical version gating
    if not include_historical:
        is_active = metadata.get("is_active", True)
        status = str(metadata.get("status", "active")).lower()
        if not is_active or status in ("archived", "deprecated"):
            return False
    else:
        # Gating: Only HR, Managers, and Administrators can inspect historical/archived versions
        if user.role == UserRole.EMPLOYEE and not user.is_admin:
            is_active = metadata.get("is_active", True)
            status = str(metadata.get("status", "active")).lower()
            if not is_active or status in ("archived", "deprecated"):
                return False

    # 2. Administrator superuser bypass
    if user.is_admin:
        return True

    # 3. Explicit user grant override
    allowed_users_raw = str(metadata.get("allowed_users", "")).strip()
    if allowed_users_raw:
        allowed_users = [u.strip().lower() for u in allowed_users_raw.split(",") if u.strip()]
        if user.user_id.lower() in allowed_users or user.username.lower() in allowed_users:
            return True

    # 4. Role-Based Access Control (RBAC)
    allowed_roles_raw = str(metadata.get("allowed_roles", "")).strip()
    if allowed_roles_raw:
        allowed_roles = [r.strip().lower() for r in allowed_roles_raw.split(",") if r.strip()]
        if user.role.value.lower() not in allowed_roles:
            return False
    else:
        # Default safety: deny access if no allowed roles are defined
        return False

    # 5. Department-Based Access Control (ABAC)
    allowed_depts_raw = str(metadata.get("allowed_departments", "")).strip()
    if allowed_depts_raw:
        allowed_depts = [d.strip().lower() for d in allowed_depts_raw.split(",") if d.strip()]
        if "all" in allowed_depts:
            return True
        if user.department.strip().lower() in allowed_depts:
            return True
        return False

    return False


def build_chroma_pre_filter(
    user: UserContext,
    query_spec: RetrievalQuery,
) -> dict[str, Any] | None:
    """Construct a ChromaDB metadata 'where' filter for pre-retrieval filtering."""
    conditions: List[dict[str, Any]] = []

    # Filter by active status
    if not query_spec.include_historical:
        conditions.append({"is_active": True})

    # Optional specific document filtering (e.g. for comparison)
    if query_spec.target_document_id:
        conditions.append({"document_id": query_spec.target_document_id})

    if query_spec.target_version_number:
        conditions.append({"version_number": query_spec.target_version_number})

    if not conditions:
        return None
    if len(conditions) == 1:
        return conditions[0]
    return {"$and": conditions}


def validate_defense_in_depth(
    chunks: List[RetrievedChunk],
    user: UserContext,
    include_historical: bool = False,
) -> Tuple[List[RetrievedChunk], int]:
    """Secondary authorization validation after retrieval.
    
    Acts as a fail-safe against stale vector indices or metadata desync.
    Returns (authorized_chunks, count_of_dropped_chunks).
    """
    authorized: List[RetrievedChunk] = []
    dropped_count = 0

    for chunk in chunks:
        meta_dict = {
            "is_active": chunk.is_active,
            "allowed_roles": chunk.allowed_roles,
            "allowed_departments": chunk.allowed_departments,
            "allowed_users": chunk.allowed_users,
        }
        if is_chunk_authorized(meta_dict, user, include_historical=include_historical):
            authorized.append(chunk)
        else:
            dropped_count += 1

    return authorized, dropped_count
