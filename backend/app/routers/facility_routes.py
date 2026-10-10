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
from app.auth import get_current_user, require_roles, record_audit, send_notification
from app.config import (
    ROLE_STUDENT, ROLE_CLASS_REP, ROLE_FACULTY, ROLE_LAB_ASSISTANT,
    ROLE_LAB_ADMIN, ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN
)

router = APIRouter(prefix="/facilities", tags=["Facilities & Labs"])

CAN_MANAGE_LABS = [ROLE_LAB_ASSISTANT, ROLE_LAB_ADMIN, ROLE_SYS_ADMIN]
CAN_APPROVE_HPC = [ROLE_FACULTY, ROLE_LAB_ADMIN, ROLE_SYS_ADMIN]

class MaintenanceUpdate(BaseModel):
    is_under_maintenance: bool
    maintenance_reason: Optional[str] = None

class InductionGrant(BaseModel):
    user_id: str

@router.get("/", response_model=List[FacilityResponse])
def list_facilities(db: Session = Depends(get_db)):
    return db.query(Facility).all()

@router.post("/book", response_model=FacilityBookingResponse)
def book_facility_slot(
    booking_in: FacilityBookingCreate,
    current_user: User = Depends(get_current_user),
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
        if not has_induction and current_user.role not in CAN_MANAGE_LABS:
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

@router.get("/hpc", response_model=List[HPCResponse])
def list_hpc_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role in CAN_APPROVE_HPC:
        return db.query(HPCAllocation).order_by(HPCAllocation.created_at.desc()).all()
    return db.query(HPCAllocation).filter(HPCAllocation.user_id == current_user.id).all()

@router.post("/hpc", response_model=HPCResponse)
def request_hpc_allocation(
    hpc_in: HPCCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Auto-approve threshold is 20 node-hours
    auto_approve = hpc_in.node_hours <= 20
    status_str = "approved" if auto_approve else "pending"

    hpc = HPCAllocation(
        user_id=current_user.id,
        user_name=current_user.name,
        project_name=hpc_in.project_name,
        node_hours=hpc_in.node_hours,
        supervisor_name=hpc_in.supervisor_name,
        reason=hpc_in.reason,
        status=status_str
    )
    db.add(hpc)
    db.commit()
    db.refresh(hpc)

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        "HPC_ALLOCATION_REQUEST", "HPC", hpc.id,
        f"Requested {hpc_in.node_hours} node-hours for '{hpc_in.project_name}' (Status: {status_str})"
    )

    if not auto_approve:
        # Notify faculty / lab admin
        facs = db.query(User).filter(User.role.in_(CAN_APPROVE_HPC)).all()
        for f in facs:
            send_notification(
                db, f.id, "Large HPC Allocation Request",
                f"{current_user.name} requested {hpc_in.node_hours} node-hours for '{hpc_in.project_name}'. Approval required.",
                category="facility", link="/facilities/hpc"
            )

    return hpc

@router.post("/hpc/{hpc_id}/review", response_model=HPCResponse)
def review_hpc(
    hpc_id: str,
    decision: str,  # 'approved', 'declined'
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in CAN_APPROVE_HPC:
        raise HTTPException(status_code=403, detail="Not authorized to approve HPC allocations")

    hpc = db.query(HPCAllocation).filter(HPCAllocation.id == hpc_id).first()
    if not hpc:
        raise HTTPException(status_code=404, detail="HPC allocation record not found")

    hpc.status = decision
    db.commit()
    db.refresh(hpc)

    record_audit(db, current_user.id, current_user.name, current_user.role, f"HPC_{decision.upper()}", "HPC", hpc.id, f"Decision by {current_user.name}")
    send_notification(
        db, hpc.user_id, f"HPC Allocation {decision.capitalize()}",
        f"Your compute request for '{hpc.project_name}' has been {decision}.",
        category="facility", link="/facilities/hpc"
    )

    return hpc

@router.post("/{facility_id}/maintenance")
def set_maintenance(
    facility_id: str,
    update: MaintenanceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in CAN_MANAGE_LABS:
        raise HTTPException(status_code=403, detail="Only Lab Staff can toggle maintenance status")

    facility = db.query(Facility).filter(Facility.id == facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")

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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in CAN_MANAGE_LABS:
        raise HTTPException(status_code=403, detail="Only Lab Staff can grant safety inductions")

    facility = db.query(Facility).filter(Facility.id == facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")

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
