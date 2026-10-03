import os
import logging
from pathlib import Path
from sqlalchemy import create_engine, event, inspect
from sqlalchemy.orm import Session, declarative_base, sessionmaker

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
SQLITE_DB_PATH = BASE_DIR / "workforce_db.db"
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if not SQLALCHEMY_DATABASE_URL:
    postgres_host = os.getenv("POSTGRES_HOST") or os.getenv("RDS_HOSTNAME")
    if postgres_host:
        postgres_port = os.getenv("POSTGRES_PORT") or os.getenv("RDS_PORT", "5432")
        postgres_user = os.getenv("POSTGRES_USER") or os.getenv("RDS_USERNAME", "postgres")
        postgres_pass = os.getenv("POSTGRES_PASSWORD") or os.getenv("RDS_PASSWORD", "")
        postgres_db = os.getenv("POSTGRES_DB") or os.getenv("RDS_DB_NAME", "workforce_db")
        if postgres_pass:
            SQLALCHEMY_DATABASE_URL = f"postgresql+psycopg://{postgres_user}:{postgres_pass}@{postgres_host}:{postgres_port}/{postgres_db}"
        else:
            SQLALCHEMY_DATABASE_URL = f"postgresql+psycopg://{postgres_user}@{postgres_host}:{postgres_port}/{postgres_db}"

if not SQLALCHEMY_DATABASE_URL:
    # Default to single absolute SQLite file for local development so API and importer share dataset.
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{SQLITE_DB_PATH}"

if SQLALCHEMY_DATABASE_URL.startswith("postgresql://") and not SQLALCHEMY_DATABASE_URL.startswith("postgresql+"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    try:
        engine = create_engine(
            SQLALCHEMY_DATABASE_URL,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20
        )
        with engine.connect() as conn:
            logger.info("Successfully connected to AWS RDS PostgreSQL database.")
    except Exception as exc:
        logger.warning(f"Could not connect to PostgreSQL at {SQLALCHEMY_DATABASE_URL}: {exc}. Falling back to SQLite.")
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


@event.listens_for(Session, "after_flush")
def capture_mongodb_changes(session, flush_context):
    changes = session.info.setdefault("mongodb_changes", {})
    for instance in session.new.union(session.dirty):
        state = inspect(instance)
        if state.mapper.local_table.name == "auth_setup_codes":
            continue
        if instance in session.dirty and not session.is_modified(instance, include_collections=False):
            continue
        key = {column.key: getattr(instance, column.key) for column in state.mapper.primary_key}
        if not key or any(value is None for value in key.values()):
            continue
        document = {column.key: getattr(instance, column.key) for column in state.mapper.columns}
        document.pop("password_hash", None)
        operation_key = (state.mapper.local_table.name, tuple(key.items()))
        changes[operation_key] = ("upsert", state.mapper.local_table.name, key, document)

    for instance in session.deleted:
        state = inspect(instance)
        if state.mapper.local_table.name == "auth_setup_codes":
            continue
        key = {column.key: getattr(instance, column.key) for column in state.mapper.primary_key}
        if not key or any(value is None for value in key.values()):
            continue
        operation_key = (state.mapper.local_table.name, tuple(key.items()))
        changes[operation_key] = ("delete", state.mapper.local_table.name, key, None)


@event.listens_for(Session, "after_commit")
def sync_committed_mongodb_changes(session):
    changes = session.info.pop("mongodb_changes", {})
    if not changes:
        return
    from .mongodb import sync_sql_changes

    sync_sql_changes(changes.values())


@event.listens_for(Session, "after_rollback")
def discard_rolled_back_mongodb_changes(session):
    session.info.pop("mongodb_changes", None)
