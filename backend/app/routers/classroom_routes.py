from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Room, TimetableSlot, RoomBooking, User
from app.schemas import RoomResponse, BookingCreate, BookingResponse, TimetableSlotResponse
from app.auth import get_current_user, require_roles, record_audit, send_notification
from app.config import (
    ROLE_STUDENT, ROLE_CLASS_REP, ROLE_CLASS_ADVISOR, ROLE_FACULTY,
    ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN
)

router = APIRouter(prefix="/classrooms", tags=["Classrooms"])

BOOKABLE_ROLES = [ROLE_CLASS_REP, ROLE_FACULTY, ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN]

DAY_NAME_MAP = {
    0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday", 4: "Friday", 5: "Saturday", 6: "Sunday"
}

@router.get("/rooms", response_model=List[RoomResponse])
def list_rooms(
    type: Optional[str] = Query(None, description="classroom or event_venue"),
    building: Optional[str] = None,
    min_capacity: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Room)
    if type:
        query = query.filter(Room.type == type)
    if building:
        query = query.filter(Room.building == building)
    if min_capacity:
        query = query.filter(Room.capacity >= min_capacity)
    return query.all()

@router.get("/timetable", response_model=List[TimetableSlotResponse])
def get_timetable(
    day: Optional[str] = None,
    room_id: Optional[str] = None,
    class_section: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(TimetableSlot)
    if day:
        query = query.filter(TimetableSlot.day == day)
    if room_id:
        query = query.filter(TimetableSlot.room_id == room_id)
    if class_section:
        query = query.filter(TimetableSlot.class_section == class_section)
    return query.all()

@router.get("/availability")
def get_availability(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    room_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Computes live slot availability for each room by checking:
    1. Timetabled classes for the given day of the week
    2. Active room bookings for that specific date
    3. Maintenance status
    """
    try:
        dt = datetime.strptime(date, "%Y-%m-%d")
        day_of_week = DAY_NAME_MAP[dt.weekday()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    rooms_query = db.query(Room).filter(Room.type == "classroom")
    if room_id:
        rooms_query = rooms_query.filter(Room.id == room_id)
    rooms = rooms_query.all()

    # Get timetable slots for that day of week
    timetable_slots = db.query(TimetableSlot).filter(TimetableSlot.day == day_of_week).all()
    # Get active bookings for that date
    active_bookings = db.query(RoomBooking).filter(
        RoomBooking.booking_date == date,
        RoomBooking.status.in_(["booked", "checked_in"])
    ).all()

    results = []
    for r in rooms:
        r_tt = [s for s in timetable_slots if s.room_id == r.id]
        r_bk = [b for b in active_bookings if b.room_id == r.id]

        slots_status = {}
        all_slots = ["slot2", "slot3", "slot4", "slot5", "slot6", "slot8", "slot9", "slot10"]
        for slot in all_slots:
            # Check timetable
            tt_match = next((s for s in r_tt if s.slot_id == slot), None)
            bk_match = next((b for b in r_bk if b.slot_id == slot), None)

            if r.is_under_maintenance:
                status_str = "maintenance"
                details = "Room under maintenance"
            elif tt_match:
                status_str = "timetabled"
                details = f"{tt_match.code or ''}: {tt_match.course_name} ({tt_match.faculty})"
            elif bk_match:
                status_str = "booked"
                details = f"Booked by {bk_match.booked_by_name} ({bk_match.purpose or 'Academic session'})"
            else:
                status_str = "free"
                details = "Available"

            slots_status[slot] = {
                "status": status_str,
                "details": details,
                "booking_id": bk_match.id if bk_match else None
            }

        results.append({
            "room_id": r.id,
            "room_name": r.name,
            "building": r.building,
            "capacity": r.capacity,
            "floor": r.floor,
            "slots": slots_status
        })

    return {"date": date, "day_of_week": day_of_week, "availability": results}

@router.post("/book", response_model=BookingResponse)
def book_classroom(
    booking_in: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Server-side RBAC check
    if current_user.role not in BOOKABLE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Students cannot directly book classrooms without Class Representative credentials. Your role is '{current_user.role}'."
        )

    # 2. Check room exists & is classroom
    room = db.query(Room).filter(Room.id == booking_in.room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.is_under_maintenance:
        raise HTTPException(status_code=400, detail="Room is currently under maintenance")

    # 3. Check timetable conflict
    try:
        dt = datetime.strptime(booking_in.booking_date, "%Y-%m-%d")
        day_of_week = DAY_NAME_MAP[dt.weekday()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    tt_conflict = db.query(TimetableSlot).filter(
        TimetableSlot.room_id == booking_in.room_id,
        TimetableSlot.day == day_of_week,
        TimetableSlot.slot_id == booking_in.slot_id
    ).first()

    if tt_conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Conflict: Slot already occupied by official timetable ({tt_conflict.course_name} taught by {tt_conflict.faculty})."
        )

    # 4. Check existing active booking conflict (Double-booking prevention!)
    existing_booking = db.query(RoomBooking).filter(
        RoomBooking.room_id == booking_in.room_id,
        RoomBooking.booking_date == booking_in.booking_date,
        RoomBooking.slot_id == booking_in.slot_id,
        RoomBooking.status.in_(["booked", "checked_in"])
    ).first()

    if existing_booking:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Double-booking prevented: Slot is already reserved by {existing_booking.booked_by_name}."
        )

    # Slot start & end time lookup
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
    st, et = slot_times.get(booking_in.slot_id, ("09:00", "10:00"))

    booking = RoomBooking(
        room_id=booking_in.room_id,
        booking_date=booking_in.booking_date,
        slot_id=booking_in.slot_id,
        start_time=st,
        end_time=et,
        booked_by=current_user.id,
        booked_by_name=current_user.name,
        purpose=booking_in.purpose,
        status="booked"
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    # Audit & Notification
    record_audit(
        db, current_user.id, current_user.name, current_user.role,
        "ROOM_BOOKED", "ROOM_BOOKING", booking.id,
        f"Booked {room.name} on {booking_in.booking_date} {booking_in.slot_id}"
    )
    send_notification(
        db, current_user.id, "Classroom Booking Confirmed",
        f"Reserved {room.name} for {booking_in.booking_date} ({booking_in.slot_id}).",
        category="booking", link="/classrooms"
    )

    return booking

@router.post("/bookings/{booking_id}/checkin")
def checkin_booking(
    booking_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(RoomBooking).filter(RoomBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "booked":
        raise HTTPException(status_code=400, detail=f"Cannot check in booking with status '{booking.status}'")

    booking.status = "checked_in"
    booking.checked_in_at = datetime.utcnow()
    db.commit()

    record_audit(db, current_user.id, current_user.name, current_user.role, "CHECKIN", "ROOM_BOOKING", booking.id, "Simulated QR check-in completed")
    return {"message": "Checked in successfully", "status": booking.status}

@router.post("/bookings/{booking_id}/cancel")
def cancel_booking(
    booking_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(RoomBooking).filter(RoomBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.booked_by != current_user.id and current_user.role not in [ROLE_RESOURCE_ADMIN, ROLE_SYS_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this booking")

    booking.status = "cancelled"
    booking.released_at = datetime.utcnow()
    db.commit()

    record_audit(db, current_user.id, current_user.name, current_user.role, "BOOKING_CANCELLED", "ROOM_BOOKING", booking.id, "Booking released")
    return {"message": "Booking cancelled", "status": booking.status}
