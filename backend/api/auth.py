import hashlib
import hmac
import os
import secrets
import time
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, validator
from sqlalchemy import func
from sqlalchemy.orm import Session

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from database import models
from database.database import get_db

SECRET_KEY = os.getenv("JWT_SECRET_KEY") or secrets.token_urlsafe(32)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24
SETUP_CODE_EXPIRE_MINUTES = 30
ADMIN_ROLES = {"ADMIN", "SYSTEM_ADMIN", "HR_ADMIN", "HR"}
BOOTSTRAP_ADMIN_ROLES = {"ADMIN", "SYSTEM_ADMIN"}

pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    pbkdf2_sha256__default_rounds=600_000,
    deprecated="auto",
)
security_bearer = HTTPBearer(auto_error=False)
router = APIRouter(prefix="/api/auth", tags=["auth"])


def normalize_email(email: str) -> str:
    if not isinstance(email, str):
        raise ValueError("Enter a valid email address")
    return email.strip().lower()


def normalize_role(role: str) -> str:
    return role.upper().replace(" ", "_").replace("-", "_")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: str = "EMPLOYEE"

    _normalize_email = validator("email", allow_reuse=True, pre=True)(normalize_email)

    @validator("password")
    def validate_password_size(cls, password):
        if not password or len(password.encode("utf-8")) > 72:
            raise ValueError("Password must contain 1 to 72 UTF-8 bytes")
        return password


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    email: str
    name: str
    employee_id: str


class IssueSetupCodeRequest(BaseModel):
    email: EmailStr

    _normalize_email = validator("email", allow_reuse=True, pre=True)(normalize_email)


class PasswordSetupRequest(IssueSetupCodeRequest):
    setup_code: str
    new_password: str

    @validator("new_password")
    def validate_new_password(cls, password):
        if len(password) < 8 or len(password.encode("utf-8")) > 72:
            raise ValueError("Password must be at least 8 characters and no more than 72 UTF-8 bytes")
        return password


class IssueSetupCodeResponse(BaseModel):
    setup_code: str
    expires_in_minutes: int


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except (ValueError, TypeError):
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> dict:
    if not auth or not auth.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        payload = jwt.decode(auth.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization token") from exc

    employee = db.query(models.Employee).filter(models.Employee.id == payload.get("sub")).first()
    if (
        not employee
        or str(employee.employment_status or "Active").lower() != "active"
        or not _role_matches(str(payload.get("role", "")), employee.access_role or "")
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization token")
    return payload


def require_role(allowed_roles: list):
    def role_checker(current_user: dict = Depends(get_current_user)):
        user_role = normalize_role(str(current_user.get("role", "")))
        if user_role not in {normalize_role(role) for role in allowed_roles}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )
        return current_user

    return role_checker


def _role_matches(requested_role: str, actual_role: str) -> bool:
    requested = normalize_role(requested_role)
    actual = normalize_role(actual_role)
    valid_roles = {
        "ADMIN": {"ADMIN", "SYSTEM_ADMIN"},
        "SYSTEM_ADMIN": {"ADMIN", "SYSTEM_ADMIN"},
        "HR": {"HR", "HR_ADMIN", "HR_ADMINISTRATOR"},
        "HR_ADMIN": {"HR", "HR_ADMIN", "HR_ADMINISTRATOR"},
        "HR_ADMINISTRATOR": {"HR", "HR_ADMIN", "HR_ADMINISTRATOR"},
        "MANAGER": {"MANAGER"},
        "EMPLOYEE": {"EMPLOYEE"},
    }
    return actual in valid_roles.get(requested, set())


def _is_bootstrap_admin(employee: models.Employee, password: str) -> bool:
    bootstrap_email = os.getenv("ADMIN_EMAIL", "admin@gmail.com").strip().lower()
    bootstrap_password = os.getenv("ADMIN_INITIAL_PASSWORD", "")
    return (
        bool(bootstrap_password)
        and len(bootstrap_password.encode("utf-8")) >= 8
        and employee.email.strip().lower() == bootstrap_email
        and normalize_role(str(employee.access_role or "")) in BOOTSTRAP_ADMIN_ROLES
        and hmac.compare_digest(password, bootstrap_password)
    )


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    employee = db.query(models.Employee).filter(
        func.lower(models.Employee.email) == req.email
    ).first()
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
    )
    if not employee or str(employee.employment_status or "Active").lower() != "active":
        raise invalid_credentials

    is_bootstrap_login = not employee.password_hash and _is_bootstrap_admin(employee, req.password)
    if not is_bootstrap_login and not verify_password(req.password, employee.password_hash):
        raise invalid_credentials
    if not _role_matches(req.role, employee.access_role or ""):
        raise invalid_credentials

    if is_bootstrap_login:
        employee.password_hash = hash_password(req.password)

    role = normalize_role(employee.access_role)
    token_data = {
        "sub": employee.id,
        "email": employee.email,
        "role": role,
        "name": f"{employee.first_name} {employee.last_name}".strip(),
    }
    access_token = create_access_token(token_data)
    audit_entry = models.SecurityAuditLog(
        id=f"AUDIT-{int(time.time() * 1000)}",
        user_id=employee.id,
        action="USER_LOGIN_JWT",
        resource="AUTH_SERVICE",
        ip_address="127.0.0.1",
        timestamp=datetime.utcnow(),
        status="SUCCESS",
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(employee)

    return LoginResponse(
        access_token=access_token,
        role=role,
        email=employee.email,
        name=f"{employee.first_name} {employee.last_name}".strip(),
        employee_id=employee.id,
    )


@router.post("/setup-codes", response_model=IssueSetupCodeResponse)
def issue_setup_code(
    req: IssueSetupCodeRequest,
    db: Session = Depends(get_db),
    _current_user: dict = Depends(require_role(ADMIN_ROLES)),
):
    employee = db.query(models.Employee).filter(
        func.lower(models.Employee.email) == req.email
    ).first()
    if not employee or str(employee.employment_status or "Active").lower() != "active":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active employee not found")

    now = datetime.utcnow()
    db.query(models.AuthSetupCode).filter(
        models.AuthSetupCode.employee_id == employee.id,
        models.AuthSetupCode.used_at.is_(None),
    ).update({"used_at": now}, synchronize_session=False)

    setup_code = secrets.token_urlsafe(32)
    db.add(models.AuthSetupCode(
        id=str(uuid.uuid4()),
        employee_id=employee.id,
        code_hash=hashlib.sha256(setup_code.encode("utf-8")).hexdigest(),
        expires_at=now + timedelta(minutes=SETUP_CODE_EXPIRE_MINUTES),
    ))
    db.commit()
    return IssueSetupCodeResponse(
        setup_code=setup_code,
        expires_in_minutes=SETUP_CODE_EXPIRE_MINUTES,
    )


@router.post("/password/setup")
def set_password(req: PasswordSetupRequest, db: Session = Depends(get_db)):
    employee = db.query(models.Employee).filter(
        func.lower(models.Employee.email) == req.email
    ).first()
    invalid_code = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired setup code",
    )
    if not employee or str(employee.employment_status or "Active").lower() != "active":
        raise invalid_code

    code_hash = hashlib.sha256(req.setup_code.encode("utf-8")).hexdigest()
    setup_codes = db.query(models.AuthSetupCode).filter(
        models.AuthSetupCode.employee_id == employee.id,
        models.AuthSetupCode.used_at.is_(None),
        models.AuthSetupCode.expires_at > datetime.utcnow(),
    ).all()
    setup_code = next(
        (item for item in setup_codes if hmac.compare_digest(item.code_hash, code_hash)),
        None,
    )
    if setup_code is None:
        raise invalid_code

    now = datetime.utcnow()
    password_hash = hash_password(req.new_password)
    consumed = db.query(models.AuthSetupCode).filter(
        models.AuthSetupCode.id == setup_code.id,
        models.AuthSetupCode.used_at.is_(None),
        models.AuthSetupCode.expires_at > now,
    ).update({"used_at": now}, synchronize_session=False)
    if consumed != 1:
        db.rollback()
        raise invalid_code

    employee.password_hash = password_hash
    db.commit()
    return {"message": "Password set successfully"}


@router.get("/me")
def get_user_profile(user: dict = Depends(get_current_user)):
    return user
