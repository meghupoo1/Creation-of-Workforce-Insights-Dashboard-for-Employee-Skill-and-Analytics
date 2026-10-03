import os
import re
import logging
from pathlib import Path
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
SQLITE_DB_PATH = BASE_DIR / "workforce_db.db"

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower().strip()
IS_PRODUCTION = (ENVIRONMENT == "production")


def mask_url_passwords(url_str: str) -> str:
    """Mask password in database URL or error string for secure logging."""
    if not url_str:
        return ""
    return re.sub(r'(://[^:]+:)[^@]+(@)', r'\1*****\2', str(url_str))


def _get_database_url() -> str:
    """Retrieve database URL from environment or RDS parameters."""
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        postgres_host = os.getenv("POSTGRES_HOST") or os.getenv("RDS_HOSTNAME")
        if postgres_host:
            postgres_port = os.getenv("POSTGRES_PORT") or os.getenv("RDS_PORT", "5432")
            postgres_user = os.getenv("POSTGRES_USER") or os.getenv("RDS_USERNAME", "postgres")
            postgres_pass = os.getenv("POSTGRES_PASSWORD") or os.getenv("RDS_PASSWORD", "")
            postgres_db = os.getenv("POSTGRES_DB") or os.getenv("RDS_DB_NAME", "workforce_db")
            if postgres_pass:
                db_url = f"postgresql+psycopg://{postgres_user}:{postgres_pass}@{postgres_host}:{postgres_port}/{postgres_db}"
            else:
                db_url = f"postgresql+psycopg://{postgres_user}@{postgres_host}:{postgres_port}/{postgres_db}"

    if db_url and db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

    return db_url or ""


raw_db_url = _get_database_url()

if IS_PRODUCTION:
    if not raw_db_url or raw_db_url.startswith("sqlite"):
        error_msg = "[DATABASE] Production configuration error: ENVIRONMENT=production requires a valid PostgreSQL DATABASE_URL or RDS configuration. SQLite is disabled in production."
        logger.error(error_msg)
        print(error_msg)
        raise RuntimeError(error_msg)

    SQLALCHEMY_DATABASE_URL = raw_db_url
    try:
        engine = create_engine(
            SQLALCHEMY_DATABASE_URL,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
            connect_args={"connect_timeout": 3}
        )
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        msg = f"[DATABASE] Using PostgreSQL database at {mask_url_passwords(SQLALCHEMY_DATABASE_URL)}"
        logger.info(msg)
        print(msg)
    except Exception as exc:
        masked_err = mask_url_passwords(str(exc))
        error_msg = f"[DATABASE] Production connection error: Failed to connect to PostgreSQL at {mask_url_passwords(SQLALCHEMY_DATABASE_URL)}: {masked_err}"
        logger.error(error_msg)
        print(error_msg)
        raise RuntimeError(error_msg) from exc

else:
    # Development / Local mode
    if raw_db_url and not raw_db_url.startswith("sqlite"):
        try:
            engine = create_engine(
                raw_db_url,
                pool_pre_ping=True,
                pool_size=10,
                max_overflow=20,
                connect_args={"connect_timeout": 3}
            )
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            SQLALCHEMY_DATABASE_URL = raw_db_url
            msg = f"[DATABASE] Using PostgreSQL database at {mask_url_passwords(SQLALCHEMY_DATABASE_URL)}"
            logger.info(msg)
            print(msg)
        except Exception as exc:
            masked_err = mask_url_passwords(str(exc))
            logger.warning(f"[DATABASE] Development PostgreSQL connection failed ({masked_err}). Falling back to SQLite.")
            SQLALCHEMY_DATABASE_URL = f"sqlite:///{SQLITE_DB_PATH}"
            engine = create_engine(
                SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
            )
            msg = f"[DATABASE] Using SQLite database at {SQLITE_DB_PATH}"
            logger.info(msg)
            print(msg)
    else:
        SQLALCHEMY_DATABASE_URL = raw_db_url or f"sqlite:///{SQLITE_DB_PATH}"
        engine = create_engine(
            SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
        )
        msg = f"[DATABASE] Using SQLite database at {engine.url.database}"
        logger.info(msg)
        print(msg)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection():
    """Database health check function confirming connectivity without exposing passwords."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        backend_type = "postgresql" if "sqlite" not in str(engine.url) else "sqlite"
        return {
            "status": "healthy",
            "backend": backend_type,
            "database_url": mask_url_passwords(str(engine.url))
        }
    except Exception as exc:
        return {
            "status": "unhealthy",
            "error": mask_url_passwords(str(exc))
        }


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
