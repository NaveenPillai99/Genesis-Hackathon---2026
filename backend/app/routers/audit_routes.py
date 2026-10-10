from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import AuditLog, User
from app.schemas import AuditLogResponse
from app.auth import get_current_user
from app.config import ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN

router = APIRouter(prefix="/audit", tags=["Audit Trail"])

@router.get("/", response_model=List[AuditLogResponse])
def get_audit_trail(
    action: Optional[str] = None,
    actor_id: Optional[str] = None,
    limit: int = Query(50, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Restricted to Central Resource Admin and System Administrator."""
    if current_user.role not in [ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN]:
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: Only Central Resource Admin and System Admin can inspect audit logs."
        )

    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action.contains(action))
    if actor_id:
        query = query.filter(AuditLog.actor_id == actor_id)

    return query.order_by(AuditLog.timestamp.desc()).limit(limit).all()
