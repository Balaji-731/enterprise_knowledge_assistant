"""SQLAlchemy database engine and session configuration.

Authoritative source of truth for Users, Roles, Document Access Policies, and Audit Logs.
Supports PostgreSQL (production) with automatic fallback to local SQLite for development.
"""

import os
from pathlib import Path
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# PostgreSQL by default or SQLite for local dev
DEFAULT_DB_PATH = Path("./storage/technova_enterprise.db").resolve()
DEFAULT_DB_PATH.parent.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    f"sqlite:///{DEFAULT_DB_PATH.as_posix()}",
)

# SQLite requires check_same_thread=False
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a database transaction session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
