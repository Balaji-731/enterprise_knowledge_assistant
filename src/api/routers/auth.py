"""Authentication router handling login, user profiles, and account management."""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.auth.dependencies import get_current_user, require_admin
from src.auth.schemas import TokenResponse, UserCreate, UserLogin, UserRead, UserStatusUpdate
from src.auth.security import create_access_token, hash_password, verify_password
from src.database.models import AuditLog, User
from src.database.session import get_db

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(
    payload: UserLogin,
    db: Session = Depends(get_db),
):
    """Authenticate with username and password, returning JWT bearer token."""
    user = db.query(User).filter(User.username == payload.username.strip().lower()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        # Audit log failed login
        audit = AuditLog(
            username=payload.username,
            action="AUTH_LOGIN",
            resource="/api/v1/auth/login",
            outcome="DENIED",
            details="Invalid username or password",
        )
        db.add(audit)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    # Issue JWT token
    token = create_access_token(data={"sub": user.id, "username": user.username, "role": user.role})

    # Audit log successful login
    audit = AuditLog(
        user_id=user.id,
        username=user.username,
        action="AUTH_LOGIN",
        resource="/api/v1/auth/login",
        outcome="SUCCESS",
        details=f"User {user.username} logged in successfully",
    )
    db.add(audit)
    db.commit()

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserRead.from_orm(user),
    )


@router.get("/me", response_model=UserRead)
def get_profile(current_user: User = Depends(get_current_user)):
    """Retrieve identity and permissions of the currently authenticated user."""
    return UserRead.from_orm(current_user)


@router.get("/users", response_model=List[UserRead], dependencies=[Depends(require_admin)])
def list_users(
    db: Session = Depends(get_db),
):
    """Admin-only endpoint to list all employee user accounts."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [UserRead.from_orm(u) for u in users]


@router.post("/users", response_model=UserRead)
def create_user(
    payload: UserCreate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only endpoint to provision a new user account."""
    clean_username = payload.username.strip().lower()
    clean_email = payload.email.strip().lower()

    existing = db.query(User).filter(
        (User.username == clean_username) | (User.email == clean_email)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered",
        )

    new_user = User(
        username=clean_username,
        email=clean_email,
        full_name=payload.full_name.strip(),
        hashed_password=hash_password(payload.password),
        role=payload.role.value,
        department=payload.department.strip().lower(),
    )
    db.add(new_user)
    db.flush()

    audit = AuditLog(
        user_id=admin_user.id,
        username=admin_user.username,
        action="USER_CREATE",
        resource=new_user.username,
        outcome="SUCCESS",
        details=f"Provisioned {new_user.full_name} (role={new_user.role}, dept={new_user.department})",
    )
    db.add(audit)
    db.commit()
    db.refresh(new_user)
    return UserRead.from_orm(new_user)


@router.patch("/users/{user_id}/status", response_model=UserRead)
def update_user_status(
    user_id: str,
    payload: UserStatusUpdate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only endpoint to activate or deactivate an employee account."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if target.id == admin_user.id and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate their own active account",
        )

    target.is_active = payload.is_active
    audit = AuditLog(
        user_id=admin_user.id,
        username=admin_user.username,
        action="USER_STATUS_UPDATE",
        resource=target.username,
        outcome="SUCCESS",
        details=f"Set account is_active={payload.is_active}",
    )
    db.add(audit)
    db.commit()
    db.refresh(target)
    return UserRead.from_orm(target)
