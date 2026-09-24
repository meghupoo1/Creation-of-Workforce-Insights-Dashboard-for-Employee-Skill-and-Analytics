import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = Path(__file__).resolve().parent.parent
SQLITE_DB_PATH = BASE_DIR / "workforce_db.db"
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if not SQLALCHEMY_DATABASE_URL:
    # Use a single absolute SQLite file for local development so the API and importer share the same dataset.
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{SQLITE_DB_PATH}"

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    try:
        engine = create_engine(SQLALCHEMY_DATABASE_URL)
        # Test connection
        with engine.connect() as conn:
            pass
    except Exception:
        SQLALCHEMY_DATABASE_URL = f"sqlite:///{SQLITE_DB_PATH}"
        engine = create_engine(
            SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
        )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

