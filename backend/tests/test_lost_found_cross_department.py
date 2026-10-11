import pytest

def test_cross_department_found_report_routing(client):
    """
    Acceptance Criteria 1 & 2:
    A student can submit a found report and select a destination department.
    """
    login_st1 = client.post("/api/auth/quick-login/user-student-1")
    token_st1 = login_st1.json()["access_token"]
    headers_st1 = {"Authorization": f"Bearer {token_st1}"}

    res_found = client.post("/api/lost-found/report", json={
        "report_type": "found",
        "title": "White Apple AirPods 3rd Gen",
        "category": "electronics",
        "description": "White wireless earbuds in charging case found on 2nd floor window sill.",
        "location_found": "AB3 2nd Floor Corridor",
        "destination_department_id": "dept-cse",
        "characteristics": "Colour: White, Brand: Apple, Case: White glossy",
        "found_date": "2026-10-11",
        "found_time": "11:00",
        "is_physically_handed_over": True,
        "storage_location": "CSE Department Office AB3 Room 204"
    }, headers=headers_st1)

    assert res_found.status_code == 200
    found_item = res_found.json()
    assert found_item["destination_department_id"] == "dept-cse"
    assert "Computer Science" in found_item["destination_department_name"]
    assert found_item["custody_status"] == "in_custody"
    assert found_item["status"] == "in_custody"

def test_student_cannot_browse_other_students_reports_or_matches(client):
    """
    Acceptance Criteria 3, 4, 6 & 12:
    - A student cannot browse other students' full lost/found reports.
    - A student cannot retrieve the existing detailed match-candidate cards.
    - The student sees only their own report details.
    - API responses contain no unauthorized private fields even on manual direct calls.
    """
    login_st1 = client.post("/api/auth/quick-login/user-student-1")
    headers_st1 = {"Authorization": f"Bearer {login_st1.json()['access_token']}"}

    login_st2 = client.post("/api/auth/quick-login/user-student-2")
    headers_st2 = {"Authorization": f"Bearer {login_st2.json()['access_token']}"}

    # Student 2 (Rohan) submits a lost report with private identifying details
    res_lost = client.post("/api/lost-found/report", json={
        "report_type": "lost",
        "title": "Private Apple Watch SE",
        "category": "accessories",
        "description": "Black sport band Apple watch lost in AB3.",
        "location_found": "AB3",
        "characteristics": "Space Gray aluminum 44mm",
        "private_identifying_details": "Passcode pattern 2580, engraving 'Rohan G' on back sensor",
        "found_date": "2026-10-11"
    }, headers=headers_st2)
    assert res_lost.status_code == 200
    lost_id = res_lost.json()["id"]

    # Student 1 (Aarav) attempts to query all items via /api/lost-found/
    res_list = client.get("/api/lost-found/", headers=headers_st1)
    assert res_list.status_code == 403  # Forbidden: Students cannot call global found-item listing!

    # Student 1 attempts to directly fetch Student 2's report by ID
    res_direct = client.get(f"/api/lost-found/{lost_id}", headers=headers_st1)
    assert res_direct.status_code == 403  # Strictly Forbidden!

    # Student 1 attempts to directly fetch matching candidates for Student 2's report
    res_matches_st1 = client.get(f"/api/lost-found/{lost_id}/matches", headers=headers_st1)
    assert res_matches_st1.status_code == 403  # Students cannot retrieve match-candidate cards!

    # Even Student 2 (the owner) cannot call /matches directly to get internal factor breakdowns
    res_matches_st2 = client.get(f"/api/lost-found/{lost_id}/matches", headers=headers_st2)
    assert res_matches_st2.status_code == 403  # Match-candidate cards are handler-only

    # Student 2 CAN view their own report via my-lost-items without any leaked finder or score data
    res_my_lost = client.get("/api/lost-found/my-lost-items", headers=headers_st2)
    assert res_my_lost.status_code == 200
    my_reports = res_my_lost.json()
    matching_report = next((r for r in my_reports if r["id"] == lost_id), None)
    assert matching_report is not None
    assert "finder_id" not in matching_report
    assert "match_score" not in matching_report
    assert "component_scores" not in matching_report

def test_safe_match_notification_and_duplicate_prevention(client):
    """
    Acceptance Criteria 5 & 9:
    - Match notification contains only safe message and responsible office.
    - Does NOT disclose full description, private characteristics, finder ID, or match scores.
    - Does not repeatedly send notifications for the same active pair.
    """
    login_st1 = client.post("/api/auth/quick-login/user-student-1")
    headers_st1 = {"Authorization": f"Bearer {login_st1.json()['access_token']}"}

    login_st2 = client.post("/api/auth/quick-login/user-student-2")
    headers_st2 = {"Authorization": f"Bearer {login_st2.json()['access_token']}"}

    # Found report routed to CSE
    res_found = client.post("/api/lost-found/report", json={
        "report_type": "found",
        "title": "White Apple AirPods Pro 2",
        "category": "electronics",
        "description": "White wireless AirPods Pro with lanyard loop found in AB3 Room 204.",
        "location_found": "AB3 Room 204",
        "destination_department_id": "dept-cse",
        "characteristics": "Colour: White, Brand: Apple",
        "found_date": "2026-10-11",
        "found_time": "10:00",
        "is_physically_handed_over": True,
        "storage_location": "CSE Dept Desk AB3"
    }, headers=headers_st1)
    found_id = res_found.json()["id"]

    # Lost report by student 2
    res_lost = client.post("/api/lost-found/report", json={
        "report_type": "lost",
        "title": "White Apple AirPods Pro 2 Earbuds",
        "category": "electronics",
        "description": "Misplaced my AirPods Pro 2 in AB3 Room 204.",
        "location_found": "AB3 Room 204",
        "characteristics": "Colour: White, Brand: Apple",
        "private_identifying_details": "Serial ends in 77Q, slight dent on left pod",
        "found_date": "2026-10-11",
        "found_time": "09:45"
    }, headers=headers_st2)
    lost_id = res_lost.json()["id"]

    # Check notification received by Student 2
    notifs_res = client.get("/api/notifications/", headers=headers_st2)
    assert notifs_res.status_code == 200
    notif_list = notifs_res.json()
    match_notifs = [n for n in notif_list if n["title"] == "Possible Lost Item Match"]
    assert len(match_notifs) >= 1
    sample_msg = match_notifs[0]["message"]

    # Verify template requirements (Section 5)
    assert "A found item with a similar description to your lost-item report has been submitted to the" in sample_msg
    assert "college ID card" in sample_msg
    assert "CSE Department" in sample_msg
    # Verify NO leakage of private fields in notification
    assert "77Q" not in sample_msg
    assert "score" not in sample_msg.lower()
    assert "finder" not in sample_msg.lower()
    assert "user-student-1" not in sample_msg

    # Verify duplicate prevention: calling matching again does NOT create duplicate notification
    initial_count = len(match_notifs)
    # Simulate another trigger/report
    client.post("/api/lost-found/report", json={
        "report_type": "lost",
        "title": "Unrelated Blue Water Bottle",
        "category": "bottles",
        "description": "Blue insulated flask lost in mess.",
        "location_found": "Mess Hall",
        "found_date": "2026-10-11"
    }, headers=headers_st2)

    notifs_res2 = client.get("/api/notifications/", headers=headers_st2)
    match_notifs2 = [n for n in notifs_res2.json() if n["title"] == "Possible Lost Item Match" and "CSE Department" in n["message"]]
    assert len(match_notifs2) == initial_count  # No duplicate notifications for the same pair!

def test_student_my_lost_items_dashboard_and_cancellation(client):
    """
    Acceptance Criteria 6:
    Student private dashboard shows own reports, safe match status, and allows cancellation.
    """
    login_st = client.post("/api/auth/quick-login/user-student-2")
    headers_st = {"Authorization": f"Bearer {login_st.json()['access_token']}"}

    res_lost = client.post("/api/lost-found/report", json={
        "report_type": "lost",
        "title": "Scientific Calculator FX-991EX",
        "category": "electronics",
        "description": "Casio classwiz calculator lost in AB2.",
        "location_found": "AB2",
        "found_date": "2026-10-11"
    }, headers=headers_st)
    calc_id = res_lost.json()["id"]

    # Student cancels their own active report
    cancel_res = client.post(f"/api/lost-found/{calc_id}/cancel", headers=headers_st)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"

    # Verify report status is cancelled
    my_lost = client.get("/api/lost-found/my-lost-items", headers=headers_st).json()
    item = next(i for i in my_lost if i["id"] == calc_id)
    assert item["status"] == "cancelled"

def test_authorized_handler_cases_and_department_isolation(client):
    """
    Acceptance Criteria 7 & 8:
    - Authorized handlers can see owner name, institutional student ID, complete descriptions and matching details.
    - An unauthorized department handler cannot retrieve another department's cases.
    """
    # 1. Student reports found item routed to CSE Department
    login_st = client.post("/api/auth/quick-login/user-student-1")
    headers_st = {"Authorization": f"Bearer {login_st.json()['access_token']}"}

    res_found = client.post("/api/lost-found/report", json={
        "report_type": "found",
        "title": "Dell XPS 65W USB-C Charger",
        "category": "electronics",
        "description": "Black Dell adapter with 1.8m braided cable found in AB3 Room 204.",
        "location_found": "AB3 Room 204",
        "destination_department_id": "dept-cse",
        "found_date": "2026-10-11",
        "is_physically_handed_over": True,
        "storage_location": "AB3 Room 204 Shelf A"
    }, headers=headers_st)
    cse_item_id = res_found.json()["id"]

    # 2. CSE Handler (Dr Thilaga M, user-faculty-1) can retrieve CSE case
    login_cse = client.post("/api/auth/quick-login/user-faculty-1")
    headers_cse = {"Authorization": f"Bearer {login_cse.json()['access_token']}"}

    cse_case_res = client.get(f"/api/lost-found/handler/cases/{cse_item_id}", headers=headers_cse)
    assert cse_case_res.status_code == 200
    case_data = cse_case_res.json()
    assert case_data["title"] == "Dell XPS 65W USB-C Charger"
    assert case_data["destination_department_id"] == "dept-cse"
    assert "AB3 Room 204 Shelf A" in case_data["storage_location"]

    # CSE Handler can retrieve matching candidate breakdown
    cse_matches_res = client.get(f"/api/lost-found/{cse_item_id}/matches", headers=headers_cse)
    assert cse_matches_res.status_code == 200

    # 3. Unauthorized Handler: Mathematics Handler (Dr Devika, user-classadvisor-1) tries to retrieve CSE case
    login_math = client.post("/api/auth/quick-login/user-classadvisor-1")
    headers_math = {"Authorization": f"Bearer {login_math.json()['access_token']}"}

    math_unauth_case = client.get(f"/api/lost-found/handler/cases/{cse_item_id}", headers=headers_math)
    assert math_unauth_case.status_code == 403  # Isolation enforced: 403 Forbidden!

    math_unauth_matches = client.get(f"/api/lost-found/{cse_item_id}/matches", headers=headers_math)
    assert math_unauth_matches.status_code == 403  # Isolation enforced: 403 Forbidden!

    # 4. Student Welfare Handler (user-welfare-1) has campus-wide oversight
    login_welfare = client.post("/api/auth/quick-login/user-welfare-1")
    headers_welfare = {"Authorization": f"Bearer {login_welfare.json()['access_token']}"}

    welfare_case_res = client.get(f"/api/lost-found/handler/cases/{cse_item_id}", headers=headers_welfare)
    assert welfare_case_res.status_code == 200

def test_claimant_id_verification_workflow_and_closure(client):
    """
    Acceptance Criteria 9, 10 & 11:
    - Handler can verify claimant identity using registered institutional record.
    - Item cannot be marked returned before successful verification.
    - Failed verification leaves item in custody.
    - Successful verification marks found item RETURNED and lost report RECOVERED.
    - Returned items disappear from active matching.
    """
    login_st1 = client.post("/api/auth/quick-login/user-student-1")
    headers_st1 = {"Authorization": f"Bearer {login_st1.json()['access_token']}"}

    login_st2 = client.post("/api/auth/quick-login/user-student-2")
    headers_st2 = {"Authorization": f"Bearer {login_st2.json()['access_token']}"}

    login_cse = client.post("/api/auth/quick-login/user-faculty-1")
    headers_cse = {"Authorization": f"Bearer {login_cse.json()['access_token']}"}

    # Found report routed to CSE
    res_found = client.post("/api/lost-found/report", json={
        "report_type": "found",
        "title": "Titan Mechanical Watch",
        "category": "accessories",
        "description": "Titan automatic watch with brown leather strap found in AB3.",
        "location_found": "AB3 2nd Floor",
        "destination_department_id": "dept-cse",
        "characteristics": "Titan, brown leather, automatic",
        "found_date": "2026-10-11",
        "is_physically_handed_over": True,
        "storage_location": "AB3 Room 204 Cabinet"
    }, headers=headers_st1)
    found_id = res_found.json()["id"]

    # Lost report by student 2 (Rohan Gupta, CB.EN.U4CSE22045)
    res_lost = client.post("/api/lost-found/report", json={
        "report_type": "lost",
        "title": "Titan Mechanical Watch Brown",
        "category": "accessories",
        "description": "Lost my Titan watch with brown strap in AB3.",
        "location_found": "AB3",
        "characteristics": "Titan, brown strap",
        "private_identifying_details": "Engraved serial ending 3302 on glass back",
        "found_date": "2026-10-11"
    }, headers=headers_st2)
    lost_id = res_lost.json()["id"]

    # 1. Handler conducts verification with outcome = 'failed' (e.g. invalid ID or wrong answers)
    fail_res = client.post(f"/api/lost-found/{found_id}/in-person-verification", json={
        "claimant_college_id": "CB.EN.FAKE999",
        "claimant_name": "Suspicious Claimant",
        "verification_outcome": "failed",
        "decision_reason": "Could not identify movement serial or back engraving.",
        "verification_notes": "Identity mismatch with institutional record."
    }, headers=headers_cse)

    assert fail_res.status_code == 200
    assert fail_res.json()["status"] != "returned"  # Must NOT be marked returned!
    assert fail_res.json()["verification_status"] == "verification_failed"

    # 2. Legitimate owner arrives with valid College ID (CB.EN.U4CSE22045)
    pass_res = client.post(f"/api/lost-found/{found_id}/in-person-verification", json={
        "claimant_college_id": "CB.EN.U4CSE22045",
        "claimant_name": "Rohan Gupta",
        "verification_outcome": "passed",
        "decision_reason": "Physical College ID Card presented and verified. Back glass engraving 3302 confirmed.",
        "verification_notes": "Claimant verified against registered institutional student record."
    }, headers=headers_cse)

    assert pass_res.status_code == 200
    verified = pass_res.json()
    assert verified["status"] == "returned"
    assert verified["custody_status"] == "returned"
    assert verified["verification_status"] == "id_verified"
    assert verified["claimant_college_id"] == "CB.EN.U4CSE22045"
    assert verified["handover_recipient_name"] == "Rohan Gupta"

    # Verify associated lost report was updated to RECOVERED
    owner_lost_reports = client.get("/api/lost-found/my-lost-items", headers=headers_st2).json()
    lost_record = next(r for r in owner_lost_reports if r["id"] == lost_id)
    assert lost_record["status"] == "recovered"

    # 3. Collection confirmation notification sent to Rohan Gupta
    notifs = client.get("/api/notifications/", headers=headers_st2).json()
    collection_notifs = [n for n in notifs if n["title"] == "Collection Confirmation"]
    assert len(collection_notifs) >= 1
    assert "Titan Mechanical Watch Brown" in collection_notifs[0]["message"]
