import json
from datetime import datetime
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import EventRequest, Room, User, TimetableSlot
from app.schemas import (
    EventCreate, EventReview, EventResponse, EventRecommendationCreate,
    PriorityCalculationRequest, PriorityCalculationResponse,
    AlternativeSelectionRequest, BookingPolicyResponse, BookingPolicyUpdateRequest,
)
from app.auth import (
    get_current_user,
    require_permission,
    record_audit,
    send_notification,
    get_user_permissions,
    get_user_department_scopes,
    get_user_class_scopes,
)
from app.config import (
    ROLE_FACULTY, ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN,
    ROLE_CAMPUS_DIRECTOR, ROLE_DEAN, ROLE_PRINCIPAL, ROLE_HOD,
    ROLE_CLASS_ADVISOR, ROLE_CLASS_REP, ROLE_STUDENT
)

from app.priority_service import calculate_event_priority, calculate_people_priority
from app.booking_engine import (
    get_booking_policy,
    calculate_booking_priority,
    validate_hard_constraints,
    slots_overlap,
    find_alternative_venues,
    find_alternative_time_slots,
    validate_state_transition,
    normalize_status,
    auto_resolve_booking_decision,
)

router = APIRouter(prefix="/events", tags=["Event Venues"])


def parse_json_safely(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, (dict, list)):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return val
    return val


def serialize_event_for_response(evt: EventRequest, is_privileged: bool = False, is_owner: bool = False) -> EventResponse:
    resp = EventResponse.model_validate(evt)
    resp.priority = evt.priority if evt.priority is not None else 0
    resp.priority_label = "High Priority" if resp.priority == 1 else "Normal Priority"
    resp.offered_alternatives = parse_json_safely(evt.offered_alternatives)
    resp.selected_alternative = parse_json_safely(evt.selected_alternative)

    if is_privileged:
        resp.raw_score = evt.raw_score
        resp.sigmoid_confidence = evt.sigmoid_confidence
        resp.role_score = evt.role_score
        resp.purpose_score = evt.purpose_score
        resp.combined_priority_score = evt.combined_priority_score
        resp.policy_version = evt.policy_version
        resp.recommended_action = evt.recommended_action
        resp.override_justification = evt.override_justification
        # Detailed score breakdown
        prio_detail = calculate_event_priority(
            level=evt.level,
            is_academic=evt.is_academic,
            expected_audience=evt.expected_audience,
            event_date=evt.event_date,
            has_external_guests=evt.has_external_guests,
        )
        resp.explanation = {
            "legacy_breakdown": prio_detail.get("breakdown"),
            "combined_priority_breakdown": {
                "role_score": evt.role_score,
                "purpose_score": evt.purpose_score,
                "combined_priority_score": evt.combined_priority_score,
                "formula": f"(0.60 * {evt.role_score}) + (0.40 * {evt.purpose_score}) = {evt.combined_priority_score}",
            }
        }
    elif is_owner:
        resp.raw_score = None
        resp.sigmoid_confidence = None
        resp.role_score = evt.role_score
        resp.purpose_score = evt.purpose_score
        resp.combined_priority_score = evt.combined_priority_score
        resp.policy_version = evt.policy_version
        resp.recommended_action = evt.recommended_action
        resp.override_justification = evt.override_justification
        resp.explanation = None
    else:
        # Prevent private administrative scoring leak to unauthorized students
        resp.raw_score = None
        resp.sigmoid_confidence = None
        resp.role_score = None
        resp.purpose_score = None
        resp.combined_priority_score = None
        resp.policy_version = None
        resp.recommended_action = None
        resp.override_justification = None
        resp.explanation = None

    return resp


@router.get("/", response_model=List[EventResponse])
def list_events(
    status_filter: Optional[str] = Query(None, alias="status"),
    venue_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    perms = get_user_permissions(current_user, db)
    if "event.view" not in perms:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Account lacks event viewing permissions."
        )

    # Privileged staff who can view all requests and admin metrics
    privileged_roles = {
        ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN, ROLE_CAMPUS_DIRECTOR,
        ROLE_DEAN, ROLE_PRINCIPAL, ROLE_HOD, ROLE_FACULTY, ROLE_CLASS_ADVISOR
    }
    is_privileged = current_user.role in privileged_roles

    query = db.query(EventRequest)
    if status_filter:
        norm = normalize_status(status_filter).lower()
        query = query.filter(EventRequest.status.ilike(norm))
    if venue_id:
        query = query.filter(EventRequest.venue_id == venue_id)

    # Hierarchical scoping:
    if current_user.role in (ROLE_CAMPUS_DIRECTOR, ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN):
        # Campus Director, Central Resource Admin & SysAdmin: Institution-wide access
        pass
    elif current_user.role == ROLE_DEAN:
        # Dean: authorized departments/schools within Dean's scope + own requests + approved public events
        dept_scopes = get_user_department_scopes(current_user, db)
        query = query.filter(
            (EventRequest.status.in_(["approved", "APPROVED"])) |
            (EventRequest.organizer_id == current_user.id) |
            (EventRequest.department.in_(dept_scopes))
        )
    elif current_user.role == ROLE_HOD:
        # HOD: full operational visibility within department + own requests + approved public events
        dept_scopes = get_user_department_scopes(current_user, db)
        query = query.filter(
            (EventRequest.status.in_(["approved", "APPROVED"])) |
            (EventRequest.organizer_id == current_user.id) |
            (EventRequest.department.in_(dept_scopes))
        )
    elif current_user.role == ROLE_CLASS_ADVISOR:
        # Class Advisor: own requests + approved public events
        query = query.filter(
            (EventRequest.status.in_(["approved", "APPROVED"])) |
            (EventRequest.organizer_id == current_user.id)
        )
    else:
        # Students, Class Reps, General Faculty:
        query = query.filter(
            (EventRequest.status.in_(["approved", "APPROVED"])) |
            (EventRequest.organizer_id == current_user.id)
        )

    # Sort descending by priority and combined priority score, with submission time (created_at asc) and ID as stable tie-breaker
    events = query.order_by(
        EventRequest.priority.desc(),
        EventRequest.combined_priority_score.desc(),
        EventRequest.created_at.asc(),
        EventRequest.id.asc()
    ).all()

    return [
        serialize_event_for_response(
            evt,
            is_privileged=is_privileged,
            is_owner=(evt.organizer_id == current_user.id)
        )
        for evt in events
    ]


@router.get("/feed", response_model=List[EventResponse])
def get_public_event_feed(db: Session = Depends(get_db)):
    """Public campus feed of all confirmed and approved events."""
    events = db.query(EventRequest).filter(
        EventRequest.status.in_(["approved", "APPROVED"])
    ).order_by(EventRequest.event_date.asc()).all()
    
    return [serialize_event_for_response(evt, is_privileged=False, is_owner=False) for evt in events]


@router.get("/policy", response_model=BookingPolicyResponse)
def get_priority_policy(current_user: User = Depends(get_current_user)):
    """Returns the current configurable priority policy."""
    policy = get_booking_policy()
    return BookingPolicyResponse(
        version=policy.version,
        role_weight=policy.role_weight,
        purpose_weight=policy.purpose_weight,
        role_scores=policy.role_scores,
        purpose_scores=policy.purpose_scores,
        alternative_weights=policy.alternative_weights,
    )


@router.put("/policy", response_model=BookingPolicyResponse)
def update_priority_policy(
    policy_in: BookingPolicyUpdateRequest,
    current_user: User = Depends(require_permission("event.request.approve")),
    db: Session = Depends(get_db)
):
    """
    Updates configurable role scores, purpose scores, or weighting.
    Restricted to authorized resource/sys administrators.
    """
    policy = get_booking_policy()
    old_version = policy.version
    policy.update_policy(
        role_scores=policy_in.role_scores,
        purpose_scores=policy_in.purpose_scores,
        role_weight=policy_in.role_weight,
        purpose_weight=policy_in.purpose_weight,
        alternative_weights=policy_in.alternative_weights,
    )

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        "BOOKING_POLICY_UPDATED", "POLICY", policy.version,
        f"Updated priority policy from {old_version} to {policy.version} by {current_user.name}"
    )

    return BookingPolicyResponse(
        version=policy.version,
        role_weight=policy.role_weight,
        purpose_weight=policy.purpose_weight,
        role_scores=policy.role_scores,
        purpose_scores=policy.purpose_scores,
        alternative_weights=policy.alternative_weights,
    )


@router.get("/competing")
def get_competing_requests(
    venue_id: str,
    event_date: str,
    start_slot: str,
    end_slot: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Resolves competing requests overlapping for the same venue and time window:
    Ranks them by combined priority score, with earlier submission time and ID as tie-breakers.
    """
    all_requests = db.query(EventRequest).filter(
        EventRequest.venue_id == venue_id,
        EventRequest.event_date == event_date,
        EventRequest.status.in_(["pending", "PENDING", "under_review", "UNDER_REVIEW", "approved", "APPROVED", "alternatives_offered", "ALTERNATIVES_OFFERED"])
    ).all()

    overlapping = [
        r for r in all_requests
        if slots_overlap(start_slot, end_slot, r.start_slot, r.end_slot)
    ]

    # Deterministic Ranking: priority descending, submission time ascending, id ascending
    overlapping.sort(
        key=lambda r: (-float(r.combined_priority_score or 0.0), r.created_at, r.id)
    )

    competing_data = []
    for rank, req in enumerate(overlapping, start=1):
        is_rec_approval = (rank == 1 and normalize_status(req.status) != "REJECTED")
        competing_data.append({
            "rank": rank,
            "request_id": req.id,
            "event_name": req.name,
            "organizer": req.organizer,
            "organizer_id": req.organizer_id,
            "event_purpose": req.event_purpose or req.purpose,
            "role_score": req.role_score,
            "purpose_score": req.purpose_score,
            "combined_priority_score": req.combined_priority_score,
            "created_at": req.created_at.isoformat(),
            "status": req.status,
            "recommended_action": "RECOMMEND_APPROVAL" if is_rec_approval else "RECOMMEND_ALTERNATIVES",
            "score_breakdown": {
                "formula": f"(0.60 * {req.role_score}) + (0.40 * {req.purpose_score}) = {req.combined_priority_score}",
                "tie_breaker_used": "Submission Timestamp & Request ID" if rank > 1 else None,
            }
        })

    return {
        "venue_id": venue_id,
        "event_date": event_date,
        "start_slot": start_slot,
        "end_slot": end_slot,
        "total_competing": len(overlapping),
        "competing_requests": competing_data,
    }


@router.get("/{event_id}/competing")
def get_event_competing_requests(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    evt = db.query(EventRequest).filter(EventRequest.id == event_id).first()
    if not evt:
        raise HTTPException(status_code=404, detail="Event request not found")
    return get_competing_requests(
        venue_id=evt.venue_id,
        event_date=evt.event_date,
        start_slot=evt.start_slot,
        end_slot=evt.end_slot,
        current_user=current_user,
        db=db,
    )


@router.post("/auto-decide-cluster")
def auto_decide_cluster(
    venue_id: str = Query(...),
    event_date: str = Query(...),
    current_user: User = Depends(require_permission("event.request.approve")),
    db: Session = Depends(get_db),
):
    """
    Autonomous Algorithmic Decision-Making & Alternative Allocation Engine:
    Automatically evaluates priority model P = (0.60 * R) + (0.40 * E) for competing
    requests in a venue/date cluster:
    - Awards and auto-approves the top priority request.
    - Automatically generates feasible alternative venues & times for lower-priority parties.
    """
    venue = db.query(Room).filter(Room.id == venue_id).first()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    pending_in_cluster = db.query(EventRequest).filter(
        EventRequest.venue_id == venue_id,
        EventRequest.event_date == event_date,
        EventRequest.status.in_(["pending", "PENDING", "under_review", "UNDER_REVIEW"])
    ).all()

    if not pending_in_cluster:
        return {"message": "No pending competing requests found for this venue and date."}

    all_rooms = db.query(Room).all()
    confirmed_bookings = db.query(EventRequest).filter(
        EventRequest.status.in_(["approved", "APPROVED"])
    ).all()
    timetable_slots = db.query(TimetableSlot).all()

    res = auto_resolve_booking_decision(
        new_event=pending_in_cluster[0],
        db_session=db,
        all_rooms=all_rooms,
        preferred_room=venue,
        confirmed_bookings=confirmed_bookings,
        timetable_slots=timetable_slots,
        active_competing_requests=pending_in_cluster,
    )
    db.commit()

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        "AUTO_DECISION_CLUSTER_RESOLVED", "EVENT", venue_id,
        f"Autonomous Priority Engine auto-approved '{res['auto_approved_name']}' (P={res['winning_score']}) and allocated alternatives to {res['displaced_count']} lower-priority request(s)."
    )

    return {
        "status": "success",
        "message": f"Autonomous Priority Engine auto-approved '{res['auto_approved_name']}' (P={res['winning_score']}) and generated feasible alternatives for lower-priority party.",
        "details": res,
    }


@router.get("/{event_id}/alternatives")
def get_event_alternatives(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Stage A, B & C: Returns ranked alternative venues and alternate time slots for an event request.
    """
    evt = db.query(EventRequest).filter(EventRequest.id == event_id).first()
    if not evt:
        raise HTTPException(status_code=404, detail="Event request not found")

    # Only authorized admins or the organizer can view alternative options
    is_staff = current_user.role in [
        ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN, ROLE_CAMPUS_DIRECTOR,
        ROLE_DEAN, ROLE_PRINCIPAL, ROLE_HOD, ROLE_FACULTY, ROLE_CLASS_ADVISOR
    ]
    if not is_staff and evt.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot view alternatives for another user's request.")

    all_rooms = db.query(Room).all()
    confirmed_events = db.query(EventRequest).filter(
        EventRequest.status.in_(["approved", "APPROVED"])
    ).all()
    timetable_slots = db.query(TimetableSlot).all()

    # Stage A & B: Feasible and ranked alternative venues
    venue_alts = find_alternative_venues(
        all_rooms=all_rooms,
        preferred_room_id=evt.venue_id,
        event_date=evt.event_date,
        start_slot=evt.start_slot,
        end_slot=evt.end_slot,
        expected_audience=evt.expected_audience,
        confirmed_bookings=confirmed_events,
        timetable_slots=timetable_slots,
        requires_projector=bool(evt.requires_projector),
        requires_ac=bool(evt.requires_ac),
        requires_audio=bool(evt.requires_audio),
        limit=3,
    )

    # Stage C: Alternate time slots
    preferred_room = next((r for r in all_rooms if r.id == evt.venue_id), None)
    time_alts = find_alternative_time_slots(
        preferred_room=preferred_room,
        event_date=evt.event_date,
        start_slot=evt.start_slot,
        end_slot=evt.end_slot,
        expected_audience=evt.expected_audience,
        confirmed_bookings=confirmed_events,
        horizon_days=3,
        limit=3,
    )

    return {
        "event_id": evt.id,
        "event_name": evt.name,
        "preferred_venue_id": evt.venue_id,
        "preferred_venue_name": preferred_room.name if preferred_room else evt.venue_id,
        "event_date": evt.event_date,
        "start_slot": evt.start_slot,
        "end_slot": evt.end_slot,
        "alternative_venues": venue_alts,
        "alternative_times": time_alts,
    }


@router.post("/preview-priority", response_model=PriorityCalculationResponse)
def preview_event_priority(
    req: PriorityCalculationRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Previews Sigmoid-based priority score for given event parameters without saving.
    Uses authenticated user's verified role for stakeholder analysis.
    """
    res = calculate_event_priority(
        level=req.level,
        is_academic=req.is_academic,
        expected_audience=req.expected_audience,
        event_date=req.event_date,
        has_external_guests=req.has_external_guests,
        organizer_role=current_user.role,
    )
    return res


@router.post("/", response_model=EventResponse)
def request_event_venue(
    event_in: EventCreate,
    current_user: User = Depends(require_permission("event.request.create")),
    db: Session = Depends(get_db)
):
    venue = db.query(Room).filter(Room.id == event_in.venue_id).first()
    if not venue or venue.type != "event_venue":
        raise HTTPException(status_code=400, detail="Target venue not found or is not an event hall")

    # Hard Constraint Validation (Section 5)
    passes_hard, hard_failures = validate_hard_constraints(
        room=venue,
        expected_audience=event_in.expected_audience,
        requires_projector=event_in.requires_projector,
        requires_ac=event_in.requires_ac,
        requires_audio=event_in.requires_audio,
        room_type_preference=event_in.room_type_preference,
    )
    if not passes_hard:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Venue constraint failure: {'; '.join(hard_failures)}"
        )

    # Check date & slot conflict with already approved bookings (Hard Conflict -> HTTP 409)
    confirmed_conflict = db.query(EventRequest).filter(
        EventRequest.venue_id == event_in.venue_id,
        EventRequest.event_date == event_in.event_date,
        EventRequest.status.in_(["approved", "APPROVED"])
    ).all()

    for conf in confirmed_conflict:
        if slots_overlap(event_in.start_slot, event_in.end_slot, conf.start_slot, conf.end_slot):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Venue '{venue.name}' is already booked and confirmed for booking '{conf.name}' during the requested slot interval on {event_in.event_date}."
            )

    # Calculate Continuous Priority P = (0.60 * R) + (0.40 * E)
    prio_result = calculate_booking_priority(
        role=current_user.role,
        event_purpose=event_in.event_purpose or event_in.purpose,
    )

    # Calculate Legacy Sigmoid Priority for backward compatibility
    legacy_prio = calculate_event_priority(
        level=event_in.level,
        is_academic=event_in.is_academic,
        expected_audience=event_in.expected_audience,
        event_date=event_in.event_date,
        has_external_guests=event_in.has_external_guests,
        organizer_role=current_user.role,
    )

    # Competing Request Resolution & Recommendation Logic (Section 6 & 7)
    competing_active = db.query(EventRequest).filter(
        EventRequest.venue_id == event_in.venue_id,
        EventRequest.event_date == event_in.event_date,
        EventRequest.status.in_(["pending", "PENDING", "under_review", "UNDER_REVIEW"])
    ).all()

    overlapping_competing = [
        r for r in competing_active
        if slots_overlap(event_in.start_slot, event_in.end_slot, r.start_slot, r.end_slot)
    ]

    new_score = prio_result["combined_priority_score"]
    is_top_priority = True
    for comp in overlapping_competing:
        comp_score = float(comp.combined_priority_score or 0.0)
        # Deterministic tie-breaker: existing request was created earlier
        if comp_score > new_score or (comp_score == new_score):
            is_top_priority = False
            break

    recommended_action = "RECOMMEND_APPROVAL" if is_top_priority else "RECOMMEND_ALTERNATIVES"
    offered_alternatives_data = None

    # If this request is lower priority, search feasible alternatives right away (Stage A, B, C)
    if not is_top_priority:
        all_rooms = db.query(Room).all()
        confirmed_events = db.query(EventRequest).filter(
            EventRequest.status.in_(["approved", "APPROVED"])
        ).all()
        timetable_slots = db.query(TimetableSlot).all()

        alts_venues = find_alternative_venues(
            all_rooms=all_rooms,
            preferred_room_id=event_in.venue_id,
            event_date=event_in.event_date,
            start_slot=event_in.start_slot,
            end_slot=event_in.end_slot,
            expected_audience=event_in.expected_audience,
            confirmed_bookings=confirmed_events,
            timetable_slots=timetable_slots,
            requires_projector=event_in.requires_projector,
            requires_ac=event_in.requires_ac,
            requires_audio=event_in.requires_audio,
            limit=3,
        )
        alts_times = find_alternative_time_slots(
            preferred_room=venue,
            event_date=event_in.event_date,
            start_slot=event_in.start_slot,
            end_slot=event_in.end_slot,
            expected_audience=event_in.expected_audience,
            confirmed_bookings=confirmed_events,
            horizon_days=3,
            limit=3,
        )
        offered_alternatives_data = {
            "venues": alts_venues,
            "times": alts_times,
            "generated_at": datetime.utcnow().isoformat(),
        }

    evt = EventRequest(
        name=event_in.name,
        organizer=current_user.name,
        organizer_id=current_user.id,
        venue_id=event_in.venue_id,
        event_date=event_in.event_date,
        start_slot=event_in.start_slot,
        end_slot=event_in.end_slot,
        expected_audience=event_in.expected_audience,
        level=event_in.level,
        is_academic=event_in.is_academic,
        has_external_guests=event_in.has_external_guests,
        priority=legacy_prio["priority"],
        raw_score=legacy_prio["raw_score"],
        sigmoid_confidence=legacy_prio["sigmoid_confidence"],
        priority_score=int(round(new_score)),
        event_purpose=prio_result["event_purpose"],
        role_score=prio_result["role_score"],
        purpose_score=prio_result["purpose_score"],
        combined_priority_score=new_score,
        policy_version=prio_result["policy_version"],
        requires_projector=event_in.requires_projector,
        requires_ac=event_in.requires_ac,
        requires_audio=event_in.requires_audio,
        room_type_preference=event_in.room_type_preference,
        recommended_action=recommended_action,
        offered_alternatives=json.dumps(offered_alternatives_data) if offered_alternatives_data else None,
        av_requirements=event_in.av_requirements,
        purpose=event_in.purpose or event_in.event_purpose,
        department=current_user.department or "General Campus",
        status="pending"
    )
    db.add(evt)
    db.commit()
    db.refresh(evt)

    # If the new request displaced previously recommended requests, update their recommendations
    if is_top_priority and overlapping_competing:
        for comp in overlapping_competing:
            if comp.recommended_action != "RECOMMEND_ALTERNATIVES":
                comp.recommended_action = "RECOMMEND_ALTERNATIVES"
        db.commit()

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        "EVENT_REQUESTED", "EVENT", evt.id,
        f"Event '{evt.name}' requested for {evt.event_date} (Combined Priority: {new_score}, Action: {recommended_action})"
    )

    # Notify Central Resource Admins
    admins = db.query(User).filter(User.role.in_([ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN])).all()
    for adm in admins:
        send_notification(
            db, adm.id, "New Venue Request Submitted",
            f"'{evt.name}' [Priority {new_score}] requested by {current_user.name} for {venue.name} on {evt.event_date}.",
            category="event", link="/events"
        )

    return serialize_event_for_response(evt, is_privileged=True, is_owner=True)


@router.post("/{event_id}/select-alternative", response_model=EventResponse)
def select_event_alternative(
    event_id: str,
    selection_in: AlternativeSelectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Stage D: Requester selects an alternative venue or alternative time.
    Transactionally rechecks availability and validates state transition.
    """
    evt = db.query(EventRequest).filter(EventRequest.id == event_id).first()
    if not evt:
        raise HTTPException(status_code=404, detail="Event request not found")

    # Only requester or authorized admin can choose alternative
    is_admin = current_user.role in [ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN]
    if not is_admin and evt.organizer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only the booking organizer or administrator can select alternatives."
        )

    # State Machine Validation
    is_valid_tx, err_msg = validate_state_transition(evt.status, "ALTERNATIVE_SELECTED")
    if not is_valid_tx:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

    # Validate target room exists
    cand_room = db.query(Room).filter(Room.id == selection_in.selected_venue_id).first()
    if not cand_room:
        raise HTTPException(status_code=404, detail="Selected alternative venue does not exist.")

    # Transactional Recheck of Hard Constraints & Availability (Section 7 Stage D & Section 5)
    passes_hard, hard_failures = validate_hard_constraints(
        room=cand_room,
        expected_audience=evt.expected_audience,
        requires_projector=bool(evt.requires_projector),
        requires_ac=bool(evt.requires_ac),
        requires_audio=bool(evt.requires_audio),
    )
    if not passes_hard:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Alternative venue no longer satisfies hard constraints: {'; '.join(hard_failures)}"
        )

    # Check for confirmed booking conflict on the alternative slot
    conflicts = db.query(EventRequest).filter(
        EventRequest.venue_id == selection_in.selected_venue_id,
        EventRequest.event_date == selection_in.selected_date,
        EventRequest.status.in_(["approved", "APPROVED"]),
        EventRequest.id != evt.id
    ).all()

    for c in conflicts:
        if slots_overlap(selection_in.selected_start_slot, selection_in.selected_end_slot, c.start_slot, c.end_slot):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"The selected alternative slot is no longer available. Venue '{cand_room.name}' has been booked for '{c.name}'."
            )

    # Update event request with the chosen alternative
    old_venue_id = evt.venue_id
    old_date = evt.event_date
    evt.venue_id = selection_in.selected_venue_id
    evt.event_date = selection_in.selected_date
    evt.start_slot = selection_in.selected_start_slot
    evt.end_slot = selection_in.selected_end_slot
    evt.status = "ALTERNATIVE_SELECTED"
    evt.recommended_action = "RECOMMEND_APPROVAL"
    evt.selected_alternative = json.dumps({
        "selection_type": selection_in.selection_type,
        "selected_venue_id": selection_in.selected_venue_id,
        "selected_venue_name": cand_room.name,
        "selected_date": selection_in.selected_date,
        "selected_start_slot": selection_in.selected_start_slot,
        "selected_end_slot": selection_in.selected_end_slot,
        "previous_venue_id": old_venue_id,
        "previous_date": old_date,
        "notes": selection_in.notes,
        "timestamp": datetime.utcnow().isoformat(),
    })

    db.commit()
    db.refresh(evt)

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        "ALTERNATIVE_SELECTED", "EVENT", evt.id,
        f"Alternative selected: '{cand_room.name}' on {evt.event_date} ({evt.start_slot}-{evt.end_slot}). Notes: {selection_in.notes}"
    )

    # Notify Central Resource Admins of alternative selection
    admins = db.query(User).filter(User.role.in_([ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN])).all()
    for adm in admins:
        send_notification(
            db, adm.id, "Alternative Slot Selected",
            f"Requester {current_user.name} selected alternative venue '{cand_room.name}' for event '{evt.name}' on {evt.event_date}.",
            category="event", link="/events"
        )

    return serialize_event_for_response(evt, is_privileged=True, is_owner=True)


@router.post("/{event_id}/recommend", response_model=EventResponse)
def recommend_event_request(
    event_id: str,
    rec_in: EventRecommendationCreate,
    current_user: User = Depends(require_permission("event.request.recommend")),
    db: Session = Depends(get_db)
):
    """
    Department Review & Recommendations Workflow:
    Advisors, HODs, Deans, and Resource Admins review requests and record recommendations.
    CRITICAL: Intermediate reviewers cannot finalize approval (status cannot be set to APPROVED here).
    """
    evt = db.query(EventRequest).filter(EventRequest.id == event_id).first()
    if not evt:
        raise HTTPException(status_code=404, detail="Event request not found")

    rec_status = rec_in.recommendation.upper().strip()
    if rec_status == "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Final approval is reserved exclusively for the Campus Director. Intermediate reviewers may only recommend approval (RECOMMENDED), request modifications (CHANGES_REQUESTED), or mark under review."
        )

    if rec_status not in ["RECOMMENDED", "CHANGES_REQUESTED", "UNDER_REVIEW", "AWAITING_DIRECTOR_APPROVAL"]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid recommendation status '{rec_in.recommendation}'. Must be RECOMMENDED, CHANGES_REQUESTED, or UNDER_REVIEW."
        )

    # Scoping check: If Dean or HOD, verify department scope
    if current_user.role in (ROLE_HOD, ROLE_DEAN):
        dept_scopes = get_user_department_scopes(current_user, db)
        if "*" not in dept_scopes and evt.department and evt.department not in dept_scopes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: You do not have administrative review authority over department '{evt.department}'."
            )

    evt.department_recommendation = rec_status
    evt.department_reviewer_id = current_user.id
    evt.department_reviewer_name = current_user.name
    evt.department_review_notes = rec_in.notes
    evt.status = "awaiting_director_approval" if rec_status == "RECOMMENDED" else rec_status.lower()

    db.commit()
    db.refresh(evt)

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        f"EVENT_{rec_status}", "EVENT", evt.id,
        f"Recommendation by {current_user.name} ({current_user.role}): {rec_status}. Notes: {rec_in.notes}"
    )

    send_notification(
        db, evt.organizer_id, f"Event Request {rec_status.replace('_', ' ').title()}",
        f"Your event request '{evt.name}' has received a recommendation: {rec_status} by {current_user.name}.",
        category="event", link="/events"
    )

    return serialize_event_for_response(evt, is_privileged=True, is_owner=(evt.organizer_id == current_user.id))


@router.post("/{event_id}/review", response_model=EventResponse)
def review_event_request(
    event_id: str,
    review_in: EventReview,
    current_user: User = Depends(require_permission("event.request.review")),
    db: Session = Depends(get_db)
):
    evt = db.query(EventRequest).filter(EventRequest.id == event_id).first()
    if not evt:
        raise HTTPException(status_code=404, detail="Event request not found")

    # Conflict of Interest: Prevent self-approval (Section 6 & 9)
    if evt.organizer_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conflict of Interest: Users are strictly prohibited from approving their own event venue requests."
        )

    target_status = normalize_status(review_in.decision)
    if target_status not in [
        "APPROVED", "REJECTED", "ALTERNATIVES_OFFERED", "UNDER_REVIEW",
        "RECOMMENDED", "CHANGES_REQUESTED", "AWAITING_DIRECTOR_APPROVAL"
    ]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid decision '{review_in.decision}'. Allowed decisions: approved, rejected, alternatives_offered, under_review, recommended, changes_requested"
        )

    # CRITICAL RULE: Campus Director is the final approval authority for event requests and campus resource bookings!
    if target_status == "APPROVED":
        if current_user.role != ROLE_CAMPUS_DIRECTOR:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: The Campus Director is the final approval authority for event requests and campus resource bookings. Other roles may submit recommendations, but must not bypass the Campus Director's final approval."
            )

    # Enforce State Machine Transitions (Section 8)
    is_valid_tx, err_msg = validate_state_transition(evt.status, target_status)
    if not is_valid_tx:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

    # On Approval: Check Hard Conflicts & Override Justification (Section 5 & 6)
    if target_status == "APPROVED":
        # 1. Recheck confirmed conflict
        conflict = db.query(EventRequest).filter(
            EventRequest.venue_id == evt.venue_id,
            EventRequest.event_date == evt.event_date,
            EventRequest.status.in_(["approved", "APPROVED"]),
            EventRequest.id != evt.id
        ).all()

        for conf in conflict:
            if slots_overlap(evt.start_slot, evt.end_slot, conf.start_slot, conf.end_slot):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Slot is no longer available. Overlapping booking '{conf.name}' is already confirmed."
                )

        # 2. Check if approving a lower-ranked request over a higher-ranked competing request
        competing = db.query(EventRequest).filter(
            EventRequest.venue_id == evt.venue_id,
            EventRequest.event_date == evt.event_date,
            EventRequest.status.in_(["pending", "PENDING", "under_review", "UNDER_REVIEW", "alternatives_offered", "ALTERNATIVES_OFFERED"]),
            EventRequest.id != evt.id
        ).all()

        higher_priority_competitors = [
            comp for comp in competing
            if slots_overlap(evt.start_slot, evt.end_slot, comp.start_slot, comp.end_slot)
            and float(comp.combined_priority_score or 0.0) > float(evt.combined_priority_score or 0.0)
        ]

        if higher_priority_competitors:
            justification = (review_in.override_justification or "").strip()
            if not justification or len(justification) < 5:
                top_comp = higher_priority_competitors[0]
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Written justification is strictly required to override higher-priority competing request "
                        f"'{top_comp.name}' (Score: {top_comp.combined_priority_score} vs {evt.combined_priority_score})."
                    )
                )
            evt.override_justification = justification
            evt.director_override_applied = True

        evt.director_id = current_user.id
        evt.director_name = current_user.name
        evt.director_decision = "APPROVED"
        evt.director_notes = review_in.notes

    elif target_status == "REJECTED":
        evt.director_id = current_user.id
        evt.director_name = current_user.name
        evt.director_decision = "REJECTED"
        evt.rejection_reason = review_in.notes

    elif target_status in ["RECOMMENDED", "CHANGES_REQUESTED", "UNDER_REVIEW"]:
        evt.department_reviewer_id = current_user.id
        evt.department_reviewer_name = current_user.name
        evt.department_recommendation = target_status
        evt.department_review_notes = review_in.notes

    evt.status = target_status.lower() if target_status in ["APPROVED", "REJECTED"] else target_status
    evt.admin_notes = review_in.notes
    db.commit()
    db.refresh(evt)

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        f"EVENT_{target_status}", "EVENT", evt.id,
        f"Decision: {target_status} by {current_user.name}. Notes: {review_in.notes}. Justification: {evt.override_justification or 'None'}"
    )

    action_label = "approved" if target_status == "APPROVED" else ("declined" if target_status == "REJECTED" else target_status.lower())
    send_notification(
        db, evt.organizer_id, f"Event Venue Request {action_label.capitalize()}",
        f"Your reservation for '{evt.name}' on {evt.event_date} has been {action_label}.",
        category="event", link="/events"
    )

    return serialize_event_for_response(evt, is_privileged=True, is_owner=True)
