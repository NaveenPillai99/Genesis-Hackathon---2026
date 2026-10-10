from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import TimetableChangeRequest, TimetableSlot, Room, User
from app.schemas import (
    TimetableChangeCreate, TimetableChangeReview, TimetableChangeResponse
)
from app.auth import get_current_user, require_roles, record_audit, send_notification
from app.config import (
    ROLE_CLASS_REP, ROLE_FACULTY, ROLE_CLASS_ADVISOR,
    ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN
)

router = APIRouter(prefix="/timetable", tags=["Academic Scheduling"])

CAN_REQUEST_SCHEDULE_CHANGE = [ROLE_CLASS_REP, ROLE_FACULTY, ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN]
CAN_APPROVE_SCHEDULE_CHANGE = [ROLE_CLASS_ADVISOR, ROLE_FACULTY, ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN]

@router.get("/change-requests", response_model=List[TimetableChangeResponse])
def list_change_requests(
    status: Optional[str] = None,
    class_section: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(TimetableChangeRequest)
    if status:
        query = query.filter(TimetableChangeRequest.status == status)
    if class_section:
        query = query.filter(TimetableChangeRequest.class_section == class_section)
    return query.order_by(TimetableChangeRequest.created_at.desc()).all()

@router.post("/change-requests", response_model=TimetableChangeResponse)
def submit_change_request(
    req_in: TimetableChangeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in CAN_REQUEST_SCHEDULE_CHANGE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{current_user.role}' cannot submit timetable change proposals."
        )

    # Validate room exists
    room = db.query(Room).filter(Room.id == req_in.proposed_room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Proposed room does not exist")

    # Check clash in target slot
    target_slot_occupied = db.query(TimetableSlot).filter(
        TimetableSlot.room_id == req_in.proposed_room_id,
        TimetableSlot.day == req_in.proposed_day,
        TimetableSlot.slot_id == req_in.proposed_slot
    ).first()

    if target_slot_occupied:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Target room {room.name} already has a scheduled class ({target_slot_occupied.course_name}) on {req_in.proposed_day} {req_in.proposed_slot}."
        )

    req = TimetableChangeRequest(
        course_code=req_in.course_code,
        course_name=req_in.course_name,
        class_section=req_in.class_section,
        requester_id=current_user.id,
        requester_name=current_user.name,
        original_day=req_in.original_day,
        original_slot=req_in.original_slot,
        original_room_id=req_in.original_room_id,
        proposed_day=req_in.proposed_day,
        proposed_slot=req_in.proposed_slot,
        proposed_room_id=req_in.proposed_room_id,
        proposed_date=req_in.proposed_date,
        reason=req_in.reason,
        status="pending"
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        "TIMETABLE_CHANGE_PROPOSED", "TIMETABLE_REQUEST", req.id,
        f"Proposed reschedule for {req_in.course_name} from {req_in.original_day} to {req_in.proposed_day}"
    )

    # Notify Class Advisors & Faculty
    advisors = db.query(User).filter(User.role.in_([ROLE_CLASS_ADVISOR, ROLE_FACULTY])).all()
    for adv in advisors:
        send_notification(
            db, adv.id, "New Timetable Reschedule Proposal",
            f"{current_user.name} proposed moving {req_in.course_name} to {req_in.proposed_day} ({req_in.proposed_slot}).",
            category="timetable", link="/academic-scheduling"
        )

    return req

@router.post("/change-requests/{request_id}/review", response_model=TimetableChangeResponse)
def review_change_request(
    request_id: str,
    review_in: TimetableChangeReview,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in CAN_APPROVE_SCHEDULE_CHANGE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{current_user.role}' is not authorized to approve timetable modifications."
        )

    req = db.query(TimetableChangeRequest).filter(TimetableChangeRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Change request not found")

    if review_in.decision not in ["approved", "rejected", "modification_requested"]:
        raise HTTPException(status_code=400, detail="Decision must be 'approved', 'rejected', or 'modification_requested'")

    req.status = review_in.decision
    req.approver_id = current_user.id
    req.approver_name = current_user.name
    req.review_notes = review_in.review_notes
    req.updated_at = datetime.utcnow()

    # If approved: Update the timetable row!
    if review_in.decision == "approved":
        existing_slot = db.query(TimetableSlot).filter(
            TimetableSlot.day == req.original_day,
            TimetableSlot.slot_id == req.original_slot,
            TimetableSlot.code == req.course_code
        ).first()

        slot_times = {
            "slot2": ("08:50", "09:40"),
            "slot3": ("09:40", "10:30"),
            "slot4": ("10:45", "11:35"),
            "slot5": ("11:35", "12:25"),
            "slot6": ("12:25", "13:15"),
            "slot8": ("14:05", "14:55"),
            "slot9": ("14:55", "15:45"),
            "slot10": ("15:45", "16:35"),
        }
        st, et = slot_times.get(req.proposed_slot, ("09:00", "10:00"))

        if existing_slot:
            existing_slot.day = req.proposed_day
            existing_slot.slot_id = req.proposed_slot
            existing_slot.room_id = req.proposed_room_id
            existing_slot.start_time = st
            existing_slot.end_time = et
        else:
            # Create new slot
            new_slot = TimetableSlot(
                room_id=req.proposed_room_id,
                day=req.proposed_day,
                slot_id=req.proposed_slot,
                start_time=st,
                end_time=et,
                code=req.course_code,
                course_name=req.course_name,
                class_section=req.class_section,
                faculty=current_user.name
            )
            db.add(new_slot)

    db.commit()
    db.refresh(req)

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        f"TIMETABLE_REQUEST_{req.status.upper()}", "TIMETABLE_REQUEST", req.id,
        f"Decision by {current_user.name}: {req.status}. Notes: {req.review_notes or 'None'}"
    )

    send_notification(
        db, req.requester_id, f"Timetable Proposal {req.status.capitalize()}",
        f"Your request to reschedule {req.course_name} has been {req.status} by {current_user.name}.",
        category="timetable", link="/academic-scheduling"
    )

    return req
