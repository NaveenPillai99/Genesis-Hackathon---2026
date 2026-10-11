import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Boolean, Float, DateTime, ForeignKey, Text, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base

def gen_id():
    return str(uuid.uuid4())

class Role(Base):
    __tablename__ = "roles"

    id = Column(String, primary_key=True)  # 'student', 'class_rep', 'class_advisor', 'faculty', 'hpc_faculty', 'lab_assistant', 'lab_admin', 'resource_admin', 'lost_property_handler', 'sys_admin'
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

class Permission(Base):
    __tablename__ = "permissions"

    id = Column(String, primary_key=True)  # e.g. 'event.view', 'event.request.create', 'hpc.manage_nodes'
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # 'event', 'classroom', 'timetable', 'facility', 'hpc', 'lost_found', 'audit', 'system'
    description = Column(String, nullable=True)

class RolePermission(Base):
    __tablename__ = "role_permissions"

    id = Column(String, primary_key=True, default=gen_id)
    role_id = Column(String, ForeignKey("roles.id"), nullable=False, index=True)
    permission_id = Column(String, ForeignKey("permissions.id"), nullable=False, index=True)

class ResourceAssignment(Base):
    __tablename__ = "resource_assignments"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    scope_type = Column(String, nullable=False)  # 'class_section', 'facility', 'department', 'room'
    scope_id = Column(String, nullable=False)    # e.g. 'Int. M.Sc Data Science, VII B', 'fac-3dprint', 'fac-hpc'
    created_at = Column(DateTime, default=datetime.utcnow)

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    role = Column(String, index=True, nullable=False)
    department = Column(String, nullable=True)
    class_section = Column(String, nullable=True)
    assigned_facility_id = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    bookings = relationship("RoomBooking", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    resource_assignments = relationship("ResourceAssignment", backref="user", cascade="all, delete-orphan")

class Department(Base):
    __tablename__ = "departments"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    building = Column(String, nullable=True, default="Campus Center")
    department_name = Column(String, nullable=True)
    code = Column(String, nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

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

class HPCNode(Base):
    __tablename__ = "hpc_nodes"

    id = Column(String, primary_key=True)  # 'node-gpu-01'
    name = Column(String, nullable=False)  # 'CCE-DGX-A100-01'
    cluster_id = Column(String, default="cce-hpc-cluster")
    status = Column(String, default="healthy", index=True)  # 'healthy', 'busy', 'idle', 'offline', 'maintenance'
    cpu_cores = Column(Integer, default=64)
    memory_gb = Column(Integer, default=256)
    gpu_count = Column(Integer, default=4)
    gpu_model = Column(String, default="NVIDIA A100 80GB")
    cpu_utilization_pct = Column(Float, default=45.0)
    memory_utilization_pct = Column(Float, default=60.0)
    gpu_utilization_pct = Column(Float, default=85.0)
    active_jobs = Column(Integer, default=2)
    queued_jobs = Column(Integer, default=1)
    total_node_hours_served = Column(Float, default=1240.0)
    last_heartbeat = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)

class HPCJob(Base):
    __tablename__ = "hpc_jobs"

    id = Column(String, primary_key=True, default=gen_id)
    allocation_id = Column(String, nullable=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    user_name = Column(String, nullable=False)
    job_name = Column(String, nullable=False)
    node_id = Column(String, nullable=True)
    status = Column(String, default="running")  # 'running', 'queued', 'completed', 'failed'
    requested_nodes = Column(Integer, default=1)
    gpu_requested = Column(Integer, default=1)
    cpu_hours_used = Column(Float, default=4.5)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)

class HPCIncident(Base):
    __tablename__ = "hpc_incidents"

    id = Column(String, primary_key=True, default=gen_id)
    node_id = Column(String, nullable=False)
    incident_type = Column(String, nullable=False)  # 'scheduled_maintenance', 'thermal_throttle', 'ecc_memory_error', 'driver_crash'
    severity = Column(String, default="warning")  # 'info', 'warning', 'critical'
    reported_by = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String, default="open")  # 'open', 'resolved'
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

class UserInduction(Base):
    __tablename__ = "user_inductions"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    facility_id = Column(String, ForeignKey("facilities.id"), nullable=False)
    inducted_at = Column(DateTime, default=datetime.utcnow)
    inducted_by = Column(String, nullable=False)


class DepartmentHandler(Base):
    __tablename__ = "department_handlers"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    department_id = Column(String, ForeignKey("departments.id"), nullable=False)
    handler_permissions = Column(String, default="full_handler")
    created_at = Column(DateTime, default=datetime.utcnow)

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
    status = Column(String, default="reported", index=True)  # 'reported', 'awaiting_handover', 'in_custody', 'claim_pending', 'returned', 'transferred', 'unclaimed', 'closed'
    return_date = Column(String, nullable=True)
    handover_notes = Column(Text, nullable=True)

    # Cross-Department Routing & Matching Extensions
    destination_department_id = Column(String, nullable=True, index=True)
    destination_department_name = Column(String, nullable=True)
    characteristics = Column(Text, nullable=True)  # Colour, brand, case type, identifying markers
    private_identifying_details = Column(Text, nullable=True)  # Kept private; verified in-person with College ID
    associated_department = Column(String, nullable=True)
    custody_status = Column(String, default="reported")  # 'reported', 'awaiting_handover', 'in_custody', 'claim_pending', 'returned', 'transferred', 'closed'
    verification_status = Column(String, default="unverified")  # 'unverified', 'id_verified', 'rejected'
    verified_by_id = Column(String, nullable=True)
    verified_by_name = Column(String, nullable=True)
    claimant_college_id = Column(String, nullable=True)
    handover_recipient_name = Column(String, nullable=True)
    handover_timestamp = Column(DateTime, nullable=True)
    is_synthetic = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    claims = relationship("ItemClaim", back_populates="item", cascade="all, delete-orphan")
    custody_logs = relationship("CustodyLog", back_populates="item", cascade="all, delete-orphan")

class ItemMatchCandidate(Base):
    __tablename__ = "item_match_candidates"
    __table_args__ = (
        UniqueConstraint("lost_report_id", "found_report_id", name="uq_lost_found_match_pair"),
    )

    id = Column(String, primary_key=True, default=gen_id)
    lost_report_id = Column(String, ForeignKey("lost_found_items.id"), nullable=False, index=True)
    found_report_id = Column(String, ForeignKey("lost_found_items.id"), nullable=False, index=True)
    match_score = Column(Float, nullable=False)
    component_scores = Column(Text, nullable=True)  # JSON string of weights & feature breakdown
    review_status = Column(String, default="pending_review", index=True)  # 'pending_review', 'notified', 'confirmed_match', 'dismissed'
    last_calculated_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    lost_item = relationship("LostFoundItem", foreign_keys=[lost_report_id])
    found_item = relationship("LostFoundItem", foreign_keys=[found_report_id])

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
