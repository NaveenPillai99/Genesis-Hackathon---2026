from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import TimetableChangeRequest, TimetableSlot, Room, User
from app.schemas import (
    TimetableChangeCreate, TimetableChangeReview, TimetableChangeResponse, TimetableSlotResponse
)
from app.auth import (
    get_current_user,
    require_permission,
    verify_class_section_scope,
    record_audit,
    send_notification,
    get_user_permissions,
    get_user_department_scopes,
    get_user_class_scopes,
)
from app.config import (
    ROLE_CLASS_REP, ROLE_FACULTY, ROLE_CLASS_ADVISOR,
    ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN, ROLE_STUDENT,
    ROLE_HOD, ROLE_DEAN, ROLE_CAMPUS_DIRECTOR
)

router = APIRouter(prefix="/timetable", tags=["Academic Scheduling"])


def check_timetable_access(user: User, target_class: Optional[str], db: Session) -> bool:
    """
    Enforces the Timetable Visibility Matrix:
    - Campus Director, Sys Admin, Resource Admin: True for all
    - Student & Class Rep: True only if target_class == user.class_section
    - Class Advisor: True if target_class in assigned class sections
    - Faculty: True if user teaches in target_class or target_class in assigned classes
    - HOD: True if target_class belongs to HOD's department
    - Dean: True if target_class belongs to Dean's authorized school/department scope
    """
    if user.role in (ROLE_CAMPUS_DIRECTOR, ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN):
        return True

    if not target_class:
        return True

    target_class_norm = target_class.strip().lower()

    if user.role in (ROLE_STUDENT, ROLE_CLASS_REP):
        user_sec = (user.class_section or "").strip().lower()
        return user_sec == target_class_norm

    if user.role == ROLE_CLASS_ADVISOR:
        assigned = {c.lower() for c in get_user_class_scopes(user, db)}
        return target_class_norm in assigned

    if user.role == ROLE_FACULTY:
        # Check if faculty teaches this class section
        teaching_slots = db.query(TimetableSlot.class_section).filter(
            TimetableSlot.faculty.ilike(f"%{user.name}%")
        ).all()
        teaching_classes = {s[0].strip().lower() for s in teaching_slots if s[0]}
        assigned = {c.lower() for c in get_user_class_scopes(user, db)}
        return (target_class_norm in teaching_classes) or (target_class_norm in assigned)

    if user.role == ROLE_HOD:
        dept_scopes = {d.lower() for d in get_user_department_scopes(user, db)}
        if "*" in dept_scopes:
            return True
        slot_in_dept = db.query(TimetableSlot).filter(
            TimetableSlot.class_section.ilike(target_class),
            TimetableSlot.department.in_(list(dept_scopes))
        ).first()
        if slot_in_dept:
            return True
        for d in dept_scopes:
            if d in target_class_norm:
                return True
        return False

    if user.role == ROLE_DEAN:
        dept_scopes = {d.lower() for d in get_user_department_scopes(user, db)}
        if "*" in dept_scopes:
            return True
        for d in dept_scopes:
            if d in target_class_norm:
                return True
        return False

    return False


@router.get("/slots", response_model=List[TimetableSlotResponse])
def list_timetable_slots(
    room_id: Optional[str] = None,
    day: Optional[str] = None,
    class_section: Optional[str] = None,
    department: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Enforcement of Timetable Visibility Matrix:
    if current_user.role in (ROLE_STUDENT, ROLE_CLASS_REP):
        user_sec = current_user.class_section
        if class_section and class_section.strip().lower() != (user_sec or "").strip().lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Your account is restricted to your registered class '{user_sec}'. Access to '{class_section}' is not permitted."
            )
        if department and department.strip().lower() != (current_user.department or "").strip().lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Your account is restricted to department '{current_user.department}'. Access to '{department}' is not permitted."
            )
        effective_class = user_sec
    elif current_user.role == ROLE_CLASS_ADVISOR:
        if class_section:
            if not check_timetable_access(current_user, class_section, db):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Forbidden: Class Advisor access restricted to assigned classes."
                )
            effective_class = class_section
        else:
            effective_class = None
    elif current_user.role == ROLE_FACULTY:
        if class_section:
            if not check_timetable_access(current_user, class_section, db):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Forbidden: Faculty access restricted to assigned and taught classes."
                )
            effective_class = class_section
        else:
            effective_class = None
    elif current_user.role == ROLE_HOD:
        dept_scopes = {d.lower() for d in get_user_department_scopes(current_user, db)}
        if department:
            if "*" not in dept_scopes and department.strip().lower() not in dept_scopes:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Forbidden: Department '{department}' is outside your department scope."
                )
        if class_section:
            if not check_timetable_access(current_user, class_section, db):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Forbidden: HOD access is restricted to departments under your authority."
                )
            effective_class = class_section
        else:
            effective_class = None
    elif current_user.role == ROLE_DEAN:
        dept_scopes = {d.lower() for d in get_user_department_scopes(current_user, db)}
        if department:
            if "*" not in dept_scopes and department.strip().lower() not in dept_scopes:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Forbidden: Department '{department}' is outside your deanery scope."
                )
        if class_section:
            if not check_timetable_access(current_user, class_section, db):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Forbidden: Dean access is restricted to schools and departments within your administrative scope."
                )
            effective_class = class_section
        else:
            effective_class = None
    else:
        # Campus Director, Central Resource Admin, Sys Admin:
        effective_class = class_section

    query = db.query(TimetableSlot)
    if room_id:
        query = query.filter(TimetableSlot.room_id == room_id)
    if day:
        query = query.filter(TimetableSlot.day == day)
    if department:
        query = query.filter(TimetableSlot.department.ilike(department))
    if effective_class:
        query = query.filter(TimetableSlot.class_section.ilike(effective_class))
    elif current_user.role == ROLE_HOD and not department:
        dept_scopes = get_user_department_scopes(current_user, db)
        if "*" not in dept_scopes:
            query = query.filter(
                (TimetableSlot.department.in_(list(dept_scopes))) |
                (TimetableSlot.class_section.ilike(f"%{current_user.department}%"))
            )
    elif current_user.role == ROLE_DEAN and not department:
        dept_scopes = get_user_department_scopes(current_user, db)
        if "*" not in dept_scopes:
            from sqlalchemy import or_
            conditions = [TimetableSlot.department.in_(list(dept_scopes))]
            for d in dept_scopes:
                conditions.append(TimetableSlot.class_section.ilike(f"%{d}%"))
            query = query.filter(or_(*conditions))

    return query.all()


class TimetableSlotDirectCreate(BaseModel):
    room_id: str
    day: str
    slot_id: str
    code: str
    course_name: str
    faculty: str
    class_section: str
    advisor: Optional[str] = None


@router.get("/faculty-schedules", response_model=List[TimetableSlotResponse])
def get_faculty_schedules(
    faculty_name: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns teaching slots for faculty members within authorized scope according to matrix:
    - Students: 403 Forbidden (must not access faculty-wide timetables)
    - Class Rep: restricted to faculty teaching their assigned class
    - Faculty: own teaching slots and relevant cross-batch slots
    - Class Advisor: own slots + faculty teaching assigned class
    - HOD: faculty within department
    - Dean: faculty within authorized scope
    - Campus Director & Admins: all faculty
    """
    if current_user.role == ROLE_STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Students are not permitted to view faculty-wide timetables."
        )

    query = db.query(TimetableSlot)

    if current_user.role == ROLE_CLASS_REP:
        my_faculty = db.query(TimetableSlot.faculty).filter(
            TimetableSlot.class_section.ilike(current_user.class_section)
        ).distinct().all()
        allowed_fac = {f[0] for f in my_faculty if f[0]}
        if faculty_name and faculty_name not in allowed_fac:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You can only view schedules of faculty teaching your class."
            )
        query = query.filter(TimetableSlot.faculty.in_(list(allowed_fac)))
    elif current_user.role == ROLE_FACULTY:
        if not faculty_name or faculty_name.lower() == current_user.name.lower():
            query = query.filter(TimetableSlot.faculty.ilike(f"%{current_user.name}%"))
    elif current_user.role == ROLE_HOD:
        dept_scopes = get_user_department_scopes(current_user, db)
        if "*" not in dept_scopes:
            query = query.filter(
                (TimetableSlot.department.in_(list(dept_scopes))) |
                (TimetableSlot.class_section.ilike(f"%{current_user.department}%"))
            )
    elif current_user.role == ROLE_DEAN:
        dept_scopes = get_user_department_scopes(current_user, db)
        if "*" not in dept_scopes:
            from sqlalchemy import or_
            conditions = [TimetableSlot.department.in_(list(dept_scopes))]
            for d in dept_scopes:
                conditions.append(TimetableSlot.class_section.ilike(f"%{d}%"))
            query = query.filter(or_(*conditions))

    if faculty_name:
        query = query.filter(TimetableSlot.faculty.ilike(f"%{faculty_name}%"))

    return query.all()


@router.post("/slots", response_model=TimetableSlotResponse)
def direct_modify_timetable_slot(
    slot_in: TimetableSlotDirectCreate,
    current_user: User = Depends(require_permission("timetable.modify_official")),
    db: Session = Depends(get_db)
):
    """
    Direct timetable editing is restricted to administrators with 'timetable.modify_official'.
    Class representatives and students CANNOT directly edit the official timetable.
    """
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
    times = slot_times.get(slot_in.slot_id, ("09:00", "10:00"))

    new_slot = TimetableSlot(
        room_id=slot_in.room_id,
        day=slot_in.day,
        slot_id=slot_in.slot_id,
        start_time=times[0],
        end_time=times[1],
        code=slot_in.code,
        course_name=slot_in.course_name,
        faculty=slot_in.faculty,
        class_section=slot_in.class_section,
        advisor=slot_in.advisor,
    )
    db.add(new_slot)
    db.commit()
    db.refresh(new_slot)

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        "DIRECT_TIMETABLE_EDIT", "TIMETABLE_SLOT", new_slot.id,
        f"Direct modification of official timetable for {slot_in.class_section}"
    )
    return new_slot

@router.get("/change-requests", response_model=List[TimetableChangeResponse])
def list_change_requests(
    status: Optional[str] = None,
    class_section: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(TimetableChangeRequest)
    # Scoping: If user is class advisor, filter to their assigned section unless sysadmin
    if current_user.role == ROLE_CLASS_ADVISOR and current_user.class_section:
        query = query.filter(TimetableChangeRequest.class_section == current_user.class_section)
    elif current_user.role == ROLE_CLASS_REP and current_user.class_section:
        query = query.filter(TimetableChangeRequest.class_section == current_user.class_section)
    else:
        if class_section:
            query = query.filter(TimetableChangeRequest.class_section == class_section)

    if status:
        query = query.filter(TimetableChangeRequest.status == status)

    return query.order_by(TimetableChangeRequest.created_at.desc()).all()

@router.post("/change-requests", response_model=TimetableChangeResponse)
def submit_change_request(
    req_in: TimetableChangeCreate,
    current_user: User = Depends(require_permission("timetable.request_change")),
    db: Session = Depends(get_db)
):
    # Resource scoping: Class representative can only request for their assigned class section
    if current_user.role == ROLE_CLASS_REP:
        if not verify_class_section_scope(current_user, req_in.class_section, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Class Representative can only propose schedule changes for assigned section '{current_user.class_section}'.",
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
    current_user: User = Depends(require_permission("timetable.approve_change")),
    db: Session = Depends(get_db)
):
    req = db.query(TimetableChangeRequest).filter(TimetableChangeRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Change request not found")

    # RULE 9: A user cannot approve their own request unless a documented policy explicitly permits it
    if req.requester_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conflict of Interest: Users are prohibited from approving their own schedule change requests."
        )

    # RULE 5: A class advisor cannot manage unassigned classes
    if current_user.role == ROLE_CLASS_ADVISOR:
        if not verify_class_section_scope(current_user, req.class_section, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Class Advisor '{current_user.name}' is not assigned to class section '{req.class_section}'. Access denied."
            )

    if review_in.decision not in ["approved", "rejected", "modification_requested"]:
        raise HTTPException(status_code=400, detail="Decision must be 'approved', 'rejected', or 'modification_requested'")

    req.status = review_in.decision
    req.approver_id = current_user.id
    req.approver_name = current_user.name
    req.review_notes = review_in.review_notes
    req.updated_at = datetime.utcnow()

    # If approved: Update the official timetable slot
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
        times = slot_times.get(req.proposed_slot, ("09:00", "10:00"))

        if existing_slot:
            existing_slot.day = req.proposed_day
            existing_slot.slot_id = req.proposed_slot
            existing_slot.room_id = req.proposed_room_id
            existing_slot.start_time = times[0]
            existing_slot.end_time = times[1]

    db.commit()
    db.refresh(req)

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        f"TIMETABLE_REQUEST_{review_in.decision.upper()}", "TIMETABLE_REQUEST", req.id,
        f"Decision: {review_in.decision} by {current_user.name}. Notes: {review_in.review_notes}"
    )

    send_notification(
        db, req.requester_id, f"Timetable Proposal {review_in.decision.capitalize()}",
        f"Your request to move {req.course_name} has been {review_in.decision} by {current_user.name}.",
        category="timetable", link="/academic-scheduling"
    )

    return req
