"""Access Policy resolution engine for TechNova document ingestion.

Resolves access policies based on:
1. Corporate defaults by category (HR, Engineering, Finance, Operations, Admin).
2. Manual access policy overrides defined during upload.
"""

from src.ingestion.schemas import AccessPolicy, DocumentCategory, UserRole

# Deterministic default access matrix by document category
DEFAULT_CATEGORY_POLICIES: dict[DocumentCategory, AccessPolicy] = {
    DocumentCategory.HR: AccessPolicy(
        allowed_roles=[
            UserRole.EMPLOYEE,
            UserRole.HR,
            UserRole.MANAGER,
            UserRole.ADMINISTRATOR,
        ],
        allowed_departments=["all"],
    ),
    DocumentCategory.ENGINEERING: AccessPolicy(
        allowed_roles=[
            UserRole.EMPLOYEE,
            UserRole.HR,
            UserRole.MANAGER,
            UserRole.ADMINISTRATOR,
        ],
        allowed_departments=["engineering"],
    ),
    DocumentCategory.FINANCE: AccessPolicy(
        allowed_roles=[
            UserRole.MANAGER,
            UserRole.ADMINISTRATOR,
        ],
        allowed_departments=["finance", "executive"],
    ),
    DocumentCategory.OPERATIONS: AccessPolicy(
        allowed_roles=[
            UserRole.EMPLOYEE,
            UserRole.HR,
            UserRole.MANAGER,
            UserRole.ADMINISTRATOR,
        ],
        allowed_departments=["operations"],
    ),
    DocumentCategory.ADMINISTRATION: AccessPolicy(
        allowed_roles=[
            UserRole.ADMINISTRATOR,
        ],
        allowed_departments=["all"],
    ),
}


def resolve_access_policy(
    category: DocumentCategory | str,
    manual_policy: AccessPolicy | None = None,
) -> AccessPolicy:
    """Resolve effective access policy for a document version.
    
    If manual_policy is provided, it overrides defaults.
    Otherwise, returns the deterministic default rule for the category.
    """
    if manual_policy is not None:
        return manual_policy

    # Normalize category enum
    if isinstance(category, str):
        try:
            cat_enum = DocumentCategory(category.upper())
        except ValueError:
            cat_enum = DocumentCategory.ADMINISTRATION
    else:
        cat_enum = category

    return DEFAULT_CATEGORY_POLICIES.get(
        cat_enum,
        AccessPolicy(
            allowed_roles=[UserRole.ADMINISTRATOR],
            allowed_departments=["admin"],
        ),
    )
