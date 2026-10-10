from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr

# Auth & User
class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str
    department: Optional[str] = None
    class_section: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

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

    class Config:
        from_attributes = True

class RoomSearchQuery(BaseModel):
    date: Optional[str] = None
    slot_id: Optional[str] = None
    building: Optional[str] = None
    min_capacity: Optional[int] = None
    type: Optional[str] = None

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

    class Config:
        from_attributes = True

# Bookings
class BookingCreate(BaseModel):
    room_id: str
    booking_date: str
    slot_id: str
    purpose: str

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

    class Config:
        from_attributes = True

# Timetable Change Requests
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
    updated_at: datetime

    class Config:
        from_attributes = True

# Events
class EventRequestCreate(BaseModel):
    name: str
    venue_id: str
    event_date: str
    start_slot: str
    end_slot: str
    expected_audience: int
    level: str = "department"
    is_academic: bool = True
    has_external_guests: bool = False
    av_requirements: Optional[str] = None
    purpose: str

class EventReviewRequest(BaseModel):
    decision: str  # 'approved', 'declined'
    rejection_reason: Optional[str] = None
    admin_notes: Optional[str] = None

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
    av_requirements: Optional[str] = None
    purpose: Optional[str] = None
    status: str
    admin_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

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
    responsible_staff_id: Optional[str] = None
    responsible_staff_name: Optional[str] = None

    class Config:
        from_attributes = True

class FacilityBookingCreate(BaseModel):
    facility_id: str
    booking_date: str
    slot_id: str
    duration_hours: float = 1.0
    project_title: str

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

    class Config:
        from_attributes = True

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

    class Config:
        from_attributes = True

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

class ClaimCreate(BaseModel):
    proof_description: str
    contact_phone: Optional[str] = None

class ClaimReview(BaseModel):
    decision: str  # 'approved', 'rejected', 'proof_requested'
    handler_notes: Optional[str] = None

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

    class Config:
        from_attributes = True

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

    class Config:
        from_attributes = True

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
    current_custody: str
    storage_location: str
    assigned_handler_name: str
    routing_reason: Optional[str] = None
    status: str
    return_date: Optional[str] = None
    handover_notes: Optional[str] = None
    created_at: datetime
    claims: List[ItemClaimResponse] = []
    custody_logs: List[CustodyLogResponse] = []

    class Config:
        from_attributes = True

# Notifications
class NotificationResponse(BaseModel):
    id: str
    title: str
    message: str
    category: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

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

    class Config:
        from_attributes = True
