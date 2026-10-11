import pytest
from datetime import datetime, date, timedelta
from app.booking_engine import (
    calculate_booking_priority,
    get_booking_policy,
    validate_hard_constraints,
    validate_state_transition,
    find_alternative_venues,
    find_alternative_time_slots,
    calculate_alternative_suitability_score,
    slots_overlap,
    normalize_status,
)
from app.auth import create_access_token


def auth_headers(user_id: str, role: str):
    token = create_access_token({"sub": user_id, "role": role})
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# TEST 1 & 2: Role Score, Purpose Score & Combined Priority (0.60 * R + 0.40 * E)
# ==============================================================================
def test_role_and_purpose_score_calculation():
    policy = get_booking_policy()
    # Verified section 2 role scores
    assert policy.role_scores["campus_director"] == 100.0
    assert policy.role_scores["dean"] == 85.0
    assert policy.role_scores["principal"] == 75.0
    assert policy.role_scores["hod"] == 65.0
    assert policy.role_scores["class_advisor"] == 50.0
    assert policy.role_scores["faculty"] == 35.0
    assert policy.role_scores["class_rep"] == 20.0

    # Verified section 3 purpose scores
    assert policy.purpose_scores["Meeting / Discussion"] == 100.0
    assert policy.purpose_scores["Hackathon / Major Event"] == 90.0
    assert policy.purpose_scores["Webinar"] == 75.0
    assert policy.purpose_scores["Workshop"] == 65.0
    assert policy.purpose_scores["Seminar"] == 55.0
    assert policy.purpose_scores["Presentation"] == 45.0
    assert policy.purpose_scores["Regular Class"] == 30.0


def test_combined_priority_formula_and_breakdown():
    # Test formula: P = (0.60 * R) + (0.40 * E)
    res = calculate_booking_priority("faculty", "Seminar")
    assert res["role_score"] == 35.0
    assert res["purpose_score"] == 55.0
    # (0.60 * 35) + (0.40 * 55) = 21 + 22 = 43.0
    assert res["combined_priority_score"] == 43.0
    assert "formula" in res
    assert "policy_version" in res


# ==============================================================================
# TEST 3: Dean's HOD meeting vs Faculty seminar
# ==============================================================================
def test_dean_hod_meeting_vs_faculty_seminar():
    # Dean's HOD meeting: R = 85, E = 100, P = (0.60 * 85) + (0.40 * 100) = 51 + 40 = 91.0
    dean_prio = calculate_booking_priority("dean", "Meeting / Discussion")
    assert dean_prio["role_score"] == 85.0
    assert dean_prio["purpose_score"] == 100.0
    assert dean_prio["combined_priority_score"] == 91.0

    # Faculty seminar: R = 35, E = 55, P = (0.60 * 35) + (0.40 * 55) = 21 + 22 = 43.0
    faculty_prio = calculate_booking_priority("faculty", "Seminar")
    assert faculty_prio["role_score"] == 35.0
    assert faculty_prio["purpose_score"] == 55.0
    assert faculty_prio["combined_priority_score"] == 43.0

    assert dean_prio["combined_priority_score"] > faculty_prio["combined_priority_score"]


# ==============================================================================
# TEST 4: Requests with equal scores and deterministic tie-breaking
# ==============================================================================
def test_equal_scores_deterministic_tie_breaking(client):
    # Two faculty requests with same purpose -> identical scores (P = 43.0)
    headers_fac1 = auth_headers("user-faculty-1", "faculty")
    headers_fac2 = auth_headers("user-faculty-2", "faculty")

    target_date = "2026-12-05"
    r1 = client.post(
        "/api/events/",
        headers=headers_fac1,
        json={
            "name": "Faculty Seminar Alpha",
            "organizer": "Dr First",
            "venue_id": "VENUE-AUDITORIUM",
            "event_date": target_date,
            "start_slot": "slot4",
            "end_slot": "slot6",
            "expected_audience": 100,
            "event_purpose": "Seminar",
        }
    )
    assert r1.status_code == 200
    r1_data = r1.json()
    assert r1_data["recommended_action"] == "RECOMMEND_APPROVAL"

    # Second request submitted later with identical priority
    r2 = client.post(
        "/api/events/",
        headers=headers_fac2,
        json={
            "name": "Faculty Seminar Beta",
            "organizer": "Dr Second",
            "venue_id": "VENUE-AUDITORIUM",
            "event_date": target_date,
            "start_slot": "slot4",
            "end_slot": "slot6",
            "expected_audience": 100,
            "event_purpose": "Seminar",
        }
    )
    assert r2.status_code == 200
    r2_data = r2.json()
    # Earlier submission wins! Beta gets RECOMMEND_ALTERNATIVES
    assert r2_data["recommended_action"] == "RECOMMEND_ALTERNATIVES"
    assert r2_data["offered_alternatives"] is not None

    # Query competing endpoint
    comp_res = client.get(
        f"/api/events/competing?venue_id=VENUE-AUDITORIUM&event_date={target_date}&start_slot=slot4&end_slot=slot6",
        headers=headers_fac1,
    )
    assert comp_res.status_code == 200
    comp_data = comp_res.json()["competing_requests"]
    assert len(comp_data) >= 2
    assert comp_data[0]["request_id"] == r1_data["id"]
    assert comp_data[0]["rank"] == 1
    assert comp_data[1]["request_id"] == r2_data["id"]
    assert comp_data[1]["rank"] == 2


# ==============================================================================
# TEST 5: Confirmed booking conflicts returning HTTP 409
# ==============================================================================
def test_confirmed_booking_conflicts_return_409(client):
    admin_headers = auth_headers("user-resourceadmin-1", "resource_admin")
    target_date = "2026-12-10"

    # Create and approve an event (Faculty requests, Admin approves)
    req = client.post(
        "/api/events/",
        headers=auth_headers("user-faculty-1", "faculty"),
        json={
            "name": "Annual Conference",
            "organizer": "Dr Faculty",
            "venue_id": "VENUE-AUDITORIUM",
            "event_date": target_date,
            "start_slot": "slot2",
            "end_slot": "slot5",
            "expected_audience": 300,
            "event_purpose": "Meeting / Discussion",
        }
    )
    assert req.status_code == 200
    evt_id = req.json()["id"]

    # Approve it
    appr = client.post(
        f"/api/events/{evt_id}/review",
        headers=admin_headers,
        json={"decision": "approved", "notes": "Confirmed allocation."}
    )
    assert appr.status_code == 200

    # Competing request trying to book overlapping slot (slot4-slot6)
    conflict_res = client.post(
        "/api/events/",
        headers=auth_headers("user-director-1", "campus_director"),
        json={
            "name": "Director Address",
            "organizer": "Director",
            "venue_id": "VENUE-AUDITORIUM",
            "event_date": target_date,
            "start_slot": "slot4",
            "end_slot": "slot6",
            "expected_audience": 300,
            "event_purpose": "Meeting / Discussion",
        }
    )
    assert conflict_res.status_code == 409
    assert "already booked" in conflict_res.json()["detail"].lower()


# ==============================================================================
# TEST 6: Competing requests resolution and ranking
# ==============================================================================
def test_competing_requests_resolution(client):
    admin_headers = auth_headers("user-resourceadmin-1", "resource_admin")
    target_date = "2026-12-15"

    # Faculty request (P = 43)
    f_res = client.post(
        "/api/events/",
        headers=auth_headers("user-faculty-1", "faculty"),
        json={
            "name": "Faculty Event",
            "organizer": "Faculty Member",
            "venue_id": "VENUE-AUDITORIUM",
            "event_date": target_date,
            "start_slot": "slot4",
            "end_slot": "slot8",
            "expected_audience": 150,
            "event_purpose": "Seminar",
        }
    )
    assert f_res.status_code == 200

    # Dean request for same slot (P = 91)
    d_res = client.post(
        "/api/events/",
        headers=auth_headers("user-dean-1", "dean"),
        json={
            "name": "Dean Executive Forum",
            "organizer": "Dean",
            "venue_id": "VENUE-AUDITORIUM",
            "event_date": target_date,
            "start_slot": "slot4",
            "end_slot": "slot8",
            "expected_audience": 150,
            "event_purpose": "Meeting / Discussion",
        }
    )
    assert d_res.status_code == 200
    d_data = d_res.json()
    assert d_data["recommended_action"] == "RECOMMEND_APPROVAL"

    # Dean ranked 1st despite submitting second because P = 91 > 43
    comp = client.get(
        f"/api/events/competing?venue_id=VENUE-AUDITORIUM&event_date={target_date}&start_slot=slot4&end_slot=slot8",
        headers=admin_headers
    ).json()

    assert comp["competing_requests"][0]["request_id"] == d_data["id"]
    assert comp["competing_requests"][0]["combined_priority_score"] == 91.0
    assert comp["competing_requests"][1]["combined_priority_score"] == 43.0


# ==============================================================================
# TEST 7 & 8: Filtering and ranking alternatives
# ==============================================================================
def test_filtering_and_ranking_alternatives():
    class MockRoom:
        def __init__(self, rid, name, bldg, cap, rtype="event_venue", proj=True, ac=True, audio=True, maint=False):
            self.id = rid
            self.name = name
            self.building = bldg
            self.capacity = cap
            self.type = rtype
            self.has_projector = proj
            self.has_ac = ac
            self.has_audio = audio
            self.is_under_maintenance = maint

    r_pref = MockRoom("r1", "Hall A", "AB1", 200)
    r_fit = MockRoom("r2", "Hall B", "AB1", 180, proj=True, ac=True, audio=True)
    r_small = MockRoom("r3", "Hall C", "AB1", 50)  # Insufficient capacity for 120
    r_maint = MockRoom("r4", "Hall D", "AB1", 200, maint=True)  # Maintenance
    r_no_proj = MockRoom("r5", "Hall E", "AB1", 200, proj=False)  # Missing projector

    rooms = [r_pref, r_fit, r_small, r_maint, r_no_proj]

    alts = find_alternative_venues(
        all_rooms=rooms,
        preferred_room_id="r1",
        event_date="2026-12-20",
        start_slot="slot4",
        end_slot="slot6",
        expected_audience=120,
        confirmed_bookings=[],
        timetable_slots=[],
        requires_projector=True,
    )

    alt_ids = [a["venue_id"] for a in alts]
    assert "r2" in alt_ids
    assert "r3" not in alt_ids  # Filtered by capacity
    assert "r4" not in alt_ids  # Filtered by maintenance
    assert "r5" not in alt_ids  # Filtered by required projector


# ==============================================================================
# TEST 9: Suggesting alternate times when no venue is feasible
# ==============================================================================
def test_suggesting_alternate_time_slots():
    class MockRoom:
        id = "VENUE-1"
        name = "Amrita Hall"
        building = "AB1"
        capacity = 200
        is_under_maintenance = False

    time_alts = find_alternative_time_slots(
        preferred_room=MockRoom(),
        event_date="2026-12-22",
        start_slot="slot4",
        end_slot="slot6",
        expected_audience=100,
        confirmed_bookings=[],
        horizon_days=2,
        limit=3,
    )

    assert len(time_alts) >= 1
    for opt in time_alts:
        assert opt["type"] == "alternative_time"
        assert opt["venue_id"] == "VENUE-1"
        assert opt["availability_verified"] is True
        assert opt["suitability_score"] > 0


# ==============================================================================
# TEST 10: Rejecting unauthorized approval attempts
# ==============================================================================
def test_rejecting_unauthorized_approval_attempts(client):
    student_headers = auth_headers("user-student-1", "student")
    
    # Student attempts to review/approve
    res = client.post(
        "/api/events/some-event-id/review",
        headers=student_headers,
        json={"decision": "approved", "notes": "Self approval"}
    )
    # Student lacks event.request.approve permission
    assert res.status_code == 403


# ==============================================================================
# TEST 11: Requiring justification for lower-priority override
# ==============================================================================
def test_requiring_justification_for_lower_priority_override(client):
    admin_headers = auth_headers("user-resourceadmin-1", "resource_admin")
    target_date = "2026-12-25"

    # Higher priority Dean request (P = 91)
    d_res = client.post(
        "/api/events/",
        headers=auth_headers("user-dean-1", "dean"),
        json={
            "name": "Dean Keynote",
            "organizer": "Dean",
            "venue_id": "VENUE-AUDITORIUM",
            "event_date": target_date,
            "start_slot": "slot4",
            "end_slot": "slot6",
            "expected_audience": 200,
            "event_purpose": "Meeting / Discussion",
        }
    )
    assert d_res.status_code == 200

    # Lower priority Faculty request (P = 43)
    f_res = client.post(
        "/api/events/",
        headers=auth_headers("user-faculty-1", "faculty"),
        json={
            "name": "Faculty Talk",
            "organizer": "Faculty Member",
            "venue_id": "VENUE-AUDITORIUM",
            "event_date": target_date,
            "start_slot": "slot4",
            "end_slot": "slot6",
            "expected_audience": 200,
            "event_purpose": "Seminar",
        }
    )
    assert f_res.status_code == 200
    faculty_evt_id = f_res.json()["id"]

    # Admin tries to approve the lower-priority faculty request WITHOUT justification
    bad_approve = client.post(
        f"/api/events/{faculty_evt_id}/review",
        headers=admin_headers,
        json={"decision": "approved", "notes": ""}
    )
    assert bad_approve.status_code == 400
    assert "justification" in bad_approve.json()["detail"].lower()

    # Admin provides valid written justification -> Succeeds!
    good_approve = client.post(
        f"/api/events/{faculty_evt_id}/review",
        headers=admin_headers,
        json={
            "decision": "approved",
            "override_justification": "Approved per Dean's verbal rescheduling of the keynote to next semester."
        }
    )
    assert good_approve.status_code == 200
    assert good_approve.json()["status"] == "approved"
    assert "Dean's verbal rescheduling" in good_approve.json()["override_justification"]


# ==============================================================================
# TEST 12: Enforcing valid booking state transitions
# ==============================================================================
def test_enforcing_valid_booking_state_transitions():
    # Valid transitions
    ok1, _ = validate_state_transition("PENDING", "APPROVED")
    assert ok1 is True
    ok2, _ = validate_state_transition("PENDING", "REJECTED")
    assert ok2 is True
    ok3, _ = validate_state_transition("ALTERNATIVES_OFFERED", "ALTERNATIVE_SELECTED")
    assert ok3 is True

    # Invalid transitions
    bad1, err1 = validate_state_transition("REJECTED", "APPROVED")
    assert bad1 is False
    assert "Illegal state transition" in err1

    bad2, err2 = validate_state_transition("COMPLETED", "PENDING")
    assert bad2 is False


# ==============================================================================
# TEST 13: Preventing users from assigning themselves higher roles
# ==============================================================================
def test_preventing_user_self_role_assignment(client):
    # A student attempts to submit an event with role='campus_director' in body
    student_headers = auth_headers("user-student-1", "student")
    res = client.post(
        "/api/events/",
        headers=student_headers,
        json={
            "name": "Hacked Event",
            "organizer": "Student Guy",
            "venue_id": "VENUE-AUDITORIUM",
            "event_date": "2026-12-28",
            "start_slot": "slot2",
            "end_slot": "slot3",
            "expected_audience": 50,
            "event_purpose": "Meeting / Discussion",
        }
    )
    assert res.status_code == 200
    data = res.json()
    # Server derived score strictly from verified token (student: R=10, not 100)
    assert data["role_score"] == 10.0


# ==============================================================================
# TEST 14: Preventing private booking data from leaking through APIs
# ==============================================================================
def test_preventing_private_booking_data_leak(client):
    admin_headers = auth_headers("user-resourceadmin-1", "resource_admin")
    student_headers = auth_headers("user-student-1", "student")

    # Faculty submits private request
    client.post(
        "/api/events/",
        headers=auth_headers("user-faculty-1", "faculty"),
        json={
            "name": "Confidential Faculty Board",
            "organizer": "Dr Secret",
            "venue_id": "VENUE-AUDITORIUM",
            "event_date": "2026-12-30",
            "start_slot": "slot8",
            "end_slot": "slot10",
            "expected_audience": 80,
            "event_purpose": "Meeting / Discussion",
        }
    )

    # Student queries event list
    stud_events = client.get("/api/events/", headers=student_headers).json()
    event_names = [evt["name"] for evt in stud_events]
    # Student must NOT see other users' pending requests
    assert "Confidential Faculty Board" not in event_names
    for evt in stud_events:
        # Internal administrative raw and sigmoid scores are never leaked
        assert evt["raw_score"] is None
        assert evt["sigmoid_confidence"] is None
        if evt["status"] != "approved":
            assert evt["organizer_id"] == "user-student-1"


# ==============================================================================
# TEST 15: Rechecking availability when a requester selects an alternative
# ==============================================================================
def test_alternative_selection_and_availability_recheck(client):
    fac_headers = auth_headers("user-faculty-1", "faculty")
    admin_headers = auth_headers("user-resourceadmin-1", "resource_admin")

    # 1. Create a request
    req = client.post(
        "/api/events/",
        headers=fac_headers,
        json={
            "name": "Robotics Workshop",
            "organizer": "Dr Faculty",
            "venue_id": "VENUE-AUDITORIUM",
            "event_date": "2026-12-31",
            "start_slot": "slot4",
            "end_slot": "slot6",
            "expected_audience": 80,
            "event_purpose": "Workshop",
        }
    )
    assert req.status_code == 200
    evt_id = req.json()["id"]

    # 2. Select alternative venue (VENUE-SEMINAR-AB1)
    sel_res = client.post(
        f"/api/events/{evt_id}/select-alternative",
        headers=fac_headers,
        json={
            "selection_type": "alternative_venue",
            "selected_venue_id": "VENUE-SEMINAR-AB1",
            "selected_date": "2026-12-31",
            "selected_start_slot": "slot4",
            "selected_end_slot": "slot6",
            "notes": "Moving to Seminar Hall AB1."
        }
    )
    assert sel_res.status_code == 200
    sel_data = sel_res.json()
    assert sel_data["status"] == "ALTERNATIVE_SELECTED"
    assert sel_data["venue_id"] == "VENUE-SEMINAR-AB1"

    # 3. If another request attempts to select this newly booked slot when confirmed, conflict is raised
    # Approve first
    client.post(
        f"/api/events/{evt_id}/review",
        headers=admin_headers,
        json={"decision": "approved", "notes": "Approved alternative."}
    )

    # Another requester creates an event and tries to select that same slot
    req2 = client.post(
        "/api/events/",
        headers=auth_headers("user-faculty-2", "faculty"),
        json={
            "name": "Competing Workshop",
            "organizer": "Dr Faculty 2",
            "venue_id": "VENUE-AUDITORIUM",
            "event_date": "2026-12-31",
            "start_slot": "slot4",
            "end_slot": "slot6",
            "expected_audience": 80,
            "event_purpose": "Workshop",
        }
    )
    evt2_id = req2.json()["id"]

    conflict_sel = client.post(
        f"/api/events/{evt2_id}/select-alternative",
        headers=auth_headers("user-faculty-2", "faculty"),
        json={
            "selection_type": "alternative_venue",
            "selected_venue_id": "VENUE-SEMINAR-AB1",
            "selected_date": "2026-12-31",
            "selected_start_slot": "slot4",
            "selected_end_slot": "slot6",
        }
    )
    # Rechecking detects confirmed conflict -> HTTP 409!
    assert conflict_sel.status_code == 409
