"""FastAPI Authentication and RBAC Authorization Dependencies."""

from typing import Callable, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from src.auth.security import decode_access_token
from src.database.models import User
from src.database.session import get_db
from src.ingestion.schemas import UserRole
from src.retrieval.schemas import UserContext

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Validate bearer JWT token and return active authenticated User model."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or session expired.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except Exception:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or not found.",
        )
    return user


def get_current_user_context(
    current_user: User = Depends(get_current_user),
) -> UserContext:
    """Transform SQLAlchemy User into domain UserContext for Retrieval & RAG engines."""
    try:
        role_enum = UserRole(current_user.role.lower())
    except ValueError:
        role_enum = UserRole.EMPLOYEE

    return UserContext(
        user_id=current_user.id,
        username=current_user.username,
        role=role_enum,
        department=current_user.department.lower(),
    )


def require_role(allowed_roles: List[UserRole]) -> Callable[[User], User]:
    """Dependency factory ensuring user has at least one of the specified roles."""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role_str = current_user.role.lower()
        allowed_str = [r.value.lower() for r in allowed_roles]

        # Administrators always satisfy role requirements
        if user_role_str == UserRole.ADMINISTRATOR.value or user_role_str in allowed_str:
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Requires one of roles: {[r.value for r in allowed_roles]}",
        )

    return role_checker


# Shortcuts
require_admin = require_role([UserRole.ADMINISTRATOR])
require_hr_or_admin = require_role([UserRole.HR, UserRole.ADMINISTRATOR])
require_manager_or_admin = require_role([UserRole.MANAGER, UserRole.ADMINISTRATOR])
