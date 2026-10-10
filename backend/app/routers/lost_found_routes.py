from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import LostFoundItem, ItemClaim, CustodyLog, TimetableSlot, Room, User
from app.schemas import (
    LostFoundCreate, LostFoundResponse, ClaimCreate, ClaimReview,
    HandoverUpdate, ItemClaimResponse
)
from app.auth import get_current_user, require_roles, record_audit, send_notification
from app.config import (
    ROLE_STUDENT, ROLE_CLASS_REP, ROLE_CLASS_ADVISOR, ROLE_FACULTY,
    ROLE_LOST_PROPERTY_HANDLER, ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN
)

router = APIRouter(prefix="/lost-found", tags=["Lost & Found"])

CAN_PROCESS_CLAIMS = [
    ROLE_CLASS_ADVISOR, ROLE_LOST_PROPERTY_HANDLER,
    ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN
]

DAY_NAME_MAP = {
    0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday", 4: "Friday", 5: "Saturday", 6: "Sunday"
}

def resolve_slot_from_time(time_str: str) -> str:
    """Helper to map HH:MM time to closest timetable slot."""
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

@router.get("/", response_model=List[LostFoundResponse])
def list_items(
    report_type: Optional[str] = Query(None, description="'found' or 'lost'"),
    category: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(LostFoundItem)
    if report_type:
        query = query.filter(LostFoundItem.report_type == report_type)
    if category:
        query = query.filter(LostFoundItem.category == category)
    if status:
        query = query.filter(LostFoundItem.status == status)
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
    """Items routed to this Class Advisor or Student Welfare handler."""
    return db.query(LostFoundItem).filter(
        (LostFoundItem.assigned_handler_id == current_user.id) |
        (LostFoundItem.current_custody == current_user.role)
    ).order_by(LostFoundItem.created_at.desc()).all()

@router.get("/{item_id}", response_model=LostFoundResponse)
def get_item(item_id: str, db: Session = Depends(get_db)):
    item = db.query(LostFoundItem).filter(LostFoundItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.post("/report", response_model=LostFoundResponse)
def report_item(
    report_in: LostFoundCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submits a Lost or Found item with AUTOMATIC SMART ROUTING:
    - If found inside a classroom: identifies the timetable entry and routes to the Class Advisor!
    - If found outside a classroom: routes to Student Welfare / Lost-Property Handler!
    - Never drops a report.
    """
    assigned_handler_id = None
    assigned_handler_name = "Office of Student Welfare"
    current_custody = "student_welfare"
    routing_reason = "Routed to Student Welfare (Campus Common Area)"
    storage_loc = report_in.storage_location or "Student Welfare Locker Desk"

    if report_in.report_type == "found" and report_in.is_classroom and report_in.room_id:
        # Determine day of week
        try:
            dt = datetime.strptime(report_in.found_date, "%Y-%m-%d")
            day_name = DAY_NAME_MAP[dt.weekday()]
        except Exception:
            day_name = "Monday"

        slot = resolve_slot_from_time(report_in.found_time)

        # Look up timetable slot
        tt_slot = db.query(TimetableSlot).filter(
            TimetableSlot.room_id == report_in.room_id,
            TimetableSlot.day == day_name,
            TimetableSlot.slot_id == slot
        ).first()

        room_obj = db.query(Room).filter(Room.id == report_in.room_id).first()
        room_label = room_obj.name if room_obj else report_in.room_id

        if tt_slot and tt_slot.advisor:
            # Look up advisor user
            advisor_user = db.query(User).filter(
                (User.name == tt_slot.advisor) | (User.role == ROLE_CLASS_ADVISOR)
            ).first()
            if advisor_user:
                assigned_handler_id = advisor_user.id
                assigned_handler_name = advisor_user.name
                current_custody = "class_advisor"
                routing_reason = (
                    f"Classroom Timetable Match: {day_name} {slot} ({tt_slot.course_name}, "
                    f"{tt_slot.class_section}). Automatically routed to Class Advisor {advisor_user.name}."
                )
                storage_loc = f"Class Advisor Office ({advisor_user.department})"
        elif tt_slot and tt_slot.faculty:
            # Fallback to course faculty
            fac_user = db.query(User).filter(User.name == tt_slot.faculty).first()
            if fac_user:
                assigned_handler_id = fac_user.id
                assigned_handler_name = fac_user.name
                current_custody = "faculty"
                routing_reason = f"Classroom Timetable Match: Routed to Course Faculty {fac_user.name}."
                storage_loc = "Faculty Cabin Desk"

    if not assigned_handler_id:
        # Route to Student Welfare Handler
        welfare_user = db.query(User).filter(User.role == ROLE_LOST_PROPERTY_HANDLER).first()
        if welfare_user:
            assigned_handler_id = welfare_user.id
            assigned_handler_name = welfare_user.name
            current_custody = "student_welfare"
            if not routing_reason:
                routing_reason = "Routed to Student Welfare Custodian."

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
        status="reported"
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    # Log initial custody
    log = CustodyLog(
        item_id=item.id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        action="reported",
        from_custodian="Finder",
        to_custodian=assigned_handler_name,
        notes=f"Reported at {item.location_found}. {routing_reason}"
    )
    db.add(log)
    db.commit()

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        "LOST_FOUND_REPORTED", "LOST_ITEM", item.id,
        f"{report_in.report_type.upper()}: '{item.title}' at {item.location_found}. {routing_reason}"
    )

    # Notify Assigned Handler
    if assigned_handler_id:
        send_notification(
            db, assigned_handler_id, f"Lost & Found Auto-Routing Alert",
            f"A found item ('{item.title}') was automatically routed to your custody. Reason: {routing_reason}",
            category="lost_found", link="/lost-found"
        )

    return item

@router.get("/{item_id}/matches")
def get_potential_matches(item_id: str, db: Session = Depends(get_db)):
    """Finds transparent, high-confidence potential matches between lost and found items."""
    target = db.query(LostFoundItem).filter(LostFoundItem.id == item_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Item not found")

    opp_type = "lost" if target.report_type == "found" else "found"
    candidates = db.query(LostFoundItem).filter(LostFoundItem.report_type == opp_type).all()

    matches = []
    target_tokens = set(target.title.lower().split() + target.description.lower().split())

    for c in candidates:
        score = 0
        reasons = []

        # Category match
        if c.category == target.category:
            score += 40
            reasons.append("Exact category match")

        # Location similarity
        if c.location_found.lower() in target.location_found.lower() or target.location_found.lower() in c.location_found.lower():
            score += 30
            reasons.append("Location match")

        # Description text overlap
        c_tokens = set(c.title.lower().split() + c.description.lower().split())
        overlap = len(target_tokens.intersection(c_tokens))
        if overlap > 0:
            score += min(30, overlap * 10)
            reasons.append(f"{overlap} common keyword(s)")

        if score >= 40:
            matches.append({
                "item": c,
                "confidence_score": min(100, score),
                "reasons": reasons
            })

    matches.sort(key=lambda x: x["confidence_score"], reverse=True)
    return {"target_id": item_id, "matches": matches}

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

    # Custody log
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

    claim.status = review_in.decision
    claim.handler_notes = review_in.handler_notes

    item = claim.item
    if review_in.decision == "approved":
        item.status = "claim_pending"
    elif review_in.decision == "rejected":
        item.status = "in_custody"

    # Log action
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
    """Marks item returned or transfers custody, recording handover notes and timestamp."""
    if current_user.role not in CAN_PROCESS_CLAIMS:
        raise HTTPException(status_code=403, detail="Not authorized to record custody handovers")

    item = db.query(LostFoundItem).filter(LostFoundItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    old_custody = item.current_custody
    item.status = handover_in.new_custody
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
