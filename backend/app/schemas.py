from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, ConfigDict

# Auth & User
class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str
    department: Optional[str] = None
    class_section: Optional[str] = None
    assigned_facility_id: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: str
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    permissions: List[str] = []

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    class_section: Optional[str] = None

class UserProfileDetailResponse(BaseModel):
    user: UserResponse
    role_label: str
    permissions: List[str]
    active_bookings_count: int
    inducted_facilities: List[str]
    pending_timetable_requests_count: int
    custody_items_count: int
    egovernance_verified: bool
    last_login: str

# Rooms & Availability
class RoomResponse(BaseModel):
    id: str
    name: str
    building: str
    floor: Optional[str] = None
    capacity: int
    type: str
    has_projector: bool
    has_ac: bool
    has_audio: bool
    notes: Optional[str] = None
    is_under_maintenance: bool
    model_config = ConfigDict(from_attributes=True)

class RoomSlotStatus(BaseModel):
    slot_id: str
    label: str
    start_time: str
    end_time: str
    is_free: bool
    status: str  # 'free', 'class_scheduled', 'booked', 'maintenance'
    course_name: Optional[str] = None
    booked_by: Optional[str] = None

class RoomAvailabilityResponse(BaseModel):
    room: RoomResponse
    date: str
    slots: List[RoomSlotStatus]

class TimetableSlotResponse(BaseModel):
    id: str
    room_id: str
    day: str
    slot_id: str
    start_time: str
    end_time: str
    code: Optional[str] = None
    course_name: Optional[str] = None
    faculty: Optional[str] = None
    class_section: Optional[str] = None
    advisor: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# Bookings
class BookingCreate(BaseModel):
    room_id: str
    booking_date: str
    slot_id: str
    purpose: Optional[str] = None

class BookingResponse(BaseModel):
    id: str
    room_id: str
    booking_date: str
    slot_id: str
    start_time: str
    end_time: str
    booked_by: str
    booked_by_name: str
    purpose: Optional[str] = None
    status: str
    created_at: datetime
    checked_in_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class BookingOverrideRequest(BaseModel):
    override_reason: str

# Timetable Change Proposal
class TimetableChangeCreate(BaseModel):
    course_code: str
    course_name: str
    class_section: str
    original_day: str
    original_slot: str
    original_room_id: str
    proposed_day: str
    proposed_slot: str
    proposed_room_id: str
    proposed_date: Optional[str] = None
    reason: str

class TimetableChangeReview(BaseModel):
    decision: str  # 'approved', 'rejected', 'modification_requested'
    review_notes: Optional[str] = None

class TimetableChangeResponse(BaseModel):
    id: str
    course_code: str
    course_name: str
    class_section: str
    requester_id: str
    requester_name: str
    original_day: str
    original_slot: str
    original_room_id: str
    proposed_day: str
    proposed_slot: str
    proposed_room_id: str
    proposed_date: Optional[str] = None
    reason: str
    status: str
    approver_id: Optional[str] = None
    approver_name: Optional[str] = None
    review_notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

# Events
class EventCreate(BaseModel):
    name: str
    organizer: str
    venue_id: str
    event_date: str
    start_slot: str
    end_slot: str
    expected_audience: int = 100
    level: str = "department"
    is_academic: bool = True
    has_external_guests: bool = False
    av_requirements: Optional[str] = None
    purpose: Optional[str] = None

class EventReview(BaseModel):
    decision: str  # 'approved', 'declined'
    notes: Optional[str] = None

class EventResponse(BaseModel):
    id: str
    name: str
    organizer: str
    organizer_id: str
    venue_id: str
    event_date: str
    start_slot: str
    end_slot: str
    expected_audience: int
    level: str
    is_academic: bool
    has_external_guests: bool
    priority_score: int
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Facilities
class FacilityResponse(BaseModel):
    id: str
    name: str
    type: str
    location: str
    description: Optional[str] = None
    contact: Optional[str] = None
    induction_required: bool
    allocation_model: str
    image: str
    status: str
    maintenance_reason: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class FacilityBookingCreate(BaseModel):
    facility_id: str
    booking_date: str
    slot_id: str
    duration_hours: float = 1.0
    project_title: Optional[str] = None

class FacilityBookingResponse(BaseModel):
    id: str
    facility_id: str
    user_id: str
    user_name: str
    booking_date: str
    slot_id: str
    duration_hours: float
    project_title: Optional[str] = None
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# HPC Schemas
class HPCCreate(BaseModel):
    project_name: str
    node_hours: int
    supervisor_name: str
    reason: str

class HPCResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    project_name: str
    node_hours: int
    supervisor_name: str
    status: str
    reason: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class HPCNodeResponse(BaseModel):
    id: str
    name: str
    cluster_id: str
    status: str
    cpu_cores: int
    memory_gb: int
    gpu_count: int
    gpu_model: str
    cpu_utilization_pct: float
    memory_utilization_pct: float
    gpu_utilization_pct: float
    active_jobs: int
    queued_jobs: int
    total_node_hours_served: float
    last_heartbeat: datetime
    notes: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class HPCNodeStatusUpdate(BaseModel):
    status: str  # 'healthy', 'busy', 'idle', 'offline', 'maintenance'
    notes: Optional[str] = None

class HPCJobResponse(BaseModel):
    id: str
    allocation_id: Optional[str] = None
    user_id: str
    user_name: str
    job_name: str
    node_id: Optional[str] = None
    status: str
    requested_nodes: int
    gpu_requested: int
    cpu_hours_used: float
    started_at: datetime
    ended_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class HPCIncidentCreate(BaseModel):
    node_id: str
    incident_type: str
    severity: str = "warning"
    description: str

class HPCIncidentResponse(BaseModel):
    id: str
    node_id: str
    incident_type: str
    severity: str
    reported_by: str
    description: str
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class HPCOverviewResponse(BaseModel):
    total_nodes: int
    healthy_nodes: int
    busy_nodes: int
    idle_nodes: int
    offline_nodes: int
    maintenance_nodes: int
    available_capacity_pct: float
    active_jobs_count: int
    queued_jobs_count: int
    pending_allocations_count: int
    avg_cpu_utilization: float
    avg_gpu_utilization: float
    telemetry_source: str = "SYNTHETIC_TELEMETRY_ENGINE (SIMULATED FOR DEMONSTRATION)"

# Departments
class DepartmentResponse(BaseModel):
    id: str
    department_name: str
    code: str
    active: bool
    model_config = ConfigDict(from_attributes=True)

# Lost & Found
class LostFoundCreate(BaseModel):
    report_type: str  # 'found', 'lost'
    title: str
    category: str
    description: str
    location_found: str
    is_classroom: bool = False
    room_id: Optional[str] = None
    found_date: str
    found_time: Optional[str] = None
    photo_url: Optional[str] = None
    storage_location: Optional[str] = "Campus Security Desk"
    # Cross-department routing & matching fields
    destination_department_id: Optional[str] = None
    characteristics: Optional[str] = None
    private_identifying_details: Optional[str] = None
    associated_department: Optional[str] = None
    is_physically_handed_over: bool = False

class ClaimCreate(BaseModel):
    proof_description: str
    contact_phone: Optional[str] = None

class ClaimReview(BaseModel):
    decision: str  # 'approved', 'rejected', 'proof_requested'
    handler_notes: Optional[str] = None

class InPersonVerificationRequest(BaseModel):
    claimant_college_id: str
    claimant_name: str
    verification_notes: Optional[str] = None
    handover_notes: Optional[str] = None

class CustodyTransferRequest(BaseModel):
    new_department_id: str
    transfer_reason: str
    new_storage_location: Optional[str] = None

class HandoverUpdate(BaseModel):
    new_custody: str  # 'in_custody', 'returned', 'transferred'
    storage_location: Optional[str] = None
    handover_notes: Optional[str] = None

class ItemClaimResponse(BaseModel):
    id: str
    item_id: str
    claimant_id: str
    claimant_name: str
    proof_description: str
    contact_phone: Optional[str] = None
    status: str
    handler_notes: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class CustodyLogResponse(BaseModel):
    id: str
    item_id: str
    actor_id: str
    actor_name: str
    action: str
    from_custodian: Optional[str] = None
    to_custodian: Optional[str] = None
    notes: Optional[str] = None
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)

class MatchCandidateResponse(BaseModel):
    id: str
    lost_report_id: str
    found_report_id: str
    match_score: float
    component_scores: Optional[str] = None
    review_status: str
    last_calculated_at: datetime
    lost_item: Optional[dict] = None
    found_item: Optional[dict] = None
    model_config = ConfigDict(from_attributes=True)

class LostFoundResponse(BaseModel):
    id: str
    report_type: str
    title: str
    category: str
    description: str
    location_found: str
    is_classroom: bool
    room_id: Optional[str] = None
    found_date: str
    found_time: Optional[str] = None
    photo_url: Optional[str] = None
    finder_name: str
    finder_id: Optional[str] = None
    current_custody: str
    storage_location: str
    assigned_handler_name: str
    assigned_handler_id: Optional[str] = None
    routing_reason: Optional[str] = None
    status: str
    return_date: Optional[str] = None
    handover_notes: Optional[str] = None
    created_at: datetime

    # Cross-department routing fields
    destination_department_id: Optional[str] = None
    destination_department_name: Optional[str] = None
    characteristics: Optional[str] = None
    custody_status: Optional[str] = None
    verification_status: Optional[str] = None
    verified_by_name: Optional[str] = None
    claimant_college_id: Optional[str] = None
    handover_recipient_name: Optional[str] = None
    is_synthetic: Optional[bool] = False

    claims: List[ItemClaimResponse] = []
    custody_logs: List[CustodyLogResponse] = []
    model_config = ConfigDict(from_attributes=True)

# Notifications
class NotificationResponse(BaseModel):
    id: str
    title: str
    message: str
    category: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Audit Log
class AuditLogResponse(BaseModel):
    id: str
    actor_id: str
    actor_name: str
    actor_role: str
    action: str
    entity_type: str
    entity_id: str
    details: Optional[str] = None
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)
