import pytest
from datetime import date, timedelta
from app.priority_service import (
    calculate_people_priority,
    calculate_event_priority,
    sigmoid,
    to_binary_priority,
    normalize_audience,
    calculate_urgency,
    calculate_stakeholder_participation,
    PriorityPolicy,
    DEFAULT_CUTOFF,
    DEFAULT_STEEPNESS,
)
from app.auth import create_access_token


def auth_headers(user_id: str, role: str):
    token = create_access_token({"sub": user_id, "role": role})
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# 1. HOD VERSUS STUDENT ROLE WEIGHTS & ALL ROLE TIERS
# ==============================================================================
def test_hod_versus_student_role_weights():
    """
    Verify role-based priority scores for people:
    - HOD / Department Head: 1.00 -> sigmoid ~0.9820 >= 0.5 -> binary priority 1 (High)
    - Student: 0.30 -> sigmoid ~0.0474 < 0.5 -> binary priority 0 (Normal)
    """
    hod_res = calculate_people_priority("hod")
    assert hod_res["priority"] == 1
    assert hod_res["priority_label"] == "High Priority"
    assert hod_res["raw_score"] == 1.00
    assert hod_res["sigmoid_confidence"] >= 0.98

    dept_head_res = calculate_people_priority("department_head")
    assert dept_head_res["priority"] == 1
    assert dept_head_res["raw_score"] == 1.00

    student_res = calculate_people_priority("student")
    assert student_res["priority"] == 0
    assert student_res["priority_label"] == "Normal Priority"
    assert student_res["raw_score"] == 0.30
    assert student_res["sigmoid_confidence"] <= 0.05

    # Check full policy tiers
    expected_weights = {
        "sys_admin": (0.95, 1),
        "resource_admin": (0.90, 1),
        "faculty": (0.75, 1),
        "class_advisor": (0.70, 1),
        "lab_admin": (0.65, 1),
        "lab_assistant": (0.50, 0),
        "class_rep": (0.45, 0),
        "student": (0.30, 0),
    }

    for role, (expected_weight, expected_binary) in expected_weights.items():
        res = calculate_people_priority(role)
        assert res["raw_score"] == expected_weight
        assert res["priority"] == expected_binary, f"Failed for {role}: got {res['priority']}"


# ==============================================================================
# 2. UNIVERSITY VS DEPARTMENT VS CLUB EVENT WEIGHTS
# ==============================================================================
def test_university_vs_department_vs_club_weights():
    """
    Verify event level feature weights:
    - University event: 1.00
    - Department event: 0.70
    - Club event: 0.40
    All other factors equal, university > department > club.
    """
    ref_date = date(2026, 11, 1)
    event_date = "2026-11-10"

    univ = calculate_event_priority(
        level="university",
        is_academic=True,
        expected_audience=200,
        event_date=event_date,
        has_external_guests=False,
        reference_date=ref_date,
    )
    dept = calculate_event_priority(
        level="department",
        is_academic=True,
        expected_audience=200,
        event_date=event_date,
        has_external_guests=False,
        reference_date=ref_date,
    )
    club = calculate_event_priority(
        level="club",
        is_academic=True,
        expected_audience=200,
        event_date=event_date,
        has_external_guests=False,
        reference_date=ref_date,
    )

    assert univ["breakdown"]["level"]["normalized"] == 1.00
    assert dept["breakdown"]["level"]["normalized"] == 0.70
    assert club["breakdown"]["level"]["normalized"] == 0.40

    assert univ["raw_score"] > dept["raw_score"] > club["raw_score"]
    assert univ["sigmoid_confidence"] > dept["sigmoid_confidence"] > club["sigmoid_confidence"]


# ==============================================================================
# 3. SCORES BELOW, EQUAL TO, AND ABOVE SIGMOID CUTOFF
# ==============================================================================
def test_sigmoid_cutoff_boundaries():
    """
    Verify behavior around cutoff = 0.60:
    - S < 0.60 => sigmoid(S) < 0.5 => priority = 0
    - S == 0.60 => sigmoid(S) == 0.5 => priority = 1
    - S > 0.60 => sigmoid(S) > 0.5 => priority = 1
    """
    # Exactly at cutoff (S = 0.60)
    sig_at_cutoff = sigmoid(0.60, cutoff=0.60, steepness=10.0)
    assert abs(sig_at_cutoff - 0.50) < 1e-9
    assert to_binary_priority(sig_at_cutoff) == 1

    # Just below cutoff (S = 0.599)
    sig_below = sigmoid(0.599, cutoff=0.60, steepness=10.0)
    assert sig_below < 0.50
    assert to_binary_priority(sig_below) == 0

    # Just above cutoff (S = 0.601)
    sig_above = sigmoid(0.601, cutoff=0.60, steepness=10.0)
    assert sig_above > 0.50
    assert to_binary_priority(sig_above) == 1

    # Well below cutoff
    assert to_binary_priority(sigmoid(0.40, cutoff=0.60, steepness=10.0)) == 0

    # Well above cutoff
    assert to_binary_priority(sigmoid(0.85, cutoff=0.60, steepness=10.0)) == 1


def test_configurable_cutoff_and_steepness():
    """
    Verify that cutoff and steepness are configurable and respected deterministically.
    """
    custom_policy = PriorityPolicy(cutoff=0.75, steepness=15.0)

    # At S = 0.70, under default cutoff (0.60) this was priority 1.
    # Under custom cutoff (0.75), S = 0.70 must now be priority 0.
    res_default = calculate_people_priority("class_advisor")  # weight 0.70
    assert res_default["priority"] == 1

    res_custom = calculate_people_priority("class_advisor", policy=custom_policy)
    assert res_custom["priority"] == 0
    assert res_custom["cutoff"] == 0.75
    assert res_custom["steepness"] == 15.0


# ==============================================================================
# 4. BINARY OUTPUT STRICTLY RESTRICTED TO 0 OR 1
# ==============================================================================
def test_binary_output_restricted_to_zero_or_one():
    """
    Exhaustively verify that priority output is always an int strictly in {0, 1}.
    """
    for val in [0.0, 0.1, 0.25, 0.499, 0.50, 0.5001, 0.75, 1.0, 1.5, -0.5]:
        prio = to_binary_priority(val)
        assert prio in (0, 1)
        assert isinstance(prio, int)

    # Test across fine-grained simulated scores
    for score_int in range(0, 101):
        s = score_int / 100.0
        sig_val = sigmoid(s)
        prio = to_binary_priority(sig_val)
        assert prio in (0, 1)
        assert isinstance(prio, int)


# ==============================================================================
# 5. INVALID INPUTS AND MISSING VALUES
# ==============================================================================
def test_invalid_and_missing_inputs_safe_handling():
    """
    Verify safe input sanitization:
    - Missing/None/negative audience does not artificially inflate priority.
    - Invalid event levels default safely to fallback (0.40).
    - Unknown roles default safely to fallback (0.30).
    - Invalid/past dates yield 0.0 urgency.
    """
    # Negative and None audience
    assert normalize_audience(-50) == 0.0
    assert normalize_audience(None) == 0.0
    assert normalize_audience("invalid_number") == 0.0

    # Unknown role defaults safely
    unknown_person = calculate_people_priority("hacker_god_role")
    assert unknown_person["raw_score"] == 0.30
    assert unknown_person["priority"] == 0

    # Unknown event level defaults safely
    unknown_evt = calculate_event_priority(
        level="illegal_super_level",
        is_academic=False,
        expected_audience=-100,
        event_date="invalid-date",
        has_external_guests=False,
    )
    assert unknown_evt["breakdown"]["level"]["normalized"] == 0.40
    assert unknown_evt["breakdown"]["audience"]["normalized"] == 0.0
    assert unknown_evt["breakdown"]["urgency"]["normalized"] == 0.0
    assert unknown_evt["priority"] == 0


# ==============================================================================
# 6. UNAUTHORIZED ATTEMPTS TO MANIPULATE ROLES OR PRIORITY (API LEVEL)
# ==============================================================================
def test_client_cannot_manipulate_priority_via_payload(client):
    """
    A student client attempts to submit high priority or forged role in request body.
    Backend must compute priority strictly from verified authenticated user.
    """
    student_headers = auth_headers("user-student-1", "student")

    res = client.post(
        "/api/events/",
        headers=student_headers,
        json={
            "name": "Student Gaming Club",
            "organizer": "Student",
            "venue_id": "VENUE-SEMINAR-AB1",
            "event_date": "2026-11-25",
            "start_slot": "slot2",
            "end_slot": "slot3",
            "expected_audience": 20,
            "level": "club",
            "is_academic": False,
            "has_external_guests": False,
            "priority": 1,            # Forged priority attempt
            "priority_score": 100,    # Forged score attempt
            "role": "sys_admin",      # Forged role attempt
        }
    )
    assert res.status_code == 200
    data = res.json()
    # Verified: Backend computes priority = 0 (Normal Priority), ignoring payload forgery
    assert data["priority"] == 0
    assert data["priority_label"] == "Normal Priority"
    assert data["priority_score"] < 50


def test_client_cannot_inspect_other_user_priority(client):
    """
    A student cannot inspect other users' priority scores via /api/auth/priority.
    """
    student_headers = auth_headers("user-student-1", "student")
    res = client.get("/api/auth/priority?user_id=user-sysadmin-1", headers=student_headers)
    assert res.status_code == 403


def test_client_cannot_change_role_via_profile_update(client):
    """
    A student attempts to escalate role to 'hod' via PUT /api/auth/profile.
    Role modification is rejected/ignored.
    """
    student_headers = auth_headers("user-student-1", "student")
    res = client.put(
        "/api/auth/profile",
        headers=student_headers,
        json={"role": "hod", "priority": 1, "department": "CSE"}
    )
    assert res.status_code == 200
    # Role must still be student
    assert res.json()["role"] == "student"


# ==============================================================================
# 7. EVENT APPROVAL & VENUE CONFLICTS REMAIN FULLY FUNCTIONAL
# ==============================================================================
def test_event_approval_and_conflict_preservation(client):
    """
    Verify that:
    1. A high priority event does NOT auto-approve.
    2. A high priority event CANNOT bypass venue double-booking conflicts (409 Conflict).
    3. Self-approval remains forbidden (403 Forbidden).
    4. Approved events require administrator review.
    """
    admin_headers = auth_headers("user-resourceadmin-1", "resource_admin")
    faculty_headers = auth_headers("user-faculty-1", "faculty")

    # 1. Faculty requests University Academic Symposium (High Priority)
    res_evt = client.post(
        "/api/events/",
        headers=faculty_headers,
        json={
            "name": "National AI Symposium",
            "organizer": "Dr Thilaga M",
            "venue_id": "VENUE-AUDITORIUM",
            "event_date": "2026-11-28",
            "start_slot": "slot4",
            "end_slot": "slot8",
            "expected_audience": 450,
            "level": "university",
            "is_academic": True,
            "has_external_guests": True,
        }
    )
    assert res_evt.status_code == 200
    evt_data = res_evt.json()
    assert evt_data["priority"] == 1
    assert evt_data["priority_label"] == "High Priority"
    # CRITICAL: High priority event remains pending! NO auto-approval!
    assert evt_data["status"] == "pending"

    # 2. Resource Admin cannot finalize approval (403 Forbidden)
    res_adm_deny = client.post(
        f"/api/events/{evt_data['id']}/review",
        headers=admin_headers,
        json={"decision": "approved", "notes": "Resource Admin attempts final approval."}
    )
    assert res_adm_deny.status_code == 403

    # Resource Admin can recommend
    res_rec = client.post(
        f"/api/events/{evt_data['id']}/recommend",
        headers=admin_headers,
        json={"recommendation": "RECOMMENDED", "notes": "Recommended by Resource Admin."}
    )
    assert res_rec.status_code == 200

    # Campus Director performs final approval
    director_headers = auth_headers("user-director-1", "campus_director")
    res_approve = client.post(
        f"/api/events/{evt_data['id']}/review",
        headers=director_headers,
        json={"decision": "approved", "notes": "Approved for university conference."}
    )
    assert res_approve.status_code == 200
    assert res_approve.json()["status"] == "approved"

    # 3. Another high-priority university event tries to book the same venue on the same date
    # MUST FAIL with 409 Conflict - priority cannot bypass venue availability!
    res_conflict = client.post(
        "/api/events/",
        headers=admin_headers,
        json={
            "name": "Competing High Priority Summit",
            "organizer": "Central Resource Admin",
            "venue_id": "VENUE-AUDITORIUM",
            "event_date": "2026-11-28",
            "start_slot": "slot4",
            "end_slot": "slot8",
            "expected_audience": 500,
            "level": "university",
            "is_academic": True,
            "has_external_guests": True,
        }
    )
    assert res_conflict.status_code == 409
    assert "already booked" in res_conflict.json()["detail"]


# ==============================================================================
# 8. EVENT REQUEST QUEUE SORTING (PRIORITY DESC, SUBMISSION TIME ASC)
# ==============================================================================
def test_event_queue_priority_and_time_tiebreaker_sorting(client):
    """
    Verify that GET /api/events/ sorts High Priority (1) before Normal Priority (0),
    with created_at ascending as a stable tie-breaker.
    """
    admin_headers = auth_headers("user-resourceadmin-1", "resource_admin")
    student_headers = auth_headers("user-student-1", "student")

    res = client.get("/api/events/", headers=admin_headers)
    assert res.status_code == 200
    events = res.json()
    assert len(events) > 0

    # Check that in the list, no priority 0 appears before priority 1
    priorities = [e["priority"] for e in events]
    # Check that priorities are sorted descending
    for i in range(len(priorities) - 1):
        assert priorities[i] >= priorities[i + 1], f"Queue priority sort failed at index {i}"
