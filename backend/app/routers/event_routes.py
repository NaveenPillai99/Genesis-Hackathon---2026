from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import EventRequest, Room, User
from app.schemas import EventRequestCreate, EventReviewRequest, EventResponse
from app.auth import get_current_user, require_roles, record_audit, send_notification
from app.config import (
    ROLE_FACULTY, ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN
)

router = APIRouter(prefix="/events", tags=["Event Venues"])

CAN_REQUEST_EVENT = [ROLE_FACULTY, ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN]
CAN_APPROVE_EVENT = [ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN]

def calculate_priority_score(level: str, is_academic: bool, has_external_guests: bool, audience: int) -> int:
    score = 0
    if level == "university":
        score += 40
    elif level == "department":
        score += 25
    else:
        score += 10

    if is_academic:
        score += 20
    if has_external_guests:
        score += 15

    audience_pts = min(25, max(5, int(audience / 15)))
    score += audience_pts
    return min(100, score)

@router.get("/", response_model=List[EventResponse])
def list_events(
    status: Optional[str] = None,
    venue_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(EventRequest)
    if status:
        query = query.filter(EventRequest.status == status)
    if venue_id:
        query = query.filter(EventRequest.venue_id == venue_id)
    return query.order_by(EventRequest.event_date.asc()).all()

@router.get("/feed", response_model=List[EventResponse])
def get_public_event_feed(db: Session = Depends(get_db)):
    """Public campus feed of all confirmed and approved events."""
    return db.query(EventRequest).filter(
        EventRequest.status == "approved"
    ).order_by(EventRequest.event_date.asc()).all()

@router.post("/", response_model=EventResponse)
def request_event_venue(
    event_in: EventRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in CAN_REQUEST_EVENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{current_user.role}' cannot request major event venues. Faculty or Admin credentials required."
        )

    venue = db.query(Room).filter(Room.id == event_in.venue_id).first()
    if not venue or venue.type != "event_venue":
        raise HTTPException(status_code=400, detail="Target venue not found or is not an event hall")

    # Check date conflict with already approved events
    conflict = db.query(EventRequest).filter(
        EventRequest.venue_id == event_in.venue_id,
        EventRequest.event_date == event_in.event_date,
        EventRequest.status == "approved"
    ).first()

    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Venue '{venue.name}' is already booked for '{conflict.name}' on {event_in.event_date}."
        )

    priority = calculate_priority_score(
        event_in.level, event_in.is_academic, event_in.has_external_guests, event_in.expected_audience
    )

    # Resource Admin auto-approves their own events
    initial_status = "approved" if current_user.role in CAN_APPROVE_EVENT else "pending"

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
        priority_score=priority,
        av_requirements=event_in.av_requirements,
        purpose=event_in.purpose,
        status=initial_status
    )
    db.add(evt)
    db.commit()
    db.refresh(evt)

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        "EVENT_REQUESTED", "EVENT", evt.id,
        f"Event '{evt.name}' requested for {evt.event_date} (Priority: {priority})"
    )

    # Notify Central Resource Admins
    admins = db.query(User).filter(User.role.in_([ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN])).all()
    for adm in admins:
        send_notification(
            db, adm.id, "New Venue Request Submitted",
            f"'{evt.name}' requested by {current_user.name} for {venue.name} on {evt.event_date}.",
            category="event", link="/events"
        )

    return evt

@router.post("/{event_id}/review", response_model=EventResponse)
def review_event_request(
    event_id: str,
    review_in: EventReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in CAN_APPROVE_EVENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Central Resource Admins can approve or decline venue reservations."
        )

    evt = db.query(EventRequest).filter(EventRequest.id == event_id).first()
    if not evt:
        raise HTTPException(status_code=404, detail="Event request not found")

    if review_in.decision not in ["approved", "declined"]:
        raise HTTPException(status_code=400, detail="Decision must be 'approved' or 'declined'")

    evt.status = review_in.decision
    evt.admin_notes = review_in.admin_notes
    evt.rejection_reason = review_in.rejection_reason

    db.commit()
    db.refresh(evt)

    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        f"EVENT_{evt.status.upper()}", "EVENT", evt.id,
        f"Admin {current_user.name} set status to {evt.status}"
    )

    send_notification(
        db, evt.organizer_id, f"Venue Request {evt.status.capitalize()}",
        f"Your event '{evt.name}' has been {evt.status}. Reason: {review_in.rejection_reason or 'Approved by Event Office'}.",
        category="event", link="/events"
    )

    return evt
