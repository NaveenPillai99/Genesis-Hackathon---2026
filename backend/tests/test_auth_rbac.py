def test_demo_users_count(client):
    res = client.get("/api/auth/demo-users")
    assert res.status_code == 200
    users = res.json()
    assert len(users) == 9
    roles = {u["role"] for u in users}
    assert "student" in roles
    assert "class_rep" in roles
    assert "class_advisor" in roles
    assert "faculty" in roles
    assert "lab_assistant" in roles
    assert "lab_admin" in roles
    assert "resource_admin" in roles
    assert "lost_property_handler" in roles
    assert "sys_admin" in roles

def test_login_success_and_failure(client):
    # Valid
    res = client.post("/api/auth/login", json={
        "email": "aarav@cb.students.amrita.edu",
        "password": "demo123"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "student"

    # Invalid
    res_bad = client.post("/api/auth/login", json={
        "email": "aarav@cb.students.amrita.edu",
        "password": "wrongpassword"
    })
    assert res_bad.status_code == 401

def test_rbac_student_blocked_from_audit(client):
    # Login as student
    login_res = client.post("/api/auth/quick-login/user-student-1")
    token = login_res.json()["access_token"]

    # Attempt to read audit log
    audit_res = client.get("/api/audit/", headers={"Authorization": f"Bearer {token}"})
    assert audit_res.status_code == 403

def test_rbac_sysadmin_allowed_audit(client):
    # Login as sysadmin
    login_res = client.post("/api/auth/quick-login/user-sysadmin-1")
    token = login_res.json()["access_token"]

    audit_res = client.get("/api/audit/", headers={"Authorization": f"Bearer {token}"})
    assert audit_res.status_code == 200
    assert isinstance(audit_res.json(), list)
