import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Boolean, Float, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from app.database import Base

def gen_id():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    role = Column(String, index=True, nullable=False)
    department = Column(String, nullable=True)
    class_section = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    bookings = relationship("RoomBooking", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")

class Department(Base):
    __tablename__ = "departments"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    building = Column(String, nullable=False)

class Room(Base):
    __tablename__ = "rooms"

    id = Column(String, primary_key=True)  # e.g. 'AB1-E103B'
    name = Column(String, nullable=False)
    building = Column(String, index=True, nullable=False)
    floor = Column(String, nullable=True)
    capacity = Column(Integer, default=60)
    type = Column(String, index=True, default="classroom")  # 'classroom', 'event_venue'
    has_projector = Column(Boolean, default=True)
    has_ac = Column(Boolean, default=False)
    has_audio = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    is_under_maintenance = Column(Boolean, default=False)

    timetable_slots = relationship("TimetableSlot", back_populates="room", cascade="all, delete-orphan")
    bookings = relationship("RoomBooking", back_populates="room", cascade="all, delete-orphan")

class TimetableSlot(Base):
    __tablename__ = "timetable_slots"

    id = Column(String, primary_key=True, default=gen_id)
    room_id = Column(String, ForeignKey("rooms.id"), nullable=False, index=True)
    day = Column(String, nullable=False, index=True)  # 'Monday'..'Friday'
    slot_id = Column(String, nullable=False)  # 'slot2'..'slot10'
    start_time = Column(String, nullable=False)  # '08:50'
    end_time = Column(String, nullable=False)  # '09:40'
    code = Column(String, nullable=True)  # e.g. '22CSC401'
    course_name = Column(String, nullable=True)
    faculty = Column(String, nullable=True)
    class_section = Column(String, nullable=True)
    advisor = Column(String, nullable=True)

    room = relationship("Room", back_populates="timetable_slots")

class RoomBooking(Base):
    __tablename__ = "room_bookings"

    id = Column(String, primary_key=True, default=gen_id)
    room_id = Column(String, ForeignKey("rooms.id"), nullable=False, index=True)
    booking_date = Column(String, nullable=False, index=True)  # YYYY-MM-DD
    slot_id = Column(String, nullable=False)
    start_time = Column(String, nullable=False)
    end_time = Column(String, nullable=False)
    booked_by = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    booked_by_name = Column(String, nullable=False)
    purpose = Column(String, nullable=True)
    status = Column(String, default="booked", index=True)  # 'booked', 'checked_in', 'released', 'cancelled'
    created_at = Column(DateTime, default=datetime.utcnow)
    checked_in_at = Column(DateTime, nullable=True)
    released_at = Column(DateTime, nullable=True)
    admin_override_reason = Column(Text, nullable=True)

    room = relationship("Room", back_populates="bookings")
    user = relationship("User", back_populates="bookings")

class TimetableChangeRequest(Base):
    __tablename__ = "timetable_change_requests"

    id = Column(String, primary_key=True, default=gen_id)
    course_code = Column(String, nullable=False)
    course_name = Column(String, nullable=False)
    class_section = Column(String, nullable=False)
    requester_id = Column(String, ForeignKey("users.id"), nullable=False)
    requester_name = Column(String, nullable=False)
    original_day = Column(String, nullable=False)
    original_slot = Column(String, nullable=False)
    original_room_id = Column(String, nullable=False)
    proposed_day = Column(String, nullable=False)
    proposed_slot = Column(String, nullable=False)
    proposed_room_id = Column(String, nullable=False)
    proposed_date = Column(String, nullable=True)
    reason = Column(Text, nullable=False)
    status = Column(String, default="pending", index=True)  # 'pending', 'approved', 'rejected', 'modification_requested'
    approver_id = Column(String, nullable=True)
    approver_name = Column(String, nullable=True)
    review_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class EventRequest(Base):
    __tablename__ = "event_requests"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    organizer = Column(String, nullable=False)
    organizer_id = Column(String, ForeignKey("users.id"), nullable=False)
    venue_id = Column(String, ForeignKey("rooms.id"), nullable=False)
    event_date = Column(String, nullable=False, index=True)
    start_slot = Column(String, nullable=False)
    end_slot = Column(String, nullable=False)
    expected_audience = Column(Integer, default=100)
    level = Column(String, default="department")  # 'university', 'department', 'club'
    is_academic = Column(Boolean, default=True)
    has_external_guests = Column(Boolean, default=False)
    priority_score = Column(Integer, default=50)
    av_requirements = Column(String, nullable=True)
    purpose = Column(Text, nullable=True)
    status = Column(String, default="pending", index=True)  # 'pending', 'approved', 'declined', 'cancelled'
    admin_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Facility(Base):
    __tablename__ = "facilities"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # 'equipment', 'compute'
    location = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    contact = Column(String, nullable=True)
    induction_required = Column(Boolean, default=True)
    allocation_model = Column(String, default="time_slot")  # 'time_slot', 'compute_time'
    image = Column(String, default="🔧")
    status = Column(String, default="available")  # 'available', 'maintenance', 'offline'
    maintenance_reason = Column(Text, nullable=True)
    responsible_staff_id = Column(String, nullable=True)
    responsible_staff_name = Column(String, nullable=True)

class FacilityBooking(Base):
    __tablename__ = "facility_bookings"

    id = Column(String, primary_key=True, default=gen_id)
    facility_id = Column(String, ForeignKey("facilities.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    user_name = Column(String, nullable=False)
    booking_date = Column(String, nullable=False)
    slot_id = Column(String, nullable=False)
    duration_hours = Column(Float, default=1.0)
    project_title = Column(String, nullable=True)
    status = Column(String, default="booked")  # 'booked', 'completed', 'cancelled'
    created_at = Column(DateTime, default=datetime.utcnow)

class HPCAllocation(Base):
    __tablename__ = "hpc_allocations"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    user_name = Column(String, nullable=False)
    project_name = Column(String, nullable=False)
    node_hours = Column(Integer, default=10)
    supervisor_name = Column(String, nullable=False)
    status = Column(String, default="pending")  # 'pending', 'approved', 'declined'
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class UserInduction(Base):
    __tablename__ = "user_inductions"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    facility_id = Column(String, ForeignKey("facilities.id"), nullable=False)
    inducted_at = Column(DateTime, default=datetime.utcnow)
    inducted_by = Column(String, nullable=False)

class LostFoundItem(Base):
    __tablename__ = "lost_found_items"

    id = Column(String, primary_key=True, default=gen_id)
    report_type = Column(String, nullable=False, index=True)  # 'found', 'lost'
    title = Column(String, nullable=False)
    category = Column(String, index=True, nullable=False)  # 'electronics', 'documents', 'accessories', 'keys', 'bags', 'other'
    description = Column(Text, nullable=False)
    location_found = Column(String, nullable=False)
    is_classroom = Column(Boolean, default=False)
    room_id = Column(String, nullable=True)
    found_date = Column(String, nullable=False)
    found_time = Column(String, nullable=True)
    photo_url = Column(Text, nullable=True)
    finder_id = Column(String, ForeignKey("users.id"), nullable=False)
    finder_name = Column(String, nullable=False)
    current_custody = Column(String, default="finder")  # 'finder', 'class_advisor', 'student_welfare', 'central_office'
    storage_location = Column(String, default="Campus Security Desk")
    assigned_handler_id = Column(String, nullable=True)
    assigned_handler_name = Column(String, nullable=False)
    routing_reason = Column(Text, nullable=True)
    status = Column(String, default="reported", index=True)  # 'reported', 'in_custody', 'claim_pending', 'returned', 'unclaimed', 'closed'
    return_date = Column(String, nullable=True)
    handover_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    claims = relationship("ItemClaim", back_populates="item", cascade="all, delete-orphan")
    custody_logs = relationship("CustodyLog", back_populates="item", cascade="all, delete-orphan")

class ItemClaim(Base):
    __tablename__ = "item_claims"

    id = Column(String, primary_key=True, default=gen_id)
    item_id = Column(String, ForeignKey("lost_found_items.id"), nullable=False)
    claimant_id = Column(String, ForeignKey("users.id"), nullable=False)
    claimant_name = Column(String, nullable=False)
    proof_description = Column(Text, nullable=False)
    contact_phone = Column(String, nullable=True)
    status = Column(String, default="pending")  # 'pending', 'proof_requested', 'approved', 'rejected'
    handler_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    item = relationship("LostFoundItem", back_populates="claims")

class CustodyLog(Base):
    __tablename__ = "custody_logs"

    id = Column(String, primary_key=True, default=gen_id)
    item_id = Column(String, ForeignKey("lost_found_items.id"), nullable=False)
    actor_id = Column(String, nullable=False)
    actor_name = Column(String, nullable=False)
    action = Column(String, nullable=False)  # 'reported', 'custody_transferred', 'claim_filed', 'proof_requested', 'returned', 'closed'
    from_custodian = Column(String, nullable=True)
    to_custodian = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    item = relationship("LostFoundItem", back_populates="custody_logs")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=gen_id)
    recipient_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    category = Column(String, default="system")  # 'booking', 'timetable', 'event', 'facility', 'lost_found', 'system'
    link = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=gen_id)
    actor_id = Column(String, nullable=False)
    actor_name = Column(String, nullable=False)
    actor_role = Column(String, nullable=False)
    action = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
