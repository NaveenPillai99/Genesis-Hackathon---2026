import pytest
from app.auth import create_access_token

def auth_headers(user_id: str, role: str):
    token = create_access_token({"sub": user_id, "role": role})
    return {"Authorization": f"Bearer {token}"}

# ==============================================================================
# TEST 1: Centralized Approval Architecture - Campus Director is Final Authority
# ==============================================================================
def test_01_centralized_final_approval_enforcement(client):
    """
    Critical Rule: The Campus Director is the final approval authority for event
    requests and campus resource bookings. Other roles may recommend or review,
    but cannot independently approve.
    """
    # 1. Create a pending event request by faculty
    faculty_headers = auth_headers("user-faculty-1", "faculty")
    create_payload = {
        "name": "National AI Symposium",
        "organizer": "Dr Thilaga M",
        "venue_id": "VENUE-AUDITORIUM",
        "event_date": "2026-11-20",
        "start_slot": "slot2",
        "end_slot": "slot6",
        "expected_audience": 250,
        "level": "national",
        "is_academic": True,
        "has_external_guests": True,
    }
    create_res = client.post("/api/events/", headers=faculty_headers, json=create_payload)
    assert create_res.status_code == 200
    event_data = create_res.json()
    event_id = event_data["id"]
    assert event_data["status"].upper() == "PENDING"

    # 2. HOD attempts to directly APPROVE the event -> Must receive 403 Forbidden
    hod_headers = auth_headers("user-hod-1", "hod")
    hod_direct_approve = client.post(
        f"/api/events/{event_id}/review",
        headers=hod_headers,
        json={"decision": "approved", "notes": "HOD direct approval attempt"}
    )
    assert hod_direct_approve.status_code == 403
    assert "Campus Director is the final approval authority" in hod_direct_approve.json()["detail"]

    # 3. Dean attempts to directly APPROVE the event -> Must receive 403 Forbidden
    dean_headers = auth_headers("user-dean-1", "dean")
    dean_direct_approve = client.post(
        f"/api/events/{event_id}/review",
        headers=dean_headers,
        json={"decision": "approved", "notes": "Dean direct approval attempt"}
    )
    assert dean_direct_approve.status_code == 403
    assert "Campus Director is the final approval authority" in dean_direct_approve.json()["detail"]

    # 4. Resource Admin attempts to directly APPROVE the event -> Must receive 403 Forbidden
    admin_headers = auth_headers("user-resourceadmin-1", "resource_admin")
    admin_direct_approve = client.post(
        f"/api/events/{event_id}/review",
        headers=admin_headers,
        json={"decision": "approved", "notes": "Admin direct approval attempt"}
    )
    assert admin_direct_approve.status_code == 403
    assert "Campus Director is the final approval authority" in admin_direct_approve.json()["detail"]

    # 5. HOD submits an official RECOMMENDATION -> Must succeed (200 OK)
    hod_recommend = client.post(
        f"/api/events/{event_id}/recommend",
        headers=hod_headers,
        json={
            "recommendation": "RECOMMENDED",
            "notes": "Strongly recommended by CSE Department Head. Space verified."
        }
    )
    assert hod_recommend.status_code == 200
    rec_result = hod_recommend.json()
    assert rec_result["status"].upper() in ("RECOMMENDED", "AWAITING_DIRECTOR_APPROVAL")
    assert rec_result["department_recommendation"] == "RECOMMENDED"
    assert rec_result["department_reviewer_name"] == "Dr Prema Nedungadi"

    # 6. Campus Director performs FINAL APPROVAL -> Must succeed (200 OK)
    director_headers = auth_headers("user-director-1", "campus_director")
    director_approve = client.post(
        f"/api/events/{event_id}/review",
        headers=director_headers,
        json={
            "decision": "approved",
            "notes": "Officially sanctioned and approved by Campus Director."
        }
    )
    assert director_approve.status_code == 200
    approved_event = director_approve.json()
    assert approved_event["status"].upper() == "APPROVED"
    assert approved_event["director_decision"] == "APPROVED"
    assert approved_event["director_name"] == "Dr Sasangan Ramanathan"

# ==============================================================================
# TEST 2: Student Timetable Strict Isolation
# ==============================================================================
def test_02_student_timetable_isolation(client):
    """
    Students may only view their own class timetable.
    They cannot view other classes or faculty-wide schedules.
    """
    student_headers = auth_headers("user-student-1", "student")

    # 1. Access own class section -> 200 OK
    res_own = client.get("/api/timetable/slots?class_section=CSE%2C%20V%20A", headers=student_headers)
    assert res_own.status_code == 200

    # 2. Access another class section -> 403 Forbidden
    res_other = client.get("/api/timetable/slots?class_section=CSE%2C%20V%20B", headers=student_headers)
    assert res_other.status_code == 403
    assert "restricted" in res_other.json()["detail"].lower()

    # 3. Access another department -> 403 Forbidden
    res_other_dept = client.get("/api/timetable/slots?department=MECH", headers=student_headers)
    assert res_other_dept.status_code == 403

    # 4. Attempt to query faculty schedules -> 403 Forbidden (students restricted)
    res_fac = client.get("/api/timetable/faculty-schedules", headers=student_headers)
    assert res_fac.status_code == 403
    assert "Students are not permitted" in res_fac.json()["detail"]

# ==============================================================================
# TEST 3: Class Representative Timetable Scoping & Relevant Faculty Access
# ==============================================================================
def test_03_class_rep_scoped_visibility(client):
    """
    Class Reps can view their own class section and only faculty teaching their class.
    Querying unrelated faculty results in 403 Forbidden.
    """
    cr_headers = auth_headers("user-classrep-1", "class_rep")

    # 1. Access own class section -> 200 OK
    res_own = client.get("/api/timetable/slots?class_section=Int.%20M.Sc%20Data%20Science%2C%20VII%20B", headers=cr_headers)
    assert res_own.status_code == 200

    # 2. Access another class section -> 403 Forbidden
    res_other = client.get("/api/timetable/slots?class_section=CSE%2C%20V%20A", headers=cr_headers)
    assert res_other.status_code == 403

    # 3. Faculty schedules query for faculty teaching their class -> 200 OK
    res_fac = client.get("/api/timetable/faculty-schedules?faculty_name=Dr%20Thilaga%20M", headers=cr_headers)
    assert res_fac.status_code == 200

    # 4. Faculty schedules query for an unrelated faculty -> 403 Forbidden
    res_unrelated_fac = client.get("/api/timetable/faculty-schedules?faculty_name=Dr%20Prashant%20R%20Nair", headers=cr_headers)
    assert res_unrelated_fac.status_code == 403
    assert "teaching your class" in res_unrelated_fac.json()["detail"].lower()

# ==============================================================================
# TEST 4: HOD and Dean Hierarchical Timetable Access
# ==============================================================================
def test_04_hod_and_dean_hierarchical_scopes(client):
    """
    HOD has full scope over their department, but not other departments.
    Dean has scope over their school/authorized departments.
    Campus Director has institution-wide scope.
    """
    hod_headers = auth_headers("user-hod-1", "hod")
    dean_headers = auth_headers("user-dean-1", "dean")
    director_headers = auth_headers("user-director-1", "campus_director")

    # 1. HOD accesses CSE class sections -> 200 OK
    res_cse = client.get("/api/timetable/slots?department=CSE", headers=hod_headers)
    assert res_cse.status_code == 200

    # 2. HOD accesses another department (e.g. MECH) -> 403 Forbidden
    res_hod_mech = client.get("/api/timetable/slots?department=MECH", headers=hod_headers)
    assert res_hod_mech.status_code == 403
    assert "outside your department scope" in res_hod_mech.json()["detail"].lower()

    # 3. Dean of Engineering accesses CSE -> 200 OK
    res_dean_cse = client.get("/api/timetable/slots?department=CSE", headers=dean_headers)
    assert res_dean_cse.status_code == 200

    # 4. Campus Director accesses all departments without restriction
    res_dir_cse = client.get("/api/timetable/slots?department=CSE", headers=director_headers)
    assert res_dir_cse.status_code == 200
    res_dir_all = client.get("/api/timetable/slots", headers=director_headers)
    assert res_dir_all.status_code == 200
    assert len(res_dir_all.json()) > 0

    # 5. Campus Director views all faculty schedules
    res_dir_fac = client.get("/api/timetable/faculty-schedules", headers=director_headers)
    assert res_dir_fac.status_code == 200

# ==============================================================================
# TEST 5: Priority Scoring, Override Justification & Alternative Recommendations
# ==============================================================================
def test_05_competing_requests_override_and_alternatives(client):
    """
    Validates:
    - Competing event requests prioritization
    - Campus Director override justification requirement
    - Alternative venue suggestions
    """
    director_headers = auth_headers("user-director-1", "campus_director")

    # 1. Create lower priority event request
    low_req = client.post(
        "/api/events/",
        headers=auth_headers("user-student-1", "student"),
        json={
            "name": "Casual Student Coding Meetup",
            "organizer": "Student Club",
            "venue_id": "VENUE-SEMINAR-AB1",
            "event_date": "2026-12-18",
            "start_slot": "slot2",
            "end_slot": "slot4",
            "expected_audience": 20,
            "level": "club",
            "is_academic": False,
        }
    )
    assert low_req.status_code == 200
    low_id = low_req.json()["id"]

    # 2. Create higher priority event request on the same venue & time
    high_req = client.post(
        "/api/events/",
        headers=auth_headers("user-faculty-1", "faculty"),
        json={
            "name": "International Research Symposium 2026",
            "organizer": "Research Deanery",
            "venue_id": "VENUE-SEMINAR-AB1",
            "event_date": "2026-12-18",
            "start_slot": "slot2",
            "end_slot": "slot4",
            "expected_audience": 120,
            "level": "international",
            "is_academic": True,
            "has_external_guests": True,
        }
    )
    assert high_req.status_code == 200
    high_id = high_req.json()["id"]

    # 3. Check competing requests endpoint for low_id
    competing_res = client.get(f"/api/events/{low_id}/competing", headers=director_headers)
    assert competing_res.status_code == 200
    competing_data = competing_res.json()
    assert competing_data["total_competing"] >= 1

    # 4. Attempt to approve lower-priority request without justification -> 400 Bad Request
    fail_approve = client.post(
        f"/api/events/{low_id}/review",
        headers=director_headers,
        json={"decision": "approved", "notes": "Direct approve attempt"}
    )
    assert fail_approve.status_code == 400
    assert "Written justification is strictly required" in fail_approve.json()["detail"]

    # 5. Campus Director provides written override justification -> 200 OK
    success_override = client.post(
        f"/api/events/{low_id}/review",
        headers=director_headers,
        json={
            "decision": "approved",
            "override_justification": "Approved per institutional priority directive for student coding initiative by Campus Director."
        }
    )
    assert success_override.status_code == 200
    approved_obj = success_override.json()
    assert approved_obj["status"].upper() == "APPROVED"
    assert approved_obj["director_override_applied"] is True

    # 6. Check alternative venue recommendations for displaced request
    alt_res = client.get(f"/api/events/{high_id}/alternatives", headers=director_headers)
    assert alt_res.status_code == 200
    alt_data = alt_res.json()
    assert "alternative_venues" in alt_data or "alternatives" in alt_data
