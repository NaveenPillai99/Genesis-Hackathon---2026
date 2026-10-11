import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    LostFoundItem, ItemClaim, CustodyLog, TimetableSlot, Room, User,
    Department, DepartmentHandler, ItemMatchCandidate
)
from app.schemas import (
    LostFoundCreate, LostFoundResponse, ClaimCreate, ClaimReview,
    HandoverUpdate, ItemClaimResponse, DepartmentResponse,
    InPersonVerificationRequest, CustodyTransferRequest, MatchCandidateResponse
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
    elif mins < 13 * 60 + 15:
        return "slot6"
    elif mins < 14 * 60 + 55:
        return "slot8"
    elif mins < 15 * 60 + 45:
        return "slot9"
    else:
        return "slot10"

@router.get("/departments", response_model=List[DepartmentResponse])
def list_departments(db: Session = Depends(get_db)):
    """Returns all campus departments configured for Lost & Found item routing."""
    ensure_departments_seeded(db)
    return db.query(Department).filter(Department.active == True).all()

@router.get("/", response_model=List[LostFoundResponse])
def list_items(
    report_type: Optional[str] = Query(None, description="'found' or 'lost'"),
    category: Optional[str] = None,
    status: Optional[str] = None,
    department_id: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
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
    return query.order_by(LostFoundItem.created_at.desc()).all()

@router.get("/my-reports", response_model=List[LostFoundResponse])
def my_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(LostFoundItem).filter(
        LostFoundItem.finder_id == current_user.id
    ).order_by(LostFoundItem.created_at.desc()).all()

@router.get("/assigned-to-me", response_model=List[LostFoundResponse])
def assigned_to_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Department Handler Scoped View:
    Returns items assigned to this handler or items routed to their authorized department scope.
    """
    query = db.query(LostFoundItem)

    # Student Welfare, System Admin, or Resource Admin has campus-wide oversight
    if current_user.role in [ROLE_LOST_PROPERTY_HANDLER, ROLE_SYS_ADMIN, ROLE_RESOURCE_ADMIN]:
        return query.order_by(LostFoundItem.created_at.desc()).all()

    # Department scoped handlers: Class Advisor (Math) or Faculty (CSE/ECE)
    user_dept_code = (current_user.department or "").upper()
    matching_dept_id = None
    if "MATH" in user_dept_code:
        matching_dept_id = "dept-math"
    elif "CS" in user_dept_code:
        matching_dept_id = "dept-cse"
    elif "EC" in user_dept_code:
        matching_dept_id = "dept-ece"
    elif "MECH" in user_dept_code:
        matching_dept_id = "dept-mech"

    filters = [
        LostFoundItem.assigned_handler_id == current_user.id,
        LostFoundItem.current_custody == current_user.role,
    ]
    if matching_dept_id:
        filters.append(LostFoundItem.destination_department_id == matching_dept_id)

    from sqlalchemy import or_
    return query.filter(or_(*filters)).order_by(LostFoundItem.created_at.desc()).all()

@router.get("/{item_id}", response_model=LostFoundResponse)
def get_item(
    item_id: str,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(LostFoundItem).filter(LostFoundItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Mask private identifying details if requester is not owner and not authorized handler
    if current_user and current_user.id != item.finder_id and current_user.role not in CAN_PROCESS_CLAIMS:
        item.private_identifying_details = None

    return item

@router.post("/report", response_model=LostFoundResponse)
def report_item(
    report_in: LostFoundCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submits a Lost or Found item with Cross-Department Routing and Auto-Matching:
    - If found:
      - Finder specifies the handling department or Student Welfare
      - Sets initial status to REPORTED (or IN_CUSTODY if already physically handed over)
      - Triggers cross-department matching against all active lost-item reports
    - If lost:
      - Becomes active and discoverable across ALL departments by matching engine
      - Triggers cross-department matching against all active found-item reports
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
        # Resolve destination department
        if dest_dept_id:
            dept_seed = next((d for d in DEPARTMENT_SEEDS if d["id"] == dest_dept_id), None)
            if dept_seed:
                dest_dept_name = dept_seed["department_name"]
                assigned_handler_id = dept_seed["handler_id"]
                assigned_handler_name = dept_seed["handler_name"]
                current_custody = dept_seed["id"]
                storage_loc = f"{dept_seed['code']} Department Reception Desk"
                routing_reason = f"Explicit Finder Route: Handed over to {dest_dept_name}."

        # Timetable fallback for classroom items if no department was selected
        if not dest_dept_id and report_in.is_classroom and report_in.room_id:
            try:
                dt = datetime.strptime(report_in.found_date, "%Y-%m-%d")
                day_name = DAY_NAME_MAP[dt.weekday()]
            except Exception:
                day_name = "Monday"

            slot = resolve_slot_from_time(report_in.found_time)
            tt_slot = db.query(TimetableSlot).filter(
                TimetableSlot.room_id == report_in.room_id,
                TimetableSlot.day == day_name,
                TimetableSlot.slot_id == slot
            ).first()

            if tt_slot and tt_slot.advisor:
                advisor_user = db.query(User).filter(
                    (User.name == tt_slot.advisor) | (User.role == ROLE_CLASS_ADVISOR)
                ).first()
                if advisor_user:
                    assigned_handler_id = advisor_user.id
                    assigned_handler_name = advisor_user.name
                    current_custody = "class_advisor"
                    dest_dept_id = "dept-math"
                    dest_dept_name = "Department of Mathematics"
                    routing_reason = (
                        f"Classroom Timetable Match: {day_name} {slot} ({tt_slot.course_name}, "
                        f"{tt_slot.class_section}). Automatically routed to Class Advisor {advisor_user.name}."
                    )
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

        # Outdoor / Default Student Welfare fallback
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
        # Report type == 'lost'
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
        verification_status="unverified"
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

    # Notify Designated Handler on new found report
    if item.report_type == "found" and assigned_handler_id:
        send_notification(
            db, assigned_handler_id,
            f"New Found Item Routed to Your Department",
            f"A found item ('{item.title}') was routed to your desk at {dest_dept_name or 'Department'}. "
            f"Location found: {item.location_found}. Status: {initial_custody_status.upper()}.",
            category="lost_found", link="/lost-found"
        )

    # Run Multi-Factor Cross-Department Matching Engine
    try:
        run_cross_department_matching(db, item)
    except Exception as e:
        print(f"Matching engine warning: {e}")

    return item

@router.get("/{item_id}/matches")
def get_potential_matches(item_id: str, db: Session = Depends(get_db)):
    """
    Returns transparent matching candidates with component score breakdowns
    and confidence ratings for an active report.
    """
    target = db.query(LostFoundItem).filter(LostFoundItem.id == item_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Item not found")

    # Refresh matching candidates
    run_cross_department_matching(db, target)

    is_lost = target.report_type == "lost"
    query = db.query(ItemMatchCandidate)
    if is_lost:
        query = query.filter(ItemMatchCandidate.lost_report_id == target.id)
    else:
        query = query.filter(ItemMatchCandidate.found_report_id == target.id)

    candidates = query.order_by(ItemMatchCandidate.match_score.desc()).all()

    formatted_matches = []
    for c in candidates:
        breakdown = {}
        if c.component_scores:
            try:
                breakdown = json.loads(c.component_scores)
            except Exception:
                pass

        opp_item = c.found_item if is_lost else c.lost_item
        if opp_item and opp_item.status not in ["returned", "recovered", "closed"]:
            formatted_matches.append({
                "candidate_id": c.id,
                "item": opp_item,
                "match_score": c.match_score,
                "review_status": c.review_status,
                "confidence_level": breakdown.get("confidence_level", "POSSIBLE" if c.match_score >= 65 else "LOW"),
                "component_scores": breakdown,
                "last_calculated_at": c.last_calculated_at
            })

    return {
        "target_id": item_id,
        "report_type": target.report_type,
        "title": target.title,
        "matches": formatted_matches
    }

@router.post("/{item_id}/in-person-verification", response_model=LostFoundResponse)
def in_person_verification(
    item_id: str,
    verif_in: InPersonVerificationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Ownership Verification & Handover (Section 7):
    Department handler verifies claimant identity in person using their valid College ID card,
    approves release, records physical handover details, updates status to RETURNED/RECOVERED,
    and removes closed items from active matching.
    """
    if current_user.role not in CAN_PROCESS_CLAIMS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only authorized Department Handlers and Student Welfare personnel can verify College IDs and execute handovers."
        )

    item = db.query(LostFoundItem).filter(LostFoundItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if item.status in ["returned", "closed"]:
        raise HTTPException(status_code=400, detail="Item has already been returned or closed.")

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

    # If linked to a matching lost-item report, update the lost-item report to RECOVERED
    match_pairs = db.query(ItemMatchCandidate).filter(
        ItemMatchCandidate.found_report_id == item.id
    ).all()
    for mp in match_pairs:
        if mp.lost_item and mp.lost_item.status in ["active", "potential_match", "claim_under_review"]:
            mp.lost_item.status = "recovered"
            mp.lost_item.custody_status = "recovered"
            mp.review_status = "confirmed_match"

    # Custody log
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

    # Send Collection Confirmation to Finder / Claimant
    send_notification(
        db, item.finder_id,
        f"Item Collection Confirmation: '{item.title}'",
        f"Your report for '{item.title}' has been successfully closed. Physical handover verified in-person by {current_user.name}.",
        category="lost_found", link="/lost-found"
    )

    return item

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

    old_status = item.custody_status
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
        "LOST_FOUND_CUSTODY_ACCEPTED", "LOST_ITEM", item.id,
        f"Accepted into physical custody at {item.storage_location}."
    )

    return item

@router.post("/{item_id}/transfer", response_model=LostFoundResponse)
def transfer_item_custody(
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

    target_dept = next((d for d in DEPARTMENT_SEEDS if d["id"] == transfer_in.new_department_id), None)
    if not target_dept:
        raise HTTPException(status_code=400, detail="Invalid destination department ID")

    old_custody = item.assigned_handler_name
    item.destination_department_id = target_dept["id"]
    item.destination_department_name = target_dept["department_name"]
    item.assigned_handler_id = target_dept["handler_id"]
    item.assigned_handler_name = target_dept["handler_name"]
    item.current_custody = target_dept["id"]
    item.status = "transferred"
    item.custody_status = "transferred"
    if transfer_in.new_storage_location:
        item.storage_location = transfer_in.new_storage_location

    log = CustodyLog(
        item_id=item.id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        action="custody_transferred",
        from_custodian=old_custody,
        to_custodian=target_dept["handler_name"],
        notes=f"Transferred to {target_dept['department_name']}. Reason: {transfer_in.transfer_reason}"
    )
    db.add(log)
    db.commit()
    db.refresh(item)

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        "LOST_FOUND_TRANSFERRED", "LOST_ITEM", item.id,
        f"Transferred from {old_custody} to {target_dept['department_name']}: {transfer_in.transfer_reason}"
    )

    return item

# Existing claim and review endpoints for backward compatibility
@router.post("/{item_id}/claim", response_model=ItemClaimResponse)
def submit_claim(
    item_id: str,
    claim_in: ClaimCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(LostFoundItem).filter(LostFoundItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.status in ["returned", "closed"]:
        raise HTTPException(status_code=400, detail="Item has already been returned or closed")

    claim = ItemClaim(
        item_id=item.id,
        claimant_id=current_user.id,
        claimant_name=current_user.name,
        proof_description=claim_in.proof_description,
        contact_phone=claim_in.contact_phone,
        status="pending"
    )
    db.add(claim)
    item.status = "claim_pending"
    item.custody_status = "claim_pending"

    log = CustodyLog(
        item_id=item.id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        action="claim_filed",
        from_custodian=item.current_custody,
        to_custodian=item.current_custody,
        notes=f"Claim submitted by {current_user.name}."
    )
    db.add(log)
    db.commit()
    db.refresh(claim)

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        "CLAIM_SUBMITTED", "CLAIM", claim.id,
        f"Claim filed for '{item.title}' by {current_user.name}"
    )

    if item.assigned_handler_id:
        send_notification(
            db, item.assigned_handler_id, "New Claim Filed on Item",
            f"{current_user.name} submitted a claim for '{item.title}' in your custody.",
            category="lost_found", link="/lost-found"
        )

    return claim

@router.post("/claims/{claim_id}/review", response_model=ItemClaimResponse)
def review_claim(
    claim_id: str,
    review_in: ClaimReview,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in CAN_PROCESS_CLAIMS:
        raise HTTPException(status_code=403, detail="Not authorized to verify claims")

    claim = db.query(ItemClaim).filter(ItemClaim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if claim.claimant_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conflict of Interest: Users are prohibited from approving their own item claims."
        )

    claim.status = review_in.decision
    claim.handler_notes = review_in.handler_notes

    item = claim.item
    if review_in.decision == "approved":
        item.status = "claim_pending"
    elif review_in.decision == "rejected":
        item.status = "in_custody"

    log = CustodyLog(
        item_id=item.id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        action=f"claim_{review_in.decision}",
        from_custodian=item.current_custody,
        to_custodian=item.current_custody,
        notes=f"Claim decision: {review_in.decision}. Notes: {review_in.handler_notes or 'None'}"
    )
    db.add(log)
    db.commit()
    db.refresh(claim)

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        f"CLAIM_{review_in.decision.upper()}", "CLAIM", claim.id,
        f"Handler decision by {current_user.name}"
    )

    send_notification(
        db, claim.claimant_id, f"Claim Update: {review_in.decision.capitalize()}",
        f"Your claim for '{item.title}' was updated to '{review_in.decision}'. Note: {review_in.handler_notes or 'Please see your dashboard.'}",
        category="lost_found", link="/lost-found"
    )

    return claim

@router.post("/{item_id}/handover", response_model=LostFoundResponse)
def record_handover(
    item_id: str,
    handover_in: HandoverUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in CAN_PROCESS_CLAIMS:
        raise HTTPException(status_code=403, detail="Not authorized to record custody handovers")

    item = db.query(LostFoundItem).filter(LostFoundItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    old_custody = item.current_custody
    item.status = handover_in.new_custody
    item.custody_status = handover_in.new_custody
    if handover_in.storage_location:
        item.storage_location = handover_in.storage_location
    if handover_in.handover_notes:
        item.handover_notes = handover_in.handover_notes

    if handover_in.new_custody == "returned":
        item.return_date = datetime.utcnow().strftime("%Y-%m-%d %H:%M")

    log = CustodyLog(
        item_id=item.id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        action=handover_in.new_custody,
        from_custodian=old_custody,
        to_custodian=handover_in.new_custody,
        notes=handover_in.handover_notes or f"Custody updated to {handover_in.new_custody}"
    )
    db.add(log)
    db.commit()
    db.refresh(item)

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        f"ITEM_HANDOVER_{handover_in.new_custody.upper()}", "LOST_ITEM", item.id,
        f"Status: {handover_in.new_custody}. Handover notes: {handover_in.handover_notes}"
    )

    return item
