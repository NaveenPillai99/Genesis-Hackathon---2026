from datetime import datetime, timedelta
from typing import List, Optional, Set
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models import User, AuditLog, Notification, RolePermission, ResourceAssignment

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/token", auto_error=False)

# Core RBAC Permission Definitions
ROLE_PERMISSIONS: dict[str, set[str]] = {
    "student": {
        "classroom.view",
        "timetable.view",
        "event.view",
        "event.request.create",
        "event.request.view_own",
        "facility.view",
        "facility.book",
        "hpc.view_public",
        "hpc.request_allocation",
        "hpc.view_own_allocations",
        "lost_found.view",
        "lost_found.report",
        "lost_found.claim",
    },
    "class_rep": {
        "classroom.view",
        "timetable.view",
        "classroom.book",
        "timetable.request_change",
        "event.view",
        "event.request.create",
        "event.request.view_own",
        "facility.view",
        "facility.book",
        "hpc.view_public",
        "hpc.request_allocation",
        "hpc.view_own_allocations",
        "lost_found.view",
        "lost_found.report",
        "lost_found.claim",
    },
    "class_advisor": {
        "classroom.view",
        "timetable.view",
        "timetable.review_change",
        "timetable.approve_change",
        "lost_found.view",
        "lost_found.manage_classroom_custody",
        "lost_found.report",
    },
    "faculty": {
        "classroom.view",
        "timetable.view",
        "classroom.book",
        "timetable.request_change",
        "event.view",
        "event.request.create",
        "event.request.view_own",
        "facility.view",
        "hpc.view_public",
        "hpc.request_allocation",
        "hpc.view_own_allocations",
        "lost_found.view",
        "lost_found.report",
    },
    "hpc_faculty": {
        "hpc.view_public",
        "hpc.request_allocation",
        "hpc.view_own_allocations",
        "hpc.manage_nodes",
        "hpc.manage_telemetry",
        "hpc.review_allocations",
        "hpc.approve_allocations",
        "hpc.manage_quotas",
        "hpc.record_maintenance",
        "facility.view",
    },
    "lab_assistant": {
        "facility.view",
        "facility.book",
        "facility.manage_assigned",
        "facility.certify_induction",
        "classroom.view",
    },
    "lab_admin": {
        "facility.view",
        "facility.manage_assigned",
        "facility.manage_all",
        "facility.certify_induction",
        "hpc.view_public",
        "classroom.view",
    },
    "resource_admin": {
        "classroom.view",
        "classroom.manage",
        "classroom.book",
        "timetable.view",
        "timetable.request_change",
        "event.view",
        "event.request.create",
        "event.request.view_own",
        "event.request.review",
        "event.request.approve",
        "event.request.reject",
        "event.venue.manage",
        "event.publish",
        "facility.view",
        "audit.view",
    },
    "lost_property_handler": {
        "lost_found.view",
        "lost_found.report",
        "lost_found.manage_welfare_custody",
        "lost_found.verify_claim",
        "lost_found.handover",
        "classroom.view",
    },
    "sys_admin": {
        "audit.view",
        "governance.sync",
        "users.manage",
        "system.configure",
        "classroom.view",
        "facility.view",
    },
    # Backwards compatibility alias
    "admin": {
        "classroom.view",
        "classroom.manage",
        "classroom.book",
        "event.view",
        "event.request.view_own",
        "event.request.review",
        "event.request.approve",
        "event.request.reject",
        "event.venue.manage",
        "event.publish",
        "facility.view",
        "audit.view",
    }
}

def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user

def get_user_permissions(user: User, db: Session = None) -> set[str]:
    """
    Returns the union of all permissions for this user:
    Default role permissions + any explicit database mappings.
    """
    perms = set(ROLE_PERMISSIONS.get(user.role, set()))
    if db:
        db_perms = (
            db.query(RolePermission.permission_id)
            .filter(RolePermission.role_id == user.role)
            .all()
        )
        for p in db_perms:
            perms.add(p[0])
    return perms

def require_permission(required_perm: str):
    """
    Dependency that enforces RBAC permission check.
    """
    def permission_checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        user_perms = get_user_permissions(current_user, db)
        if required_perm not in user_perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Action requires permission '{required_perm}'. Role '{current_user.role}' does not possess this authority."
            )
        return current_user
    return permission_checker

def require_any_permission(required_perms: List[str]):
    def checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        user_perms = get_user_permissions(current_user, db)
        if not any(p in user_perms for p in required_perms):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Action requires one of {required_perms}."
            )
        return current_user
    return checker

def require_roles(allowed_roles: List[str]):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: role '{current_user.role}' not in permitted roles {allowed_roles}"
            )
        return current_user
    return role_checker

def verify_class_section_scope(user: User, target_section: str, db: Session = None) -> bool:
    """
    Verifies if user has authority over a specific class section.
    """
    if user.class_section and user.class_section.strip().lower() == target_section.strip().lower():
        return True
    if db:
        assignment = (
            db.query(ResourceAssignment)
            .filter(
                ResourceAssignment.user_id == user.id,
                ResourceAssignment.scope_type == "class_section",
                ResourceAssignment.scope_id == target_section
            )
            .first()
        )
        if assignment:
            return True
    return False

def verify_facility_scope(user: User, facility_id: str, responsible_staff_id: str = None, db: Session = None) -> bool:
    """
    Verifies if a lab assistant or admin has authority over a specific facility.
    """
    # Central lab admins may have lab-wide scope
    if user.role == "lab_admin":
        return True
    if user.assigned_facility_id == facility_id:
        return True
    if responsible_staff_id and responsible_staff_id == user.id:
        return True
    if db:
        assignment = (
            db.query(ResourceAssignment)
            .filter(
                ResourceAssignment.user_id == user.id,
                ResourceAssignment.scope_type == "facility",
                ResourceAssignment.scope_id == facility_id
            )
            .first()
        )
        if assignment:
            return True
    return False

def record_audit(
    db: Session,
    actor_id: str,
    actor_name: str,
    actor_role: str,
    action: str,
    entity_type: str,
    entity_id: str,
    details: str = None
):
    audit = AuditLog(
        actor_id=actor_id,
        actor_name=actor_name,
        actor_role=actor_role,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details
    )
    db.add(audit)
    db.commit()

def send_notification(
    db: Session,
    recipient_id: str,
    title: str,
    message: str,
    category: str = "system",
    link: str = None
):
    notification = Notification(
        recipient_id=recipient_id,
        title=title,
        message=message,
        category=category,
        link=link
    )
    db.add(notification)
    db.commit()
