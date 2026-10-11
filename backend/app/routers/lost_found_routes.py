import json
from datetime import datetime
from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app.database import get_db
from app.models import (
    LostFoundItem, ItemClaim, CustodyLog, TimetableSlot, Room, User,
    Department, DepartmentHandler, ItemMatchCandidate
)
from app.schemas import (
    LostFoundCreate, LostFoundResponse, ClaimCreate, ClaimReview,
    HandoverUpdate, ItemClaimResponse, DepartmentResponse, CustodyLogResponse,
    InPersonVerificationRequest, CustodyTransferRequest,
    StudentLostReportResponse, StudentFoundReportResponse, StudentPublicFoundResponse,
    HandlerMatchCandidateDetail
)
from app.auth import get_current_user, require_roles, record_audit, send_notification
from app.config import (
    ROLE_STUDENT, ROLE_CLASS_REP, ROLE_CLASS_ADVISOR, ROLE_FACULTY,
    ROLE_LOST_PROPERTY_HANDLER, ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN
)
from app.matching_engine import run_cross_department_matching

router = APIRouter(prefix="/lost-found", tags=["Lost & Found"])

CAN_PROCESS_CLAIMS = [
    ROLE_CLASS_ADVISOR, ROLE_FACULTY, ROLE_LOST_PROPERTY_HANDLER,
    ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN
]

DAY_NAME_MAP = {
    0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday", 4: "Friday", 5: "Saturday", 6: "Sunday"
}

DEPARTMENT_SEEDS = [
    {"id": "dept-cse", "department_name": "Department of Computer Science & Engineering", "code": "CSE", "handler_id": "user-faculty-1", "handler_name": "Dr Thilaga M (CSE Handler)"},
    {"id": "dept-math", "department_name": "Department of Mathematics", "code": "MATH", "handler_id": "user-classadvisor-1", "handler_name": "Dr Devika (Mathematics Handler)"},
    {"id": "dept-ece", "department_name": "Department of Electronics & Communication", "code": "ECE", "handler_id": "user-faculty-1", "handler_name": "ECE Department Desk"},
    {"id": "dept-mech", "department_name": "Department of Mechanical Engineering", "code": "MECH", "handler_id": "user-faculty-1", "handler_name": "Mechanical Department Desk"},
    {"id": "dept-welfare", "department_name": "Office of Student Welfare", "code": "WELFARE", "handler_id": "user-welfare-1", "handler_name": "Ms Priya Balan (Student Welfare Custodian)"},
]

def ensure_departments_seeded(db: Session):
    for d in DEPARTMENT_SEEDS:
        existing = db.query(Department).filter(Department.id == d["id"]).first()
        if not existing:
            dept = Department(
                id=d["id"],
                name=d["department_name"],
                department_name=d["department_name"],
                code=d["code"],
                active=True
            )
            db.add(dept)
    db.commit()

def resolve_slot_from_time(time_str: str) -> str:
    if not time_str:
        return "slot2"
    try:
        parts = time_str.split(":")
        mins = int(parts[0]) * 60 + int(parts[1])
    except Exception:
        return "slot2"

    if mins < 9 * 60 + 40:
        return "slot2"
    elif mins < 10 * 60 + 30:
        return "slot3"
    elif mins < 11 * 60 + 35:
        return "slot4"
    elif mins < 12 * 60 + 25:
        return "slot5"
    elif mins < 14 * 60:
        return "slot6"
    elif mins < 14 * 60 + 50:
        return "slot7"
    elif mins < 15 * 60 + 40:
        return "slot8"
    elif mins < 16 * 60 + 30:
        return "slot9"
    else:
        return "slot10"

def get_user_department_id(department_name: Optional[str]) -> Optional[str]:
    if not department_name:
        return None
    dept_upper = department_name.strip().upper()
    if "MATH" in dept_upper:
        return "dept-math"
    if "COMPUTER" in dept_upper or "CSE" in dept_upper or dept_upper == "CS":
        return "dept-cse"
    if "ELECTRONIC" in dept_upper or "ECE" in dept_upper:
        return "dept-ece"
    if "MECHANICAL" in dept_upper or "MECH" in dept_upper:
        return "dept-mech"
    return None

def check_handler_scope(user: User, item: LostFoundItem, db: Session):
    """
    Enforces server-side department-level authorization:
    Student Welfare and Admins have campus-wide oversight.
    Department handlers (Faculty / Class Advisor) can ONLY access cases assigned to their
    department or directly assigned to their user ID.
    """
    if user.role in [ROLE_LOST_PROPERTY_HANDLER, ROLE_SYS_ADMIN, ROLE_RESOURCE_ADMIN]:
        return True

    if item.assigned_handler_id == user.id:
        return True

    matching_dept_id = get_user_department_id(user.department)
    if matching_dept_id and item.destination_department_id == matching_dept_id:
        return True

    dh = db.query(DepartmentHandler).filter(
        DepartmentHandler.user_id == user.id,
        DepartmentHandler.department_id == item.destination_department_id
    ).first()
    if dh:
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Forbidden: You are not authorized to view or manage cases for this department."
    )

def format_handler_case(item: LostFoundItem, db: Session) -> LostFoundResponse:
    """Enriches full case details for authorized handlers only."""
    owner_user = None
    if item.report_type == "lost":
        owner_user = db.query(User).filter(User.id == item.finder_id).first()

    candidates = []
    if item.report_type == "found":
        c_rows = db.query(ItemMatchCandidate).filter(
            ItemMatchCandidate.found_report_id == item.id
        ).order_by(ItemMatchCandidate.match_score.desc()).all()
    else:
        c_rows = db.query(ItemMatchCandidate).filter(
            ItemMatchCandidate.lost_report_id == item.id
        ).order_by(ItemMatchCandidate.match_score.desc()).all()

    for c in c_rows:
        opp = c.lost_item if item.report_type == "found" else c.found_item
        if not opp or opp.status in ["returned", "recovered", "closed", "cancelled"]:
            continue
        breakdown = {}
        if c.component_scores:
            try:
                breakdown = json.loads(c.component_scores)
            except Exception:
                pass

        lost_it = c.lost_item
        found_it = c.found_item
        lost_owner = db.query(User).filter(User.id == lost_it.finder_id).first() if lost_it else None
        found_finder = db.query(User).filter(User.id == found_it.finder_id).first() if found_it else None

        candidates.append(HandlerMatchCandidateDetail(
            candidate_id=c.id,
            lost_item_id=lost_it.id if lost_it else "",
            lost_item_title=lost_it.title if lost_it else "",
            lost_item_category=lost_it.category if lost_it else "",
            lost_item_description=lost_it.description if lost_it else "",
            lost_item_location=lost_it.location_found if lost_it else "",
            lost_item_characteristics=lost_it.characteristics if lost_it else None,
            lost_item_private_details=lost_it.private_identifying_details if lost_it else None,
            lost_owner_name=lost_owner.name if lost_owner else (lost_it.finder_name if lost_it else "Unknown"),
            lost_owner_student_id=lost_owner.student_id if lost_owner else (lost_it.owner_student_id if lost_it else None),
            lost_owner_email=lost_owner.email if lost_owner else None,
            lost_item_status=lost_it.status if lost_it else "",

            found_item_id=found_it.id if found_it else "",
            found_item_title=found_it.title if found_it else "",
            found_item_category=found_it.category if found_it else "",
            found_item_description=found_it.description if found_it else "",
            found_item_location=found_it.location_found if found_it else "",
            found_item_characteristics=found_it.characteristics if found_it else None,
            found_destination_department=found_it.destination_department_name if found_it else None,
            found_storage_location=found_it.storage_location if found_it else None,
            found_custody_status=found_it.custody_status if found_it else None,
            found_finder_name=found_it.finder_name if found_it else None,
            found_finder_id=found_it.finder_id if found_it else None,
            found_item_status=found_it.status if found_it else "",
            found_photo_url=found_it.photo_url if found_it else None,

            match_score=c.match_score,
            confidence_level=breakdown.get("confidence_level", "HIGH" if c.match_score >= 85 else "POSSIBLE"),
            component_scores=breakdown,
            review_status=c.review_status,
            last_calculated_at=c.last_calculated_at
        ))

    finder_user = db.query(User).filter(User.id == item.finder_id).first()

    return LostFoundResponse(
        id=item.id,
        report_type=item.report_type,
        title=item.title,
        category=item.category,
        description=item.description,
        location_found=item.location_found,
        is_classroom=item.is_classroom,
        room_id=item.room_id,
        found_date=item.found_date,
        found_time=item.found_time,
        photo_url=item.photo_url,
        finder_name=item.finder_name,
        finder_id=item.finder_id,
        finder_email=finder_user.email if finder_user else None,
        current_custody=item.current_custody,
        storage_location=item.storage_location,
        assigned_handler_name=item.assigned_handler_name,
        assigned_handler_id=item.assigned_handler_id,
        routing_reason=item.routing_reason,
        status=item.status,
        return_date=item.return_date,
        handover_notes=item.handover_notes,
        created_at=item.created_at,
        destination_department_id=item.destination_department_id,
        destination_department_name=item.destination_department_name,
        characteristics=item.characteristics,
        private_identifying_details=item.private_identifying_details,
        custody_status=item.custody_status,
        verification_status=item.verification_status,
        verified_by_name=item.verified_by_name,
        claimant_college_id=item.claimant_college_id,
        handover_recipient_name=item.handover_recipient_name,
        is_synthetic=item.is_synthetic,
        owner_name=owner_user.name if owner_user else None,
        owner_student_id=owner_user.student_id if owner_user else item.owner_student_id,
        owner_email=owner_user.email if owner_user else None,
        claims=[ItemClaimResponse.model_validate(c) for c in item.claims],
        custody_logs=[CustodyLogResponse.model_validate(l) for l in item.custody_logs],
        potential_matches=candidates
    )

@router.get("/departments", response_model=List[DepartmentResponse])
def list_departments(db: Session = Depends(get_db)):
    """Returns all campus departments configured for Lost & Found item routing."""
    ensure_departments_seeded(db)
    return db.query(Department).filter(Department.active == True).all()

@router.get("/")
def list_items(
    report_type: Optional[str] = Query(None, description="'found' or 'lost'"),
    category: Optional[str] = None,
    status: Optional[str] = None,
    department_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List items with strict privacy enforcement:
    - Students: CANNOT view other students' lost reports or full private details.
      Returns only sanitized public found notices (StudentPublicFoundResponse) or their own reports.
    - Handlers: returns case records scoped to their authorized department or Student Welfare.
    """
    is_handler = current_user.role in CAN_PROCESS_CLAIMS

    query = db.query(LostFoundItem)
    if report_type:
        query = query.filter(LostFoundItem.report_type == report_type)
    if category:
        query = query.filter(LostFoundItem.category == category)
    if status:
        query = query.filter(LostFoundItem.status == status)
    if department_id:
        query = query.filter(
            (LostFoundItem.destination_department_id == department_id) |
            (LostFoundItem.associated_department == department_id)
        )
    if search:
        s = f"%{search}%"
        query = query.filter(
            (LostFoundItem.title.ilike(s)) |
            (LostFoundItem.description.ilike(s)) |
            (LostFoundItem.location_found.ilike(s))
        )

    if not is_handler:
        # Student privacy rule:
        # Never expose other students' lost reports or private fields!
        query = query.filter(
            or_(
                LostFoundItem.report_type == "found",
                and_(LostFoundItem.report_type == "lost", LostFoundItem.finder_id == current_user.id)
            )
        )
        items = query.order_by(LostFoundItem.created_at.desc()).all()
        # Return sanitized public responses
        return [
            StudentPublicFoundResponse(
                id=i.id,
                category=i.category,
                title=i.title,
                location_found=i.location_found,
                found_date=i.found_date,
                destination_department_name=i.destination_department_name,
                custody_status=i.custody_status,
                status=i.status,
                created_at=i.created_at
            )
            for i in items
        ]

    # Handler scoping
    if current_user.role not in [ROLE_LOST_PROPERTY_HANDLER, ROLE_SYS_ADMIN, ROLE_RESOURCE_ADMIN]:
        user_dept_code = (current_user.department or "").upper()
        matching_dept_id = None
        if "CS" in user_dept_code:
            matching_dept_id = "dept-cse"
        elif "MATH" in user_dept_code:
            matching_dept_id = "dept-math"
        elif "EC" in user_dept_code:
            matching_dept_id = "dept-ece"
        elif "MECH" in user_dept_code:
            matching_dept_id = "dept-mech"

        filters = [LostFoundItem.assigned_handler_id == current_user.id]
        if matching_dept_id:
            filters.append(LostFoundItem.destination_department_id == matching_dept_id)

        query = query.filter(or_(*filters))

    items = query.order_by(LostFoundItem.created_at.desc()).all()
    return [format_handler_case(i, db) for i in items]

@router.get("/my-lost-items", response_model=List[StudentLostReportResponse])
def get_my_lost_items(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Student's My Lost Items Dashboard (Section 6):
    Returns ONLY the authenticated student's own lost reports with safe match alerts and collection instructions.
    Does NOT disclose other reports' detailed info, finder identity, scores, or factor breakdowns.
    """
    reports = db.query(LostFoundItem).filter(
        LostFoundItem.finder_id == current_user.id,
        LostFoundItem.report_type == "lost"
    ).order_by(LostFoundItem.created_at.desc()).all()

    results = []
    for r in reports:
        has_match = False
        dept_name = None
        instructions = None

        if r.status not in ["returned", "recovered", "closed", "cancelled"]:
            candidates = db.query(ItemMatchCandidate).filter(
                ItemMatchCandidate.lost_report_id == r.id,
                ItemMatchCandidate.match_score >= 65.0
            ).order_by(ItemMatchCandidate.match_score.desc()).all()

            for c in candidates:
                found = c.found_item
                if found and found.status not in ["returned", "closed", "cancelled"]:
                    has_match = True
                    dept_name = found.destination_department_name or "Department Office"
                    instructions = f"Visit the {dept_name} office with your college ID card for ownership verification."
                    break

        results.append(StudentLostReportResponse(
            id=r.id,
            report_type="lost",
            title=r.title,
            category=r.category,
            description=r.description,
            location_found=r.location_found,
            found_date=r.found_date,
            found_time=r.found_time,
            characteristics=r.characteristics,
            status=r.status,
            created_at=r.created_at,
            has_potential_match=has_match,
            potential_match_dept=dept_name,
            collection_instructions=instructions
        ))

    return results

@router.get("/my-found-items", response_model=List[StudentFoundReportResponse])
def get_my_found_items(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns only found reports submitted by the current user."""
    items = db.query(LostFoundItem).filter(
        LostFoundItem.finder_id == current_user.id,
        LostFoundItem.report_type == "found"
    ).order_by(LostFoundItem.created_at.desc()).all()

    return [
        StudentFoundReportResponse(
            id=i.id,
            report_type="found",
            title=i.title,
            category=i.category,
            description=i.description,
            location_found=i.location_found,
            found_date=i.found_date,
            found_time=i.found_time,
            destination_department_id=i.destination_department_id,
            destination_department_name=i.destination_department_name,
            storage_location=i.storage_location,
            custody_status=i.custody_status,
            status=i.status,
            created_at=i.created_at,
            assigned_handler_name=i.assigned_handler_name,
            current_custody=i.current_custody,
            routing_reason=i.routing_reason
        )
        for i in items
    ]

@router.get("/my-reports")
def my_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns only reports submitted by the current authenticated user."""
    items = db.query(LostFoundItem).filter(
        LostFoundItem.finder_id == current_user.id
    ).order_by(LostFoundItem.created_at.desc()).all()

    results = []
    for i in items:
        if i.report_type == "lost":
            has_match = False
            dept_name = None
            instructions = None
            if i.status not in ["returned", "recovered", "closed", "cancelled"]:
                candidates = db.query(ItemMatchCandidate).filter(
                    ItemMatchCandidate.lost_report_id == i.id,
                    ItemMatchCandidate.match_score >= 65.0
                ).all()
                for c in candidates:
                    found = c.found_item
                    if found and found.status not in ["returned", "closed", "cancelled"]:
                        has_match = True
                        dept_name = found.destination_department_name or "Department Office"
                        instructions = f"Visit the {dept_name} office with your college ID card for ownership verification."
                        break

            results.append(StudentLostReportResponse(
                id=i.id,
                report_type="lost",
                title=i.title,
                category=i.category,
                description=i.description,
                location_found=i.location_found,
                found_date=i.found_date,
                found_time=i.found_time,
                characteristics=i.characteristics,
                status=i.status,
                created_at=i.created_at,
                has_potential_match=has_match,
                potential_match_dept=dept_name,
                collection_instructions=instructions
            ))
        else:
            results.append(StudentFoundReportResponse(
                id=i.id,
                report_type="found",
                title=i.title,
                category=i.category,
                description=i.description,
                location_found=i.location_found,
                found_date=i.found_date,
                found_time=i.found_time,
                destination_department_id=i.destination_department_id,
                destination_department_name=i.destination_department_name,
                storage_location=i.storage_location,
                custody_status=i.custody_status,
                status=i.status,
                created_at=i.created_at
            ))
    return results

@router.post("/{item_id}/cancel")
def cancel_lost_report(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Allows an authenticated student to cancel their own active lost report."""
    item = db.query(LostFoundItem).filter(LostFoundItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if item.finder_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You can only cancel your own lost reports.")

    if item.status in ["returned", "recovered", "closed"]:
        raise HTTPException(status_code=400, detail="Cannot cancel an item that is already recovered or closed.")

    item.status = "cancelled"
    item.custody_status = "cancelled"
    db.commit()

    return {"message": "Lost report cancelled successfully.", "id": item_id, "status": "cancelled"}

@router.get("/handler/cases", response_model=List[LostFoundResponse])
def get_handler_cases(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Department Handler Scoped Case Management (Section 7):
    Returns cases strictly within the handler's authorized department scope.
    Unauthorized users and students receive 403 Forbidden.
    """
    if current_user.role not in CAN_PROCESS_CLAIMS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Case management is restricted to authorized handlers."
        )

    query = db.query(LostFoundItem)

    # Scoping
    if current_user.role not in [ROLE_LOST_PROPERTY_HANDLER, ROLE_SYS_ADMIN, ROLE_RESOURCE_ADMIN]:
        matching_dept_id = get_user_department_id(current_user.department)

        filters = [LostFoundItem.assigned_handler_id == current_user.id]
        if matching_dept_id:
            filters.append(LostFoundItem.destination_department_id == matching_dept_id)

        query = query.filter(or_(*filters))

    items = query.order_by(LostFoundItem.created_at.desc()).all()
    return [format_handler_case(i, db) for i in items]

@router.get("/handler/cases/{case_id}", response_model=LostFoundResponse)
def get_handler_case_by_id(
    case_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves full case details for an authorized handler within their department scope."""
    if current_user.role not in CAN_PROCESS_CLAIMS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only authorized department handlers can access case details."
        )

    item = db.query(LostFoundItem).filter(LostFoundItem.id == case_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Case not found")

    check_handler_scope(current_user, item, db)
    return format_handler_case(item, db)

@router.get("/assigned-to-me", response_model=List[LostFoundResponse])
def assigned_to_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Alias to get_handler_cases for backwards compatibility."""
    return get_handler_cases(current_user, db)

@router.get("/{item_id}")
def get_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns item according to role permissions:
    - Student: ONLY permitted to retrieve their own report. Other students' reports return 403.
    - Handler: checks department authorization scope. Unauthorized handlers receive 403.
    """
    item = db.query(LostFoundItem).filter(LostFoundItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if current_user.role not in CAN_PROCESS_CLAIMS:
        if item.finder_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Students cannot view other users' reports."
            )
        if item.report_type == "lost":
            return StudentLostReportResponse(
                id=item.id,
                report_type="lost",
                title=item.title,
                category=item.category,
                description=item.description,
                location_found=item.location_found,
                found_date=item.found_date,
                found_time=item.found_time,
                characteristics=item.characteristics,
                status=item.status,
                created_at=item.created_at
            )
        else:
            return StudentFoundReportResponse(
                id=item.id,
                report_type="found",
                title=item.title,
                category=item.category,
                description=item.description,
                location_found=item.location_found,
                found_date=item.found_date,
                found_time=item.found_time,
                destination_department_id=item.destination_department_id,
                destination_department_name=item.destination_department_name,
                storage_location=item.storage_location,
                custody_status=item.custody_status,
                status=item.status,
                created_at=item.created_at,
                assigned_handler_name=item.assigned_handler_name,
                current_custody=item.current_custody,
                routing_reason=item.routing_reason
            )

    check_handler_scope(current_user, item, db)
    return format_handler_case(item, db)

@router.post("/report")
def report_item(
    report_in: LostFoundCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submits a Found or Lost item report:
    - If found: routes to designated receiving department, sets custody, triggers matching.
    - If lost: creates active lost report with private verification clues, triggers cross-department matching.
    """
    ensure_departments_seeded(db)

    assigned_handler_id = None
    assigned_handler_name = "Office of Student Welfare"
    current_custody = "student_welfare"
    dest_dept_id = report_in.destination_department_id
    dest_dept_name = None
    routing_reason = "Routed to Student Welfare (Campus Common Area)"
    storage_loc = report_in.storage_location or "Student Welfare Locker Desk"

    initial_status = "reported"
    initial_custody_status = "awaiting_handover"

    if report_in.report_type == "found":
        if dest_dept_id:
            dept_seed = next((d for d in DEPARTMENT_SEEDS if d["id"] == dest_dept_id), None)
            if dept_seed:
                dest_dept_name = dept_seed["department_name"]
                assigned_handler_id = dept_seed["handler_id"]
                assigned_handler_name = dept_seed["handler_name"]
                current_custody = dept_seed["id"]
                storage_loc = report_in.storage_location or f"{dept_seed['code']} Department Reception Desk"
                routing_reason = f"Explicit Finder Route: Handed over to {dest_dept_name}."

        if not assigned_handler_id and report_in.is_classroom and report_in.room_id:
            tt_slot = db.query(TimetableSlot).filter(TimetableSlot.room_id == report_in.room_id).first()
            advisor_val = getattr(tt_slot, "advisor", None) or getattr(tt_slot, "advisor_name", None) if tt_slot else None
            if advisor_val:
                advisor_user = db.query(User).filter(User.name == advisor_val).first()
                if advisor_user:
                    assigned_handler_id = advisor_user.id
                    assigned_handler_name = advisor_user.name
                    current_custody = "class_advisor"
                    dest_dept_id = "dept-math"
                    dest_dept_name = "Department of Mathematics"
                    routing_reason = f"Classroom Timetable Match: Routed to Class Advisor {advisor_user.name}."
                    storage_loc = f"Class Advisor Office ({advisor_user.department})"
            elif tt_slot and tt_slot.faculty:
                fac_user = db.query(User).filter(User.name == tt_slot.faculty).first()
                if fac_user:
                    assigned_handler_id = fac_user.id
                    assigned_handler_name = fac_user.name
                    current_custody = "faculty"
                    dest_dept_id = "dept-cse"
                    dest_dept_name = "Department of Computer Science & Engineering"
                    routing_reason = f"Classroom Timetable Match: Routed to Course Faculty {fac_user.name}."
                    storage_loc = "Faculty Cabin Desk"

        if not assigned_handler_id:
            welfare_user = db.query(User).filter(User.role == ROLE_LOST_PROPERTY_HANDLER).first()
            if welfare_user:
                assigned_handler_id = welfare_user.id
                assigned_handler_name = welfare_user.name
                current_custody = "student_welfare"
                dest_dept_id = "dept-welfare"
                dest_dept_name = "Office of Student Welfare"

        if report_in.is_physically_handed_over:
            initial_status = "in_custody"
            initial_custody_status = "in_custody"
        else:
            initial_status = "reported"
            initial_custody_status = "awaiting_handover"

    else:
        # Lost report
        initial_status = "active"
        initial_custody_status = "active"
        assigned_handler_name = "Campus Central Lost Property Network"
        dest_dept_name = "All Campus Departments"
        routing_reason = "Searchable Across All Departments & Student Welfare"

    item = LostFoundItem(
        report_type=report_in.report_type,
        title=report_in.title,
        category=report_in.category,
        description=report_in.description,
        location_found=report_in.location_found,
        is_classroom=report_in.is_classroom,
        room_id=report_in.room_id,
        found_date=report_in.found_date,
        found_time=report_in.found_time,
        photo_url=report_in.photo_url,
        finder_id=current_user.id,
        finder_name=current_user.name,
        current_custody=current_custody,
        storage_location=storage_loc,
        assigned_handler_id=assigned_handler_id,
        assigned_handler_name=assigned_handler_name,
        routing_reason=routing_reason,
        status=initial_status,
        destination_department_id=dest_dept_id,
        destination_department_name=dest_dept_name,
        characteristics=report_in.characteristics,
        private_identifying_details=report_in.private_identifying_details,
        associated_department=report_in.associated_department,
        custody_status=initial_custody_status,
        verification_status="unverified",
        owner_student_id=current_user.student_id if report_in.report_type == "lost" else None
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    # Initial Custody Log
    log = CustodyLog(
        item_id=item.id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        action="reported",
        from_custodian="Finder" if item.report_type == "found" else "Owner",
        to_custodian=assigned_handler_name,
        notes=f"Reported {item.report_type.upper()} at {item.location_found}. {routing_reason}"
    )
    db.add(log)
    db.commit()

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        f"LOST_FOUND_{item.report_type.upper()}_SUBMITTED", "LOST_ITEM", item.id,
        f"'{item.title}' at {item.location_found}. Destination: {dest_dept_name or 'Central'}."
    )

    if item.report_type == "found" and assigned_handler_id:
        send_notification(
            db, assigned_handler_id,
            "New Found Item Routed to Your Department",
            f"A found item ('{item.title}') was routed to your desk at {dest_dept_name or 'Department'}. "
            f"Location found: {item.location_found}. Status: {initial_custody_status.upper()}.",
            category="lost_found", link="/lost-found"
        )

    # Run Multi-Factor Cross-Department Matching Engine
    try:
        run_cross_department_matching(db, item)
    except Exception as e:
        print(f"Matching engine warning: {e}")

    # Return safe response based on user role
    if current_user.role not in CAN_PROCESS_CLAIMS:
        if item.report_type == "lost":
            return StudentLostReportResponse(
                id=item.id,
                report_type="lost",
                title=item.title,
                category=item.category,
                description=item.description,
                location_found=item.location_found,
                found_date=item.found_date,
                found_time=item.found_time,
                characteristics=item.characteristics,
                status=item.status,
                created_at=item.created_at
            )
        else:
            return StudentFoundReportResponse(
                id=item.id,
                report_type="found",
                title=item.title,
                category=item.category,
                description=item.description,
                location_found=item.location_found,
                found_date=item.found_date,
                found_time=item.found_time,
                destination_department_id=item.destination_department_id,
                destination_department_name=item.destination_department_name,
                storage_location=item.storage_location,
                custody_status=item.custody_status,
                status=item.status,
                created_at=item.created_at,
                assigned_handler_name=item.assigned_handler_name,
                current_custody=item.current_custody,
                routing_reason=item.routing_reason
            )

    return format_handler_case(item, db)

@router.get("/{item_id}/matches")
def get_potential_matches(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns transparent matching candidates with component score breakdowns.
    STRICT PRIVACY: Students receive 403 Forbidden. Only authorized department handlers within scope may access.
    """
    if current_user.role not in CAN_PROCESS_CLAIMS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Students are not authorized to retrieve detailed match-candidate cards or factor breakdowns."
        )

    target = db.query(LostFoundItem).filter(LostFoundItem.id == item_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Item not found")

    check_handler_scope(current_user, target, db)

    # Refresh matching candidates
    run_cross_department_matching(db, target)

    formatted = format_handler_case(target, db)
    return {
        "target_id": item_id,
        "report_type": target.report_type,
        "title": target.title,
        "matches": [
            {
                "candidate_id": m.candidate_id,
                "item": {
                    "id": m.found_item_id if target.report_type == "lost" else m.lost_item_id,
                    "title": m.found_item_title if target.report_type == "lost" else m.lost_item_title,
                    "category": m.found_item_category if target.report_type == "lost" else m.lost_item_category,
                    "description": m.found_item_description if target.report_type == "lost" else m.lost_item_description,
                    "location_found": m.found_item_location if target.report_type == "lost" else m.lost_item_location,
                    "status": m.found_item_status if target.report_type == "lost" else m.lost_item_status,
                },
                "match_score": m.match_score,
                "confidence_level": m.confidence_level,
                "component_scores": m.component_scores,
                "review_status": m.review_status,
                "last_calculated_at": m.last_calculated_at,
                "owner_name": m.lost_owner_name,
                "owner_student_id": m.lost_owner_student_id,
                "finder_name": m.found_finder_name,
            }
            for m in formatted.potential_matches
        ]
    }

@router.post("/candidates/{candidate_id}/review")
def review_candidate(
    candidate_id: str,
    review_status: str = Query(..., description="'confirmed_match' or 'dismissed'"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Allows an authorized handler to confirm or dismiss a matching candidate."""
    if current_user.role not in CAN_PROCESS_CLAIMS:
        raise HTTPException(status_code=403, detail="Forbidden: Handlers only")

    cand = db.query(ItemMatchCandidate).filter(ItemMatchCandidate.id == candidate_id).first()
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if cand.found_item:
        check_handler_scope(current_user, cand.found_item, db)

    cand.review_status = review_status
    db.commit()
    return {"message": f"Candidate status updated to {review_status}", "candidate_id": candidate_id}

@router.post("/{item_id}/in-person-verification", response_model=LostFoundResponse)
def in_person_verification(
    item_id: str,
    verif_in: InPersonVerificationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Ownership Verification and Collection Protocol (Section 8):
    1. Claimant presents valid physical College ID card in person.
    2. Handler checks claimant's institutional identity against the registered owner record.
    3. Handler verifies item-specific details.
    4. If passes: marks found item RETURNED, associated lost report RECOVERED, sends collection confirmation.
    5. If fails: leaves item in custody, records verification failure.
    """
    if current_user.role not in CAN_PROCESS_CLAIMS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only authorized Department Handlers and Student Welfare personnel can verify College IDs and execute handovers."
        )

    item = db.query(LostFoundItem).filter(LostFoundItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    check_handler_scope(current_user, item, db)

    if item.status in ["returned", "closed"]:
        raise HTTPException(status_code=400, detail="Item has already been returned or closed.")

    is_passed = getattr(verif_in, "verification_outcome", "passed") in ["passed", "id_verified"]

    if not is_passed:
        # Verification failed - leave in custody
        item.verification_status = "verification_failed"
        log = CustodyLog(
            item_id=item.id,
            actor_id=current_user.id,
            actor_name=current_user.name,
            action="verification_failed",
            from_custodian=item.current_custody,
            to_custodian=item.current_custody,
            notes=f"ID verification failed or inconclusive for claimant {verif_in.claimant_name} (ID: {verif_in.claimant_college_id}). Item retained in custody."
        )
        db.add(log)
        db.commit()
        db.refresh(item)
        return format_handler_case(item, db)

    # Verification passed
    now = datetime.utcnow()
    item.verification_status = "id_verified"
    item.verified_by_id = current_user.id
    item.verified_by_name = current_user.name
    item.claimant_college_id = verif_in.claimant_college_id
    item.handover_recipient_name = verif_in.claimant_name
    item.handover_timestamp = now
    item.status = "returned"
    item.custody_status = "returned"
    item.return_date = now.strftime("%Y-%m-%d %H:%M")
    item.handover_notes = (
        f"In-Person College ID Card Verified: {verif_in.claimant_college_id} ({verif_in.claimant_name}). "
        f"Verification notes: {verif_in.verification_notes or 'All identifying marks and questions matched'}. "
        f"Handover notes: {verif_in.handover_notes or 'Released in good condition'}."
    )

    # Link associated lost report and mark RECOVERED
    associated_lost = None
    if getattr(verif_in, "associated_lost_report_id", None):
        associated_lost = db.query(LostFoundItem).filter(LostFoundItem.id == verif_in.associated_lost_report_id).first()

    if not associated_lost:
        # Search candidate lost reports
        candidates = db.query(ItemMatchCandidate).filter(
            ItemMatchCandidate.found_report_id == item.id
        ).order_by(ItemMatchCandidate.match_score.desc()).all()
        for cand in candidates:
            if cand.lost_item and cand.lost_item.status in ["active", "potential_match", "claim_under_review"]:
                associated_lost = cand.lost_item
                cand.review_status = "confirmed_match"
                break

    if associated_lost and associated_lost.status not in ["returned", "recovered", "closed"]:
        associated_lost.status = "recovered"
        associated_lost.custody_status = "recovered"
        associated_lost.handover_timestamp = now
        associated_lost.handover_recipient_name = verif_in.claimant_name
        associated_lost.claimant_college_id = verif_in.claimant_college_id

        # Send collection confirmation to the student who reported lost item
        send_notification(
            db=db,
            recipient_id=associated_lost.finder_id,
            title="Collection Confirmation",
            message=(
                f"Your lost item '{associated_lost.title}' has been successfully verified with your College ID and handed over at {item.destination_department_name or 'Department Office'}. "
                f"The case is now closed."
            ),
            category="lost_found",
            link="/lost-found"
        )

    # Log custody handover
    log = CustodyLog(
        item_id=item.id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        action="in_person_id_verified_returned",
        from_custodian=item.current_custody,
        to_custodian=f"Owner ({verif_in.claimant_name}, College ID: {verif_in.claimant_college_id})",
        notes=item.handover_notes,
        timestamp=now
    )
    db.add(log)
    db.commit()
    db.refresh(item)

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        "LOST_FOUND_ID_VERIFIED_HANDOVER", "LOST_ITEM", item.id,
        f"Item '{item.title}' returned after College ID verification: {verif_in.claimant_college_id} ({verif_in.claimant_name})."
    )

    return format_handler_case(item, db)

@router.post("/{item_id}/receive-handover", response_model=LostFoundResponse)
def receive_physical_handover(
    item_id: str,
    storage_location: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Marks an item as physically received into departmental custody."""
    if current_user.role not in CAN_PROCESS_CLAIMS:
        raise HTTPException(status_code=403, detail="Not authorized to accept custody")

    item = db.query(LostFoundItem).filter(LostFoundItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    check_handler_scope(current_user, item, db)

    item.status = "in_custody"
    item.custody_status = "in_custody"
    if storage_location:
        item.storage_location = storage_location

    log = CustodyLog(
        item_id=item.id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        action="physical_custody_accepted",
        from_custodian="Finder",
        to_custodian=item.assigned_handler_name,
        notes=f"Physical item received and secured at {item.storage_location}."
    )
    db.add(log)
    db.commit()
    db.refresh(item)

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        "LOST_FOUND_CUSTODY_RECEIVED", "LOST_ITEM", item.id,
        f"Item '{item.title}' received into custody by {current_user.name}."
    )

    return format_handler_case(item, db)

@router.post("/{item_id}/transfer", response_model=LostFoundResponse)
def transfer_custody(
    item_id: str,
    transfer_in: CustodyTransferRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Transfers physical custody of an item to another department or Student Welfare."""
    if current_user.role not in CAN_PROCESS_CLAIMS:
        raise HTTPException(status_code=403, detail="Not authorized to transfer custody")

    item = db.query(LostFoundItem).filter(LostFoundItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    check_handler_scope(current_user, item, db)

    target_dept = db.query(Department).filter(Department.id == transfer_in.new_department_id).first()
    target_name = target_dept.name if target_dept else transfer_in.new_department_id

    old_custody = item.destination_department_name or item.current_custody
    item.destination_department_id = transfer_in.new_department_id
    item.destination_department_name = target_name
    item.custody_status = "transferred"
    if transfer_in.new_storage_location:
        item.storage_location = transfer_in.new_storage_location

    log = CustodyLog(
        item_id=item.id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        action="custody_transferred",
        from_custodian=old_custody,
        to_custodian=target_name,
        notes=f"Custody transferred. Reason: {transfer_in.transfer_reason}."
    )
    db.add(log)
    db.commit()
    db.refresh(item)

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        "LOST_FOUND_CUSTODY_TRANSFERRED", "LOST_ITEM", item.id,
        f"Transferred from {old_custody} to {target_name}. Reason: {transfer_in.transfer_reason}."
    )

    return format_handler_case(item, db)

@router.post("/{item_id}/claim", response_model=ItemClaimResponse)
def submit_claim(
    item_id: str,
    claim_in: ClaimCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Files a proof of ownership claim on a found item."""
    item = db.query(LostFoundItem).filter(LostFoundItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    claim = ItemClaim(
        item_id=item_id,
        claimant_id=current_user.id,
        claimant_name=current_user.name,
        proof_description=claim_in.proof_description,
        contact_phone=claim_in.contact_phone,
        status="pending"
    )
    db.add(claim)
    item.status = "claim_pending"
    item.custody_status = "claim_pending"
    db.commit()
    db.refresh(claim)
    return claim

@router.post("/claims/{claim_id}/review", response_model=ItemClaimResponse)
def review_claim(
    claim_id: str,
    review_in: ClaimReview,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reviews an online ownership claim (Approve/Reject)."""
    if current_user.role not in CAN_PROCESS_CLAIMS:
        raise HTTPException(status_code=403, detail="Not authorized to review claims")

    claim = db.query(ItemClaim).filter(ItemClaim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    item = claim.item
    check_handler_scope(current_user, item, db)

    claim.status = review_in.decision
    claim.handler_notes = review_in.handler_notes
    if review_in.decision == "rejected":
        item.status = "in_custody"
        item.custody_status = "in_custody"
    db.commit()
    db.refresh(claim)
    return claim

@router.post("/{item_id}/handover", response_model=LostFoundResponse)
def record_handover(
    item_id: str,
    handover_in: HandoverUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Records a general custody transition or closure."""
    if current_user.role not in CAN_PROCESS_CLAIMS:
        raise HTTPException(status_code=403, detail="Not authorized to log handovers")

    item = db.query(LostFoundItem).filter(LostFoundItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    check_handler_scope(current_user, item, db)

    old_custody = item.current_custody
    item.status = handover_in.new_custody
    item.custody_status = handover_in.new_custody
    item.current_custody = handover_in.new_custody
    item.handover_notes = handover_in.handover_notes
    if handover_in.storage_location:
        item.storage_location = handover_in.storage_location

    now = datetime.utcnow()
    if handover_in.new_custody == "returned":
        item.return_date = now.strftime("%Y-%m-%d %H:%M")
        item.handover_timestamp = now

    log = CustodyLog(
        item_id=item.id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        action=handover_in.new_custody,
        from_custodian=old_custody,
        to_custodian=handover_in.new_custody,
        notes=handover_in.handover_notes or f"Custody updated to {handover_in.new_custody}.",
        timestamp=now
    )
    db.add(log)
    db.commit()
    db.refresh(item)
    return format_handler_case(item, db)
