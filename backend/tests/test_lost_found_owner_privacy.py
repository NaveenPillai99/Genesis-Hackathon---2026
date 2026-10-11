import pytest

def test_01_student_with_no_lost_report_receives_no_found_records(client):
    """
    Requirement 9.1:
    A student with no lost-item report receives no found-item records.
    - Global listing endpoint /api/lost-found/ rejects the student with 403.
    - Owner-specific matches endpoint /api/lost-found/my-matches returns an empty list.
    - My lost reports endpoint /api/lost-found/my-lost-reports returns an empty list.
    """
    login_res = client.post("/api/auth/quick-login/user-student-1")
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Calling global listing endpoint is forbidden
    res_list = client.get("/api/lost-found/", headers=headers)
    assert res_list.status_code == 403

    # 2. My matches endpoint returns empty list for user with no matching lost reports
    res_matches = client.get("/api/lost-found/my-matches", headers=headers)
    assert res_matches.status_code == 200
    assert res_matches.json() == []

    # 3. My lost reports endpoint returns empty list
    res_reports = client.get("/api/lost-found/my-lost-reports", headers=headers)
    assert res_reports.status_code == 200
    assert res_reports.json() == []

def test_02_student_a_cannot_see_matches_belonging_to_student_b(client):
    """
    Requirement 9.2:
    Student A cannot see matches belonging to Student B.
    """
    login_st1 = client.post("/api/auth/quick-login/user-student-1")
    headers_st1 = {"Authorization": f"Bearer {login_st1.json()['access_token']}"}

    login_st2 = client.post("/api/auth/quick-login/user-student-2")
    headers_st2 = {"Authorization": f"Bearer {login_st2.json()['access_token']}"}

    # Found report routed to CSE
    res_found = client.post("/api/lost-found/report", json={
        "report_type": "found",
        "title": "Bose QuietComfort 45 Headphones",
        "category": "electronics",
        "description": "Black noise cancelling headphones found in AB3 Room 204.",
        "location_found": "AB3 Room 204",
        "destination_department_id": "dept-cse",
        "found_date": "2026-10-11",
        "found_time": "10:00",
        "is_physically_handed_over": True,
        "storage_location": "CSE Dept Desk"
    }, headers=headers_st1)
    assert res_found.status_code == 200

    # Student B (Rohan) submits a matching lost report
    res_lost_b = client.post("/api/lost-found/report", json={
        "report_type": "lost",
        "title": "Bose QuietComfort 45 Headphones Black",
        "category": "electronics",
        "description": "Lost my Bose headphones in AB3.",
        "location_found": "AB3 Room 204",
        "found_date": "2026-10-11"
    }, headers=headers_st2)
    assert res_lost_b.status_code == 200
    lost_b_id = res_lost_b.json()["id"]

    # Student B sees their match
    res_matches_b = client.get("/api/lost-found/my-matches", headers=headers_st2)
    assert res_matches_b.status_code == 200
    matches_b = res_matches_b.json()
    assert any(m["lost_report_id"] == lost_b_id for m in matches_b)

    # Student A queries /api/lost-found/my-matches and must NEVER see Student B's match!
    res_matches_a = client.get("/api/lost-found/my-matches", headers=headers_st1)
    assert res_matches_a.status_code == 200
    matches_a = res_matches_a.json()
    assert not any(m["lost_report_id"] == lost_b_id for m in matches_a)

def test_03_changing_owner_id_in_url_or_body_does_not_expose_other_records(client):
    """
    Requirement 9.3:
    Changing an owner ID in a URL or request body does not expose another student's records.
    """
    login_st1 = client.post("/api/auth/quick-login/user-student-1")
    headers_st1 = {"Authorization": f"Bearer {login_st1.json()['access_token']}"}

    login_st2 = client.post("/api/auth/quick-login/user-student-2")
    headers_st2 = {"Authorization": f"Bearer {login_st2.json()['access_token']}"}

    # Student 2 creates a lost report
    res_lost = client.post("/api/lost-found/report", json={
        "report_type": "lost",
        "title": "Secret Blue Diary with Lock",
        "category": "documents",
        "description": "Private personal journal.",
        "location_found": "Library",
        "found_date": "2026-10-11"
    }, headers=headers_st2)
    lost_id = res_lost.json()["id"]

    # Student 1 attempts to pass Student 2's ID via query params to tamper with owner-scoped queries
    tampered_reports = client.get(f"/api/lost-found/my-lost-reports?owner_id=user-student-2&user_id=user-student-2", headers=headers_st1)
    assert tampered_reports.status_code == 200
    assert not any(r["id"] == lost_id for r in tampered_reports.json())

    tampered_matches = client.get(f"/api/lost-found/my-matches?owner_id=user-student-2&user_id=user-student-2", headers=headers_st1)
    assert tampered_matches.status_code == 200
    assert not any(m["lost_report_id"] == lost_id for m in tampered_matches.json())

    # Student 1 attempts direct fetch of Student 2's item ID
    direct_get = client.get(f"/api/lost-found/{lost_id}", headers=headers_st1)
    assert direct_get.status_code == 403  # Forbidden

def test_04_students_cannot_call_global_found_item_listing(client):
    """
    Requirement 9.4:
    Students cannot call the old global found-item listing endpoint.
    """
    login_st = client.post("/api/auth/quick-login/user-student-1")
    headers = {"Authorization": f"Bearer {login_st.json()['access_token']}"}

    res = client.get("/api/lost-found/", headers=headers)
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]

def test_05_students_cannot_call_global_match_candidate_endpoint(client):
    """
    Requirement 9.5:
    Students cannot call the global match-candidate endpoint.
    """
    login_st = client.post("/api/auth/quick-login/user-student-1")
    headers = {"Authorization": f"Bearer {login_st.json()['access_token']}"}

    # Submits a report to get a valid item id
    res_lost = client.post("/api/lost-found/report", json={
        "report_type": "lost",
        "title": "Casio Scientific Calculator",
        "category": "electronics",
        "description": "Lost in classroom.",
        "location_found": "AB1 E-104",
        "found_date": "2026-10-11"
    }, headers=headers)
    item_id = res_lost.json()["id"]

    res_matches = client.get(f"/api/lost-found/{item_id}/matches", headers=headers)
    assert res_matches.status_code == 403
    assert "Forbidden" in res_matches.json()["detail"]

def test_06_student_api_responses_contain_no_private_details(client):
    """
    Requirement 9.6:
    Student-facing API responses contain no full found-item descriptions,
    finder identity, storage location, or private characteristics.
    """
    login_st1 = client.post("/api/auth/quick-login/user-student-1")
    headers_st1 = {"Authorization": f"Bearer {login_st1.json()['access_token']}"}

    login_st2 = client.post("/api/auth/quick-login/user-student-2")
    headers_st2 = {"Authorization": f"Bearer {login_st2.json()['access_token']}"}

    # Student 1 reports found item with private fields
    res_found = client.post("/api/lost-found/report", json={
        "report_type": "found",
        "title": "Kindle Paperwhite 11th Gen Signature",
        "category": "electronics",
        "description": "Green leather magnetic case with audible stickers and secret bookmark.",
        "location_found": "Central Library Desk 4",
        "destination_department_id": "dept-cse",
        "characteristics": "Agave Green, 32GB, wireless charging",
        "private_identifying_details": "Serial ending 8812, lockscreen email contact 'secret@user.com'",
        "storage_location": "CSE Vault Locker 2B",
        "found_date": "2026-10-11",
        "is_physically_handed_over": True
    }, headers=headers_st1)
    assert res_found.status_code == 200

    # Student 2 reports lost Kindle
    res_lost = client.post("/api/lost-found/report", json={
        "report_type": "lost",
        "title": "Kindle Paperwhite 11th Gen",
        "category": "electronics",
        "description": "Lost Kindle in library.",
        "location_found": "Library",
        "found_date": "2026-10-11"
    }, headers=headers_st2)
    assert res_lost.status_code == 200

    # Student 2 queries my-matches
    res_matches = client.get("/api/lost-found/my-matches", headers=headers_st2)
    assert res_matches.status_code == 200
    matches = res_matches.json()
    assert len(matches) >= 1

    match_card = matches[0]
    # Check that private fields are NEVER leaked
    assert "Green leather magnetic case" not in str(match_card)
    assert "audible stickers" not in str(match_card)
    assert "8812" not in str(match_card)
    assert "secret@user.com" not in str(match_card)
    assert "CSE Vault Locker 2B" not in str(match_card)
    assert "finder_id" not in match_card
    assert "finder_name" not in match_card
    assert "finder_email" not in match_card
    assert "match_score" not in match_card
    assert "component_scores" not in match_card

def test_07_authorized_handler_can_access_assigned_department_case(client):
    """
    Requirement 9.7:
    An authorized handler can access complete cases assigned to their department.
    """
    login_st = client.post("/api/auth/quick-login/user-student-1")
    headers_st = {"Authorization": f"Bearer {login_st.json()['access_token']}"}

    login_cse = client.post("/api/auth/quick-login/user-faculty-1")
    headers_cse = {"Authorization": f"Bearer {login_cse.json()['access_token']}"}

    res_found = client.post("/api/lost-found/report", json={
        "report_type": "found",
        "title": "HP Envy Wireless Mouse",
        "category": "electronics",
        "description": "Silver rechargeable Bluetooth mouse found in AB3 Room 204.",
        "location_found": "AB3 Room 204",
        "destination_department_id": "dept-cse",
        "storage_location": "CSE Reception Desk Drawer 3",
        "found_date": "2026-10-11",
        "is_physically_handed_over": True
    }, headers=headers_st)
    item_id = res_found.json()["id"]

    res_case = client.get(f"/api/lost-found/handler/cases/{item_id}", headers=headers_cse)
    assert res_case.status_code == 200
    case_data = res_case.json()
    assert case_data["id"] == item_id
    assert case_data["destination_department_id"] == "dept-cse"
    assert case_data["storage_location"] == "CSE Reception Desk Drawer 3"
    assert case_data["finder_id"] == "user-student-1"

def test_08_unauthorized_department_handler_cannot_access_other_dept_case(client):
    """
    Requirement 9.8:
    An unauthorized department handler cannot access another department's case.
    """
    login_st = client.post("/api/auth/quick-login/user-student-1")
    headers_st = {"Authorization": f"Bearer {login_st.json()['access_token']}"}

    # Math Handler (Dr Devika, user-classadvisor-1)
    login_math = client.post("/api/auth/quick-login/user-classadvisor-1")
    headers_math = {"Authorization": f"Bearer {login_math.json()['access_token']}"}

    # Item routed to CSE
    res_found = client.post("/api/lost-found/report", json={
        "report_type": "found",
        "title": "Logitech MX Master 3S Mouse",
        "category": "electronics",
        "description": "Black ergonomic mouse found in AB3.",
        "location_found": "AB3",
        "destination_department_id": "dept-cse",
        "found_date": "2026-10-11",
        "is_physically_handed_over": True
    }, headers=headers_st)
    cse_item_id = res_found.json()["id"]

    # Math Handler tries to fetch CSE case -> 403 Forbidden!
    res_unauth = client.get(f"/api/lost-found/handler/cases/{cse_item_id}", headers=headers_math)
    assert res_unauth.status_code == 403
    assert "Forbidden" in res_unauth.json()["detail"]

def test_09_student_welfare_can_access_authorized_cases(client):
    """
    Requirement 9.9:
    Student Welfare can access its authorized cases (campus-wide custody oversight).
    """
    login_st = client.post("/api/auth/quick-login/user-student-1")
    headers_st = {"Authorization": f"Bearer {login_st.json()['access_token']}"}

    # Student Welfare Custodian (Ms Priya Balan, user-welfare-1)
    login_welfare = client.post("/api/auth/quick-login/user-welfare-1")
    headers_welfare = {"Authorization": f"Bearer {login_welfare.json()['access_token']}"}

    res_found = client.post("/api/lost-found/report", json={
        "report_type": "found",
        "title": "Water Flask Milton Thermosteel",
        "category": "bottles",
        "description": "Silver flask found in central canteen.",
        "location_found": "Campus Central Canteen",
        "destination_department_id": "dept-welfare",
        "found_date": "2026-10-11",
        "is_physically_handed_over": True
    }, headers=headers_st)
    welfare_item_id = res_found.json()["id"]

    res_welfare = client.get(f"/api/lost-found/handler/cases/{welfare_item_id}", headers=headers_welfare)
    assert res_welfare.status_code == 200
    assert res_welfare.json()["id"] == welfare_item_id

def test_10_match_notification_directs_owner_without_full_details(client):
    """
    Requirement 9.10:
    A match notification directs the owner to the correct receiving office
    without revealing full found-item details.
    """
    login_st1 = client.post("/api/auth/quick-login/user-student-1")
    headers_st1 = {"Authorization": f"Bearer {login_st1.json()['access_token']}"}

    login_st2 = client.post("/api/auth/quick-login/user-student-2")
    headers_st2 = {"Authorization": f"Bearer {login_st2.json()['access_token']}"}

    res_found = client.post("/api/lost-found/report", json={
        "report_type": "found",
        "title": "Texas Instruments TI-Nspire CX II Calculator",
        "category": "electronics",
        "description": "Graphing calculator with bright yellow rechargeable battery compartment and sticker #99.",
        "location_found": "AB3 Room 204",
        "destination_department_id": "dept-cse",
        "characteristics": "Colour: Yellow/Black, Brand: Texas Instruments",
        "found_date": "2026-10-11",
        "is_physically_handed_over": True
    }, headers=headers_st1)
    assert res_found.status_code == 200

    res_lost = client.post("/api/lost-found/report", json={
        "report_type": "lost",
        "title": "Texas Instruments TI-Nspire Graphing Calculator",
        "category": "electronics",
        "description": "Lost my graphing calculator in AB3.",
        "location_found": "AB3 Room 204",
        "found_date": "2026-10-11"
    }, headers=headers_st2)
    assert res_lost.status_code == 200

    # Check notification sent to Student 2
    res_notifs = client.get("/api/notifications/", headers=headers_st2)
    assert res_notifs.status_code == 200
    notifs = res_notifs.json()

    match_notifs = [n for n in notifs if n["title"] == "Possible Lost Item Match"]
    assert len(match_notifs) >= 1
    msg = match_notifs[0]["message"]

    assert "college ID card" in msg
    assert "CSE Department" in msg
    # Verify no leakage of confidential characteristics or finder
    assert "sticker #99" not in msg
    assert "user-student-1" not in msg

def test_11_found_item_cannot_be_returned_without_authorized_id_verification(client):
    """
    Requirement 9.11:
    A found item cannot be returned without authorized identity verification and handover.
    """
    login_st1 = client.post("/api/auth/quick-login/user-student-1")
    headers_st1 = {"Authorization": f"Bearer {login_st1.json()['access_token']}"}

    login_cse = client.post("/api/auth/quick-login/user-faculty-1")
    headers_cse = {"Authorization": f"Bearer {login_cse.json()['access_token']}"}

    res_found = client.post("/api/lost-found/report", json={
        "report_type": "found",
        "title": "Titan Formal Black Watch",
        "category": "accessories",
        "description": "Watch found in AB3 corridor.",
        "location_found": "AB3 Corridor",
        "destination_department_id": "dept-cse",
        "found_date": "2026-10-11",
        "is_physically_handed_over": True
    }, headers=headers_st1)
    item_id = res_found.json()["id"]

    # Student attempts to trigger verification -> 403 Forbidden!
    unauth_verif = client.post(f"/api/lost-found/{item_id}/in-person-verification", json={
        "claimant_college_id": "CB.EN.U4CSE22001",
        "claimant_name": "Unauthorized Student",
        "verification_outcome": "passed"
    }, headers=headers_st1)
    assert unauth_verif.status_code == 403

    # Failed verification keeps item in custody (not returned)
    failed_verif = client.post(f"/api/lost-found/{item_id}/in-person-verification", json={
        "claimant_college_id": "CB.EN.FAKE001",
        "claimant_name": "Fake Claimant",
        "verification_outcome": "failed",
        "decision_reason": "Identity mismatch"
    }, headers=headers_cse)
    assert failed_verif.status_code == 200
    assert failed_verif.json()["status"] != "returned"

    # Successful verification marks item returned
    success_verif = client.post(f"/api/lost-found/{item_id}/in-person-verification", json={
        "claimant_college_id": "CB.EN.U4CSE22045",
        "claimant_name": "Rohan Gupta",
        "verification_outcome": "passed",
        "decision_reason": "College ID card matched and confirmed"
    }, headers=headers_cse)
    assert success_verif.status_code == 200
    assert success_verif.json()["status"] == "returned"
    assert success_verif.json()["verification_status"] == "id_verified"

def test_12_returned_and_closed_records_excluded_from_active_matching(client):
    """
    Requirement 9.12:
    Returned and closed records no longer generate active match notifications or appear in active matches.
    """
    login_st1 = client.post("/api/auth/quick-login/user-student-1")
    headers_st1 = {"Authorization": f"Bearer {login_st1.json()['access_token']}"}

    login_st2 = client.post("/api/auth/quick-login/user-student-2")
    headers_st2 = {"Authorization": f"Bearer {login_st2.json()['access_token']}"}

    login_cse = client.post("/api/auth/quick-login/user-faculty-1")
    headers_cse = {"Authorization": f"Bearer {login_cse.json()['access_token']}"}

    # Found report
    res_found = client.post("/api/lost-found/report", json={
        "report_type": "found",
        "title": "OnePlus Nord Buds 2",
        "category": "electronics",
        "description": "Grey charging case found in AB3 Room 204.",
        "location_found": "AB3 Room 204",
        "destination_department_id": "dept-cse",
        "found_date": "2026-10-11",
        "is_physically_handed_over": True
    }, headers=headers_st1)
    found_id = res_found.json()["id"]

    # Lost report
    res_lost = client.post("/api/lost-found/report", json={
        "report_type": "lost",
        "title": "OnePlus Nord Buds 2 Grey",
        "category": "electronics",
        "description": "Lost earbuds in AB3.",
        "location_found": "AB3 Room 204",
        "found_date": "2026-10-11"
    }, headers=headers_st2)
    lost_id = res_lost.json()["id"]

    # Before return, match exists
    matches_before = client.get("/api/lost-found/my-matches", headers=headers_st2).json()
    assert any(m["lost_report_id"] == lost_id for m in matches_before)

    # Handler verifies and returns item
    verif_res = client.post(f"/api/lost-found/{found_id}/in-person-verification", json={
        "claimant_college_id": "CB.EN.U4CSE22045",
        "claimant_name": "Rohan Gupta",
        "verification_outcome": "passed",
        "associated_lost_report_id": lost_id
    }, headers=headers_cse)
    assert verif_res.status_code == 200

    # After return, the returned pair is EXCLUDED from active matches
    matches_after = client.get("/api/lost-found/my-matches", headers=headers_st2).json()
    assert not any(m["lost_report_id"] == lost_id for m in matches_after)
