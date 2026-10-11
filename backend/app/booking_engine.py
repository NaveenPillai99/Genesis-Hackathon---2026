"""
CampusConnect Intelligent Priority-Based Slot Booking and Alternative Venue Recommendation Engine

Features:
- Configurable requester role priority scores (Campus Director 100, Dean 85, Principal 75, HOD 65, Class Advisor 50, Faculty 35, Class Rep 20)
- Configurable event purpose priority scores (Meeting/Discussion 100, Hackathon 90, Webinar 75, Workshop 65, Seminar 55, Presentation 45, Regular Class 30)
- Combined priority scoring: P = (0.60 * R) + (0.40 * E)
- Hard constraint validation (availability, confirmed bookings, capacity, equipment, maintenance, room type)
- Concurrency-safe competing request resolution and deterministic tie-breaking
- Multi-stage alternative venue and alternate time recommendation engine (Stages A, B, C, D)
- Explicit booking state machine transitions
"""

import json
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional, Tuple, Set
from pydantic import BaseModel, Field

# ==============================================================================
# 1. INITIAL CONFIGURABLE POLICIES
# ==============================================================================

# Role Scores (R in [0, 100])
DEFAULT_ROLE_PRIORITY_SCORES: Dict[str, float] = {
    "campus_director": 100.0,
    "dean": 85.0,
    "principal": 75.0,
    "hod": 65.0,
    "department_head": 65.0,
    "class_advisor": 50.0,
    "faculty": 35.0,
    "hpc_faculty": 35.0,
    "class_rep": 20.0,
    "lab_admin": 35.0,
    "lab_assistant": 20.0,
    "lost_property_handler": 20.0,
    "student": 10.0,
}

# Event Purpose Scores (E in [0, 100])
DEFAULT_EVENT_PURPOSE_SCORES: Dict[str, float] = {
    "Meeting / Discussion": 100.0,
    "Hackathon / Major Event": 90.0,
    "Webinar": 75.0,
    "Workshop": 65.0,
    "Seminar": 55.0,
    "Presentation": 45.0,
    "Regular Class": 30.0,
}

AUTHORIZED_EVENT_PURPOSES: List[str] = list(DEFAULT_EVENT_PURPOSE_SCORES.keys())

# Initial Weighting: P = (0.60 * R) + (0.40 * E)
DEFAULT_ROLE_WEIGHT: float = 0.60
DEFAULT_PURPOSE_WEIGHT: float = 0.40

# Alternative Venue Scoring Component Weights (Must sum to 1.0)
DEFAULT_ALTERNATIVE_WEIGHTS: Dict[str, float] = {
    "capacity": 0.35,
    "equipment": 0.30,
    "event_type": 0.20,
    "location": 0.10,
    "utilization": 0.05,
}

# Booking State Machine States
BOOKING_STATES = {
    "DRAFT",
    "PENDING",
    "UNDER_REVIEW",
    "APPROVED",
    "REJECTED",
    "ALTERNATIVES_OFFERED",
    "ALTERNATIVE_SELECTED",
    "CANCELLED",
    "COMPLETED",
}

# Valid State Transitions
VALID_STATE_TRANSITIONS: Dict[str, Set[str]] = {
    "DRAFT": {"PENDING", "CANCELLED"},
    "PENDING": {"UNDER_REVIEW", "APPROVED", "REJECTED", "ALTERNATIVES_OFFERED", "ALTERNATIVE_SELECTED", "CANCELLED"},
    "UNDER_REVIEW": {"APPROVED", "REJECTED", "ALTERNATIVES_OFFERED", "ALTERNATIVE_SELECTED", "CANCELLED"},
    "APPROVED": {"COMPLETED", "CANCELLED"},
    "REJECTED": set(),  # Terminal state
    "ALTERNATIVES_OFFERED": {"ALTERNATIVE_SELECTED", "REJECTED", "CANCELLED"},
    "ALTERNATIVE_SELECTED": {"UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"},
    "CANCELLED": set(),  # Terminal state
    "COMPLETED": set(),  # Terminal state
}

# Slot Definitions & Times
SLOT_ORDER = ["slot2", "slot3", "slot4", "slot5", "slot6", "slot8", "slot9", "slot10"]
SLOT_TIMES: Dict[str, Tuple[str, str]] = {
    "slot2": ("08:50", "09:40"),
    "slot3": ("09:40", "10:30"),
    "slot4": ("10:45", "11:35"),
    "slot5": ("11:35", "12:25"),
    "slot6": ("12:25", "13:15"),
    "slot8": ("14:05", "14:55"),
    "slot9": ("14:55", "15:45"),
    "slot10": ("15:45", "16:35"),
}


class BookingPolicyManager:
    """
    Manages active policy parameters with support for runtime updates,
    versioning, and transparency.
    """
    def __init__(self):
        self.version = "v1.0"
        self.role_scores = dict(DEFAULT_ROLE_PRIORITY_SCORES)
        self.purpose_scores = dict(DEFAULT_EVENT_PURPOSE_SCORES)
        self.role_weight = DEFAULT_ROLE_WEIGHT
        self.purpose_weight = DEFAULT_PURPOSE_WEIGHT
        self.alternative_weights = dict(DEFAULT_ALTERNATIVE_WEIGHTS)

    def reset_defaults(self):
        self.version = "v1.0"
        self.role_scores = dict(DEFAULT_ROLE_PRIORITY_SCORES)
        self.purpose_scores = dict(DEFAULT_EVENT_PURPOSE_SCORES)
        self.role_weight = DEFAULT_ROLE_WEIGHT
        self.purpose_weight = DEFAULT_PURPOSE_WEIGHT
        self.alternative_weights = dict(DEFAULT_ALTERNATIVE_WEIGHTS)

    def update_policy(
        self,
        role_scores: Optional[Dict[str, float]] = None,
        purpose_scores: Optional[Dict[str, float]] = None,
        role_weight: Optional[float] = None,
        purpose_weight: Optional[float] = None,
        alternative_weights: Optional[Dict[str, float]] = None,
        version: Optional[str] = None,
    ):
        if role_scores:
            self.role_scores.update(role_scores)
        if purpose_scores:
            self.purpose_scores.update(purpose_scores)
        if role_weight is not None:
            self.role_weight = role_weight
        if purpose_weight is not None:
            self.purpose_weight = purpose_weight
        if alternative_weights:
            self.alternative_weights.update(alternative_weights)
        if version:
            self.version = version
        else:
            self.version = f"v1.{int(datetime.utcnow().timestamp())}"


# Global Policy Manager Singleton
active_booking_policy = BookingPolicyManager()


def get_booking_policy() -> BookingPolicyManager:
    return active_booking_policy


# ==============================================================================
# 2. PRIORITY SCORING ENGINE
# ==============================================================================

def validate_event_purpose(purpose: Optional[str]) -> str:
    """
    Validates event purpose against authorized list.
    Safely normalizes case or maps to closest match.
    """
    if not purpose:
        return "Meeting / Discussion"
    p_clean = str(purpose).strip()
    for authorized in AUTHORIZED_EVENT_PURPOSES:
        if p_clean.lower() == authorized.lower():
            return authorized
    # Check partial match
    for authorized in AUTHORIZED_EVENT_PURPOSES:
        if authorized.lower() in p_clean.lower() or p_clean.lower() in authorized.lower():
            return authorized
    return "Meeting / Discussion"


def calculate_booking_priority(
    role: Optional[str],
    event_purpose: Optional[str],
    policy: Optional[BookingPolicyManager] = None,
) -> Dict[str, Any]:
    """
    Calculates combined booking priority:
      P = (0.60 * R) + (0.40 * E)
      
    Where:
      P = combined priority score out of 100
      R = authenticated requester's role score
      E = event-purpose score
    """
    pol = policy or get_booking_policy()
    clean_role = str(role or "").strip().lower()
    validated_purpose = validate_event_purpose(event_purpose)

    role_score = pol.role_scores.get(clean_role, 10.0)
    purpose_score = pol.purpose_scores.get(validated_purpose, 30.0)

    rw = pol.role_weight
    pw = pol.purpose_weight

    combined_score = round((rw * role_score) + (pw * purpose_score), 2)
    # Ensure bounded [0, 100]
    combined_score = max(0.0, min(100.0, combined_score))

    return {
        "combined_priority_score": combined_score,
        "role": clean_role,
        "role_score": role_score,
        "role_weight": rw,
        "event_purpose": validated_purpose,
        "purpose_score": purpose_score,
        "purpose_weight": pw,
        "policy_version": pol.version,
        "formula": f"({rw:.2f} * {role_score}) + ({pw:.2f} * {purpose_score}) = {combined_score:.2f}",
    }


# ==============================================================================
# 3. STATE MACHINE VALIDATION
# ==============================================================================

def normalize_status(status_str: Optional[str]) -> str:
    """Normalizes status string to canonical uppercase enum."""
    if not status_str:
        return "PENDING"
    s = str(status_str).strip().upper()
    if s == "DECLINED":
        return "REJECTED"
    return s


def validate_state_transition(current_status: str, target_status: str) -> Tuple[bool, Optional[str]]:
    """
    Validates state machine transitions.
    Returns (is_valid, error_message).
    """
    curr = normalize_status(current_status)
    tgt = normalize_status(target_status)

    if curr not in BOOKING_STATES:
        return False, f"Unknown current state: '{curr}'."
    if tgt not in BOOKING_STATES:
        return False, f"Unknown target state: '{tgt}'."

    if curr == tgt:
        return True, None

    valid_targets = VALID_STATE_TRANSITIONS.get(curr, set())
    if tgt in valid_targets:
        return True, None

    return False, f"Illegal state transition from '{curr}' to '{tgt}'. Allowed next states: {sorted(list(valid_targets))}."


# ==============================================================================
# 4. HARD CONFLICTS & SLOT OVERLAPS
# ==============================================================================

def slots_overlap(start_a: str, end_a: str, start_b: str, end_b: str) -> bool:
    """
    Checks if slot range [start_a, end_a] overlaps with [start_b, end_b].
    Slots are mapped to continuous indices in SLOT_ORDER.
    """
    try:
        idx_s_a = SLOT_ORDER.index(start_a) if start_a in SLOT_ORDER else 0
        idx_e_a = SLOT_ORDER.index(end_a) if end_a in SLOT_ORDER else idx_s_a
        idx_s_b = SLOT_ORDER.index(start_b) if start_b in SLOT_ORDER else 0
        idx_e_b = SLOT_ORDER.index(end_b) if end_b in SLOT_ORDER else idx_s_b

        # Overlap if max(start) <= min(end)
        return max(idx_s_a, idx_s_b) <= min(idx_e_a, idx_e_b)
    except Exception:
        return start_a == start_b or end_a == end_b


def validate_hard_constraints(
    room: Any,
    expected_audience: int,
    requires_projector: bool = False,
    requires_ac: bool = False,
    requires_audio: bool = False,
    room_type_preference: Optional[str] = None,
) -> Tuple[bool, List[str]]:
    """
    Validates hard constraints on a venue:
    - Maintenance status
    - Capacity >= expected audience
    - Mandatory equipment (projector, ac, audio)
    - Room type compatibility
    """
    failures = []

    if getattr(room, "is_under_maintenance", False):
        failures.append(f"Venue '{room.name}' is currently flagged under maintenance downtime.")

    capacity = getattr(room, "capacity", 0)
    if expected_audience > capacity:
        failures.append(
            f"Venue capacity ({capacity} seats) is insufficient for expected audience of {expected_audience}."
        )

    if requires_projector and not getattr(room, "has_projector", False):
        failures.append(f"Venue '{room.name}' lacks required projector facility.")

    if requires_ac and not getattr(room, "has_ac", False):
        failures.append(f"Venue '{room.name}' lacks required air conditioning (AC).")

    if requires_audio and not getattr(room, "has_audio", False):
        failures.append(f"Venue '{room.name}' lacks required audio system.")

    if room_type_preference and room_type_preference != getattr(room, "type", "classroom"):
        # If strict preference is specified
        if room_type_preference == "event_venue" and getattr(room, "type", "") != "event_venue":
            failures.append(f"Venue '{room.name}' is a classroom, but event hall is required.")

    return len(failures) == 0, failures


# ==============================================================================
# 5. INTELLIGENT ALTERNATIVE VENUE RECOMMENDATION ENGINE
# ==============================================================================

def calculate_alternative_suitability_score(
    candidate_room: Any,
    preferred_room: Any,
    expected_audience: int,
    requires_projector: bool = False,
    requires_ac: bool = False,
    requires_audio: bool = False,
    policy: Optional[BookingPolicyManager] = None,
) -> Dict[str, Any]:
    """
    Calculates alternative suitability score on a 0-100 scale:
      Alternative Score =
        - 35% capacity suitability
        - 30% equipment and facility suitability
        - 20% event-type suitability
        - 10% location convenience
        - 5% resource utilization suitability
    """
    pol = policy or get_booking_policy()
    weights = pol.alternative_weights

    # 1. Capacity Suitability (35%):
    # Ideal fit: audience / capacity is between 65% and 90%
    cap = max(1, getattr(candidate_room, "capacity", 60))
    aud = max(1, expected_audience)
    ratio = aud / cap
    if ratio > 1.0:
        score_cap = 0.0  # Over capacity
    elif 0.65 <= ratio <= 0.95:
        score_cap = 100.0  # Ideal fit
    elif ratio < 0.65:
        # Penalize excessive empty seats proportionally
        score_cap = max(30.0, 100.0 - (0.65 - ratio) * 120.0)
    else:  # 0.95 to 1.0
        score_cap = 90.0

    # 2. Equipment Suitability (30%):
    # Checks mandatory + surplus equipment
    eq_points = 100.0
    if requires_projector and not getattr(candidate_room, "has_projector", False):
        eq_points -= 40.0
    if requires_ac and not getattr(candidate_room, "has_ac", False):
        eq_points -= 35.0
    if requires_audio and not getattr(candidate_room, "has_audio", False):
        eq_points -= 25.0
    score_eq = max(0.0, eq_points)

    # 3. Event-Type Suitability (20%):
    pref_type = getattr(preferred_room, "type", "event_venue")
    cand_type = getattr(candidate_room, "type", "event_venue")
    if pref_type == cand_type:
        score_type = 100.0
    elif pref_type == "classroom" and cand_type == "event_venue":
        score_type = 80.0
    else:
        score_type = 50.0

    # 4. Location Convenience (10%):
    # Same building = 100%, different building = 50%
    pref_bldg = getattr(preferred_room, "building", "")
    cand_bldg = getattr(candidate_room, "building", "")
    if pref_bldg and cand_bldg and pref_bldg.lower() == cand_bldg.lower():
        score_loc = 100.0
    else:
        score_loc = 55.0

    # 5. Resource Utilization Suitability (5%):
    # Avoiding allocating a 1200-seat auditorium for a 30-person meeting
    if cap > aud * 5 and cap > 300:
        score_util = 40.0
    else:
        score_util = 100.0

    total_score = round(
        (weights.get("capacity", 0.35) * score_cap) +
        (weights.get("equipment", 0.30) * score_eq) +
        (weights.get("event_type", 0.20) * score_type) +
        (weights.get("location", 0.10) * score_loc) +
        (weights.get("utilization", 0.05) * score_util),
        2
    )

    explanation = (
        f"Capacity match ({int(score_cap)}% fit for {aud} in {cap}-seat hall), "
        f"{'same' if score_loc == 100.0 else 'alternate'} building ({cand_bldg}), "
        f"features: {candidate_room.has_projector and 'Projector ' or ''}"
        f"{candidate_room.has_ac and 'AC ' or ''}{candidate_room.has_audio and 'Audio' or ''}."
    )

    return {
        "suitability_score": total_score,
        "component_breakdown": {
            "capacity": round(score_cap, 1),
            "equipment": round(score_eq, 1),
            "event_type": round(score_type, 1),
            "location": round(score_loc, 1),
            "utilization": round(score_util, 1),
        },
        "weights": weights,
        "explanation": explanation,
    }


def find_alternative_venues(
    all_rooms: List[Any],
    preferred_room_id: str,
    event_date: str,
    start_slot: str,
    end_slot: str,
    expected_audience: int,
    confirmed_bookings: List[Any],
    timetable_slots: List[Any],
    requires_projector: bool = False,
    requires_ac: bool = False,
    requires_audio: bool = False,
    limit: int = 3,
) -> List[Dict[str, Any]]:
    """
    Stage A & B: Generates and ranks feasible alternative venues available
    for the exact requested date and time interval.
    """
    preferred_room = next((r for r in all_rooms if r.id == preferred_room_id), None)
    candidates = []

    for room in all_rooms:
        if room.id == preferred_room_id:
            continue  # Exclude target venue

        # Hard constraint checks
        passes_hard, _ = validate_hard_constraints(
            room=room,
            expected_audience=expected_audience,
            requires_projector=requires_projector,
            requires_ac=requires_ac,
            requires_audio=requires_audio,
        )
        if not passes_hard:
            continue

        # Check overlapping confirmed bookings for this room on event_date
        is_occupied = False
        for b in confirmed_bookings:
            b_status = normalize_status(getattr(b, "status", ""))
            if b_status in ("APPROVED", "CONFIRMED") and getattr(b, "venue_id", "") == room.id and getattr(b, "event_date", "") == event_date:
                if slots_overlap(start_slot, end_slot, getattr(b, "start_slot", ""), getattr(b, "end_slot", "")):
                    is_occupied = True
                    break

        if is_occupied:
            continue

        # Check overlapping classroom bookings / timetable if applicable
        for tt in timetable_slots:
            if getattr(tt, "room_id", "") == room.id:
                if slots_overlap(start_slot, end_slot, getattr(tt, "slot_id", ""), getattr(tt, "slot_id", "")):
                    is_occupied = True
                    break

        if is_occupied:
            continue

        # Feasible candidate found! Compute alternative score
        score_info = calculate_alternative_suitability_score(
            candidate_room=room,
            preferred_room=preferred_room,
            expected_audience=expected_audience,
            requires_projector=requires_projector,
            requires_ac=requires_ac,
            requires_audio=requires_audio,
        )

        candidates.append({
            "type": "alternative_venue",
            "venue_id": getattr(room, "id", ""),
            "venue_name": getattr(room, "name", ""),
            "building": getattr(room, "building", ""),
            "floor": getattr(room, "floor", "1st Floor"),
            "capacity": getattr(room, "capacity", 60),
            "event_date": event_date,
            "start_slot": start_slot,
            "end_slot": end_slot,
            "has_projector": getattr(room, "has_projector", False),
            "has_ac": getattr(room, "has_ac", False),
            "has_audio": getattr(room, "has_audio", False),
            "suitability_score": score_info["suitability_score"],
            "component_breakdown": score_info["component_breakdown"],
            "explanation": score_info["explanation"],
            "availability_verified": True,
        })

    # Sort descending by suitability score
    candidates.sort(key=lambda x: x["suitability_score"], reverse=True)
    return candidates[:limit]


def find_alternative_time_slots(
    preferred_room: Any,
    event_date: str,
    start_slot: str,
    end_slot: str,
    expected_audience: int,
    confirmed_bookings: List[Any],
    horizon_days: int = 3,
    limit: int = 3,
) -> List[Dict[str, Any]]:
    """
    Stage C: Searches for nearby time slots on the same date or adjacent dates
    when no venue is free at the requested time.
    """
    if not preferred_room or getattr(preferred_room, "is_under_maintenance", False):
        return []

    # Calculate duration in slot count
    try:
        s_idx = SLOT_ORDER.index(start_slot) if start_slot in SLOT_ORDER else 0
        e_idx = SLOT_ORDER.index(end_slot) if end_slot in SLOT_ORDER else s_idx
        duration = max(1, (e_idx - s_idx) + 1)
    except Exception:
        duration = 1

    time_options = []

    # Parse reference date
    try:
        base_dt = datetime.strptime(event_date, "%Y-%m-%d").date()
    except Exception:
        base_dt = date.today()

    # Search offsets: same date (0), next day (+1), -1, +2, etc.
    date_offsets = [0] + [i for i in range(1, horizon_days + 1)] + [-i for i in range(1, horizon_days + 1)]

    for offset in date_offsets:
        cur_date = (base_dt + timedelta(days=offset)).strftime("%Y-%m-%d")
        
        # Test candidate slot windows on cur_date
        for start_i in range(0, len(SLOT_ORDER) - duration + 1):
            cand_start = SLOT_ORDER[start_i]
            cand_end = SLOT_ORDER[start_i + duration - 1]

            # Don't offer the exact original failing date and time
            if cur_date == event_date and cand_start == start_slot and cand_end == end_slot:
                continue

            # Check overlap with confirmed bookings
            is_blocked = False
            for b in confirmed_bookings:
                b_status = normalize_status(getattr(b, "status", ""))
                if b_status in ("APPROVED", "CONFIRMED") and getattr(b, "venue_id", "") == preferred_room.id and getattr(b, "event_date", "") == cur_date:
                    if slots_overlap(cand_start, cand_end, getattr(b, "start_slot", ""), getattr(b, "end_slot", "")):
                        is_blocked = True
                        break

            if not is_blocked:
                # Calculate convenience score
                day_penalty = abs(offset) * 15.0
                slot_penalty = abs(start_i - s_idx) * 5.0
                time_score = max(40.0, round(100.0 - day_penalty - slot_penalty, 1))

                st_time, _ = SLOT_TIMES.get(cand_start, ("09:00", "10:00"))
                _, et_time = SLOT_TIMES.get(cand_end, ("10:00", "11:00"))

                time_options.append({
                    "type": "alternative_time",
                    "venue_id": preferred_room.id,
                    "venue_name": preferred_room.name,
                    "building": preferred_room.building,
                    "capacity": preferred_room.capacity,
                    "event_date": cur_date,
                    "start_slot": cand_start,
                    "end_slot": cand_end,
                    "time_range": f"{st_time} – {et_time}",
                    "suitability_score": time_score,
                    "explanation": f"Same venue ({preferred_room.name}) on {cur_date} ({cand_start}–{cand_end}).",
                    "availability_verified": True,
                })

                if len(time_options) >= limit:
                    break
        if len(time_options) >= limit:
            break

    time_options.sort(key=lambda x: x["suitability_score"], reverse=True)
    return time_options[:limit]


# ==============================================================================
# 6. AUTONOMOUS DECISION-MAKING & ALTERNATIVE ALLOCATION ENGINE
# ==============================================================================

def auto_resolve_booking_decision(
    new_event: Any,
    db_session: Any,
    all_rooms: List[Any],
    preferred_room: Any,
    confirmed_bookings: List[Any],
    timetable_slots: List[Any],
    active_competing_requests: List[Any],
) -> Dict[str, Any]:
    """
    Autonomous Algorithmic Decision-Making & Alternative Allocation:
    1. Automatically compares priority scores P = (0.60 * R) + (0.40 * E) across competing requests.
    2. Automatically assigns the preferred slot to the winning higher-priority party (status = 'approved').
    3. Automatically computes feasible alternative venues and alternate time slots
       for any lower-priority party, transitioning them to ALTERNATIVES_OFFERED.
    """
    all_competing = list(active_competing_requests)
    if new_event not in all_competing:
        all_competing.append(new_event)

    # Sort descending by combined priority score, with submission time as deterministic tie-breaker
    all_competing.sort(
        key=lambda r: (-float(getattr(r, "combined_priority_score", 0.0) or 0.0), getattr(r, "created_at", datetime.utcnow()), getattr(r, "id", ""))
    )

    top_request = all_competing[0]
    lower_requests = all_competing[1:]

    # Winning request gets automatically approved!
    top_request.status = "approved"
    top_request.recommended_action = "AUTO_APPROVED"
    top_request.admin_notes = (
        f"Autonomous Decision Engine: Automatically approved with winning Priority Score P = {top_request.combined_priority_score}."
    )

    # Lower priority competing requests automatically receive ranked alternatives
    for lower in lower_requests:
        lower.status = "ALTERNATIVES_OFFERED"
        lower.recommended_action = "ALTERNATIVES_OFFERED"
        lower.admin_notes = (
            f"Autonomous Decision Engine: Automatically offered alternative options due to competing higher-priority request '{top_request.name}' (Score: {top_request.combined_priority_score} vs {lower.combined_priority_score})."
        )
        
        # Calculate feasible alternatives for this lower priority request
        alts_v = find_alternative_venues(
            all_rooms=all_rooms,
            preferred_room_id=getattr(lower, "venue_id", preferred_room.id),
            event_date=getattr(lower, "event_date", ""),
            start_slot=getattr(lower, "start_slot", ""),
            end_slot=getattr(lower, "end_slot", ""),
            expected_audience=getattr(lower, "expected_audience", 100),
            confirmed_bookings=[b for b in confirmed_bookings if b.id != lower.id],
            timetable_slots=timetable_slots,
            requires_projector=bool(getattr(lower, "requires_projector", False)),
            requires_ac=bool(getattr(lower, "requires_ac", False)),
            requires_audio=bool(getattr(lower, "requires_audio", False)),
            limit=3,
        )
        alts_t = find_alternative_time_slots(
            preferred_room=preferred_room,
            event_date=getattr(lower, "event_date", ""),
            start_slot=getattr(lower, "start_slot", ""),
            end_slot=getattr(lower, "end_slot", ""),
            expected_audience=getattr(lower, "expected_audience", 100),
            confirmed_bookings=[b for b in confirmed_bookings if b.id != lower.id],
            horizon_days=3,
            limit=3,
        )
        lower.offered_alternatives = json.dumps({
            "venues": alts_v,
            "times": alts_t,
            "auto_generated": True,
            "timestamp": datetime.utcnow().isoformat(),
        })

    return {
        "auto_approved_id": top_request.id,
        "auto_approved_name": top_request.name,
        "winning_score": top_request.combined_priority_score,
        "displaced_count": len(lower_requests),
    }
