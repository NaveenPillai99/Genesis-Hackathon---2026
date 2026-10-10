from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Facility, FacilityBooking, HPCAllocation, UserInduction, User
from app.schemas import (
    FacilityResponse, FacilityBookingCreate, FacilityBookingResponse,
    HPCCreate, HPCResponse
)
from app.auth import (
    get_current_user,
    require_permission,
    verify_facility_scope,
    record_audit,
    send_notification,
    get_user_permissions,
)
from app.config import (
    ROLE_STUDENT, ROLE_CLASS_REP, ROLE_FACULTY, ROLE_LAB_ASSISTANT,
    ROLE_LAB_ADMIN, ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN
)

router = APIRouter(prefix="/facilities", tags=["Facilities & Labs"])

class MaintenanceUpdate(BaseModel):
    is_under_maintenance: bool
    maintenance_reason: Optional[str] = None

class InductionGrant(BaseModel):
    user_id: str

@router.get("/", response_model=List[FacilityResponse])
def list_facilities(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # If Lab Assistant: show only assigned facilities if scoped
    if current_user.role == ROLE_LAB_ASSISTANT and current_user.assigned_facility_id:
        return db.query(Facility).filter(Facility.id == current_user.assigned_facility_id).all()
    return db.query(Facility).all()

@router.post("/book", response_model=FacilityBookingResponse)
def book_facility_slot(
    booking_in: FacilityBookingCreate,
    current_user: User = Depends(require_permission("facility.book")),
    db: Session = Depends(get_db)
):
    facility = db.query(Facility).filter(Facility.id == booking_in.facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")
    if facility.status == "maintenance":
        raise HTTPException(status_code=400, detail="Facility is currently offline for maintenance")

    # Check induction requirement
    if facility.induction_required:
        has_induction = db.query(UserInduction).filter(
            UserInduction.user_id == current_user.id,
            UserInduction.facility_id == facility.id
        ).first()
        if not has_induction and current_user.role not in [ROLE_LAB_ASSISTANT, ROLE_LAB_ADMIN, ROLE_SYS_ADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Safety Induction Required: You must complete the safety orientation with {facility.responsible_staff_name} before booking this equipment."
            )

    booking = FacilityBooking(
        facility_id=facility.id,
        user_id=current_user.id,
        user_name=current_user.name,
        booking_date=booking_in.booking_date,
        slot_id=booking_in.slot_id,
        duration_hours=booking_in.duration_hours,
        project_title=booking_in.project_title,
        status="booked"
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        "FACILITY_BOOKED", "FACILITY", facility.id,
        f"Reserved slot at {facility.name} on {booking_in.booking_date}"
    )

    return booking

@router.post("/{facility_id}/maintenance")
def set_maintenance(
    facility_id: str,
    update: MaintenanceUpdate,
    current_user: User = Depends(require_permission("facility.manage_assigned")),
    db: Session = Depends(get_db)
):
    facility = db.query(Facility).filter(Facility.id == facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")

    # RULE 6: A lab assistant cannot update unrelated equipment
    if current_user.role == ROLE_LAB_ASSISTANT:
        if not verify_facility_scope(current_user, facility_id, facility.responsible_staff_id, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Lab Assistant '{current_user.name}' is not assigned to maintain equipment in '{facility.name}'."
            )

    facility.status = "maintenance" if update.is_under_maintenance else "available"
    facility.maintenance_reason = update.maintenance_reason if update.is_under_maintenance else None
    db.commit()

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        "FACILITY_MAINTENANCE_TOGGLED", "FACILITY", facility.id,
        f"Status changed to {facility.status}. Reason: {update.maintenance_reason}"
    )

    return {"id": facility.id, "status": facility.status, "maintenance_reason": facility.maintenance_reason}

@router.post("/{facility_id}/induct")
def grant_induction(
    facility_id: str,
    grant: InductionGrant,
    current_user: User = Depends(require_permission("facility.certify_induction")),
    db: Session = Depends(get_db)
):
    facility = db.query(Facility).filter(Facility.id == facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")

    # If lab assistant, verify scope
    if current_user.role == ROLE_LAB_ASSISTANT:
        if not verify_facility_scope(current_user, facility_id, facility.responsible_staff_id, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Lab Assistant '{current_user.name}' cannot certify inductions for unassigned facility '{facility.name}'."
            )

    existing = db.query(UserInduction).filter(
        UserInduction.user_id == grant.user_id,
        UserInduction.facility_id == facility_id
    ).first()
    if existing:
        return {"message": "User is already inducted"}

    ind = UserInduction(
        user_id=grant.user_id,
        facility_id=facility_id,
        inducted_by=current_user.name
    )
    db.add(ind)
    db.commit()

    record_audit(db, current_user.id, current_user.name, current_user.role, "INDUCTION_GRANTED", "FACILITY", facility_id, f"Granted to user {grant.user_id}")
    send_notification(db, grant.user_id, "Facility Safety Induction Granted", f"You are now qualified to book {facility.name}.", category="facility", link="/facilities")

    return {"message": f"Successfully recorded safety induction for {facility.name}"}
