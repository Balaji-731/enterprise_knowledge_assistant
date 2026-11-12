"""Database table initialization and default user seed script for TechNova."""

from src.auth.security import hash_password
from src.database.models import User
from src.database.session import Base, SessionLocal, engine
from src.ingestion.schemas import UserRole

DEFAULT_USERS = [
    {
        "username": "admin",
        "email": "admin@technova.com",
        "full_name": "System Administrator",
        "password": "admin123",
        "role": UserRole.ADMINISTRATOR.value,
        "department": "all",
    },
]


def init_db():
    """Create all relational tables and ensure bootstrap administrator exists."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        created_count = 0
        for u in DEFAULT_USERS:
            existing = db.query(User).filter(User.username == u["username"]).first()
            if not existing:
                new_user = User(
                    username=u["username"],
                    email=u["email"],
                    full_name=u["full_name"],
                    hashed_password=hash_password(u["password"]),
                    role=u["role"],
                    department=u["department"],
                )
                db.add(new_user)
                created_count += 1
        db.commit()
        return created_count
    finally:
        db.close()


if __name__ == "__main__":
    count = init_db()
    print(f"[+] Database initialized. Created {count} seed users.")
