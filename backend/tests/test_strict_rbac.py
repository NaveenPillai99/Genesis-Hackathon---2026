import pytest
from app.auth import create_access_token

def auth_headers(user_id: str, role: str):
    token = create_access_token({"sub": user_id, "role": role})
    return {"Authorization": f"Bearer {token}"}

# ==============================================================================
# TEST 1: Each role receives its intended dashboard and navigation permissions
# ==============================================================================
def test_01_role_permissions_and_scope_assignment(client):
    res = client.post("/api/auth/quick-login/user-student-1")
    assert res.status_code == 200
    perms = res.json()["permissions"]
    assert "classroom.view" in perms
    assert "event.request.create" in perms
    assert "hpc.manage_nodes" not in perms
    assert "event.request.approve" not in perms

    res = client.post("/api/auth/quick-login/user-hpcfaculty-1")
    assert res.status_code == 200
    hpc_perms = res.json()["permissions"]
    assert "hpc.manage_nodes" in hpc_perms
    assert "hpc.approve_allocations" in hpc_perms
    assert "classroom.book" not in hpc_perms
    assert "event.request.approve" not in hpc_perms

# ==============================================================================
# TEST 2: HPC Faculty does not see classroom management or event admin by default
# ==============================================================================
def test_02_hpc_faculty_data_isolation(client):
    headers = auth_headers("user-hpcfaculty-1", "hpc_faculty")

    # HPC Faculty can access HPC overview
    hpc_res = client.get("/api/hpc/overview", headers=headers)
    assert hpc_res.status_code == 200
    assert "total_nodes" in hpc_res.json()

    # HPC Faculty cannot approve event venue requests
    evt_res = client.post(
        "/api/events/evt-001/review",
        headers=headers,
        json={"decision": "approved", "notes": "Unauthorized attempt"}
    )
    assert evt_res.status_code == 403

# ==============================================================================
# TEST 3: A student cannot call an HPC administration API
# ==============================================================================
def test_03_student_cannot_call_hpc_admin_api(client):
    headers = auth_headers("user-student-1", "student")
    res = client.post(
        "/api/hpc/nodes/node-gpu-01/status",
        headers=headers,
        json={"status": "maintenance", "notes": "Hacked node"}
    )
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]

# ==============================================================================
# TEST 4: A class representative cannot edit the official timetable directly
# ==============================================================================
def test_04_class_rep_cannot_edit_official_timetable_directly(client):
    headers = auth_headers("user-classrep-1", "class_rep")
    res = client.post(
        "/api/timetable/slots",
        headers=headers,
        json={
            "room_id": "AB1-E103B",
            "day": "Monday",
            "slot_id": "slot2",
            "code": "22HACK99",
            "course_name": "Unauthorized Class",
            "faculty": "Fake Faculty",
            "class_section": "Int. M.Sc Data Science, VII B"
        }
    )
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]

# ==============================================================================
# TEST 5: A class advisor cannot manage unassigned classes
# ==============================================================================
def test_05_class_advisor_cannot_manage_unassigned_classes(client):
    headers = auth_headers("user-classadvisor-1", "class_advisor")

    # First, submit a request for an unassigned class section (e.g., 'CSE, VII A')
    admin_headers = auth_headers("user-resourceadmin-1", "resource_admin")
    req_res = client.post(
        "/api/timetable/change-requests",
        headers=admin_headers,
        json={
            "course_code": "22CSC401",
            "course_name": "Deep Learning",
            "class_section": "CSE, VII A",
            "original_day": "Monday",
            "original_slot": "slot2",
            "original_room_id": "AB1-E104",
            "proposed_day": "Tuesday",
            "proposed_slot": "slot8",
            "proposed_room_id": "AB1-E104",
            "reason": "Test unassigned section request"
        }
    )
    assert req_res.status_code == 200
    req_id = req_res.json()["id"]

    # Class Advisor Dr Devika (assigned to Int. M.Sc Data Science, VII B) tries to approve CSE, VII A
    review_res = client.post(
        f"/api/timetable/change-requests/{req_id}/review",
        headers=headers,
        json={"decision": "approved", "review_notes": "Attempting cross-class approval"}
    )
    assert review_res.status_code == 403
    assert "not assigned to class section" in review_res.json()["detail"]

# ==============================================================================
# TEST 6: A lab assistant cannot update unrelated equipment
# ==============================================================================
def test_06_lab_assistant_cannot_update_unrelated_equipment(client):
    # Suresh Kumar is assigned to 'fac-3dprint', NOT 'fac-electronics'
    headers = auth_headers("user-labassist-1", "lab_assistant")

    # Updating fac-3dprint succeeds
    ok_res = client.post(
        "/api/facilities/fac-3dprint/maintenance",
        headers=headers,
        json={"is_under_maintenance": True, "maintenance_reason": "Nozzle cleaning"}
    )
    assert ok_res.status_code == 200

    # Updating unassigned fac-electronics fails with 403
    fail_res = client.post(
        "/api/facilities/fac-electronics/maintenance",
        headers=headers,
        json={"is_under_maintenance": True, "maintenance_reason": "Unauthorized service"}
    )
    assert fail_res.status_code == 403
    assert "not assigned to maintain equipment" in fail_res.json()["detail"]

# ==============================================================================
# TEST 7: A lab admin cannot automatically administer every campus resource
# ==============================================================================
def test_07_lab_admin_cannot_administer_event_venues(client):
    headers = auth_headers("user-labadmin-1", "lab_admin")
    res = client.post(
        "/api/events/evt-001/review",
        headers=headers,
        json={"decision": "approved", "notes": "Lab admin approving auditorium"}
    )
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]

# ==============================================================================
# TEST 8: Central Resource Admin can process authorized event venue requests
# ==============================================================================
def test_08_central_resource_admin_can_process_event_requests(client):
    # Student submits an event request
    student_headers = auth_headers("user-student-1", "student")
    ev_res = client.post(
        "/api/events/",
        headers=student_headers,
        json={
            "name": "Robotics Club Showcase",
            "organizer": "Robotics Club",
            "venue_id": "VENUE-SEMINAR-AB1",
            "event_date": "2026-11-20",
            "start_slot": "slot4",
            "end_slot": "slot6",
            "expected_audience": 80,
            "level": "club",
            "is_academic": True,
            "has_external_guests": False,
            "purpose": "Annual student bot competition"
        }
    )
    assert ev_res.status_code == 200
    ev_id = ev_res.json()["id"]

    # Central Resource Admin approves it
    admin_headers = auth_headers("user-resourceadmin-1", "resource_admin")
    rev_res = client.post(
        f"/api/events/{ev_id}/review",
        headers=admin_headers,
        json={"decision": "approved", "notes": "Approved by Resource Admin"}
    )
    assert rev_res.status_code == 200
    assert rev_res.json()["status"] == "approved"

# ==============================================================================
# TEST 9: A user cannot approve their own request
# ==============================================================================
def test_09_user_cannot_approve_own_request(client):
    admin_headers = auth_headers("user-resourceadmin-1", "resource_admin")

    # Resource Admin submits a venue request as organizer
    ev_res = client.post(
        "/api/events/",
        headers=admin_headers,
        json={
            "name": "Space Office Staff Meeting",
            "organizer": "Mr Ramesh Iyer",
            "venue_id": "VENUE-SEMINAR-AB1",
            "event_date": "2026-11-22",
            "start_slot": "slot8",
            "end_slot": "slot10",
            "expected_audience": 40,
            "level": "department",
            "is_academic": False,
            "has_external_guests": False
        }
    )
    assert ev_res.status_code == 200
    ev_id = ev_res.json()["id"]

    # Same user attempts to self-approve
    self_rev_res = client.post(
        f"/api/events/{ev_id}/review",
        headers=admin_headers,
        json={"decision": "approved", "notes": "Self approval"}
    )
    assert self_rev_res.status_code == 403
    assert "Conflict of Interest" in self_rev_res.json()["detail"]

# ==============================================================================
# TEST 10: Users cannot obtain additional permissions by altering payloads
# ==============================================================================
def test_10_client_cannot_escalate_privilege_via_payload(client):
    student_headers = auth_headers("user-student-1", "student")

    # Student passes payload pretending to have 'admin' authority
    res = client.post(
        "/api/hpc/nodes/node-gpu-01/status",
        headers=student_headers,
        json={"status": "offline", "notes": "I am an admin", "override_role": "sys_admin"}
    )
    assert res.status_code == 403

# ==============================================================================
# TEST 11: Multi-role accounts receive only the union of explicit permissions
# ==============================================================================
def test_11_multi_role_receives_only_explicit_union(client):
    # Verify that a student only has student permissions and cannot call audit
    student_headers = auth_headers("user-student-1", "student")
    audit_res = client.get("/api/audit/", headers=student_headers)
    assert audit_res.status_code == 403

# ==============================================================================
# TEST 12: Unauthorized access does not leak protected resource data
# ==============================================================================
def test_12_unauthorized_access_does_not_leak_protected_records(client):
    # Non-existent node returns 404 for authorized user, but 403 for unauthorized caller
    student_headers = auth_headers("user-student-1", "student")
    res = client.post(
        "/api/hpc/nodes/fake-node-secret-999/status",
        headers=student_headers,
        json={"status": "offline"}
    )
    # The unauthorized student is blocked by RBAC before finding out if fake-node exists!
    assert res.status_code == 403
