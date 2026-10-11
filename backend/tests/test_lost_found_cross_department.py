import pytest

def test_cross_department_found_report_routing(client):
    # 1. Student Aarav Menon finds white AirPods in AB3 and routes to CSE Department
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
    found_id = found_item["id"]

    # Verify department routing to CSE Department
    assert found_item["destination_department_id"] == "dept-cse"
    assert "Computer Science" in found_item["destination_department_name"]
    assert found_item["custody_status"] == "in_custody"
    assert found_item["status"] == "in_custody"
    assert found_item["assigned_handler_id"] is not None

def test_cross_department_lost_matching_and_notification(client):
    # 1. Student Aarav reports found item routed to CSE
    login_st1 = client.post("/api/auth/quick-login/user-student-1")
    headers_st1 = {"Authorization": f"Bearer {login_st1.json()['access_token']}"}

    res_found = client.post("/api/lost-found/report", json={
        "report_type": "found",
        "title": "White Apple AirPods with Case",
        "category": "electronics",
        "description": "White wireless earbuds in charging case found in AB3.",
        "location_found": "AB3 Corridor Floor 2",
        "destination_department_id": "dept-cse",
        "characteristics": "Colour: White, Brand: Apple, Case: White glossy with small scratch near hinge",
        "found_date": "2026-10-11",
        "found_time": "11:15",
        "is_physically_handed_over": True,
        "storage_location": "CSE Department Office"
    }, headers=headers_st1)
    assert res_found.status_code == 200
    found_item = res_found.json()
    found_id = found_item["id"]

    # 2. Student Rohan Gupta reports lost AirPods in AB3
    login_st2 = client.post("/api/auth/quick-login/user-student-2")
    headers_st2 = {"Authorization": f"Bearer {login_st2.json()['access_token']}"}

    res_lost = client.post("/api/lost-found/report", json={
        "report_type": "lost",
        "title": "White Apple AirPods Wireless Earbuds",
        "category": "electronics",
        "description": "Misplaced white AirPods in white case while attending lecture in AB3.",
        "location_found": "AB3",
        "characteristics": "Colour: White, Brand: Apple",
        "private_identifying_details": "Serial ends with 94X2, faint blue marker dot on right earbud",
        "found_date": "2026-10-11",
        "found_time": "10:30"
    }, headers=headers_st2)
    assert res_lost.status_code == 200
    lost_item = res_lost.json()
    lost_id = lost_item["id"]

    # 3. Check matching endpoint - should compute High Confidence match
    res_matches = client.get(f"/api/lost-found/{lost_id}/matches")
    assert res_matches.status_code == 200
    matches_data = res_matches.json()
    assert len(matches_data["matches"]) >= 1

    top_match = matches_data["matches"][0]
    assert top_match["match_score"] >= 85.0
    assert top_match["confidence_level"] == "HIGH"
    assert "category_score" in top_match["component_scores"]
    assert "characteristics_score" in top_match["component_scores"]

    # 4. Check owner received notification with non-leaked description and collection instructions
    notifs_res = client.get("/api/notifications/", headers=headers_st2)
    assert notifs_res.status_code == 200
    notif_list = notifs_res.json()
    match_notifs = [n for n in notif_list if "Possible Lost & Found Match" in n["title"]]
    assert len(match_notifs) >= 1
    assert "college ID card" in match_notifs[0]["message"]

    # 5. Unrelated item (Black Sony Headphones) should receive low score, not high
    res_unrelated = client.post("/api/lost-found/report", json={
        "report_type": "found",
        "title": "Black Sony Over-Ear Headphones",
        "category": "electronics",
        "description": "Black large noise cancelling headphones found on lawn.",
        "location_found": "AB1 Front Lawn",
        "destination_department_id": "dept-welfare",
        "characteristics": "Colour: Black, Brand: Sony",
        "found_date": "2026-10-05"
    }, headers=headers_st1)
    unrelated_id = res_unrelated.json()["id"]

    res_unrelated_matches = client.get(f"/api/lost-found/{unrelated_id}/matches")
    unrelated_matches = res_unrelated_matches.json()["matches"]
    for m in unrelated_matches:
        if m["item"]["id"] == lost_id:
            assert m["match_score"] < 65.0  # Must be LOW confidence, no false high alert

    # 6. In-Person College ID Verification & Handover
    login_cse_handler = client.post("/api/auth/quick-login/user-faculty-1")
    headers_handler = {"Authorization": f"Bearer {login_cse_handler.json()['access_token']}"}

    verif_res = client.post(f"/api/lost-found/{found_id}/in-person-verification", json={
        "claimant_college_id": "CB.EN.U4CSE21235",
        "claimant_name": "Rohan Gupta",
        "verification_notes": "Student presented valid College ID card and correctly identified blue ink dot.",
        "handover_notes": "Physical item released to Rohan Gupta."
    }, headers=headers_handler)

    assert verif_res.status_code == 200
    verified_item = verif_res.json()
    assert verified_item["status"] == "returned"
    assert verified_item["custody_status"] == "returned"
    assert verified_item["verification_status"] == "id_verified"
    assert verified_item["claimant_college_id"] == "CB.EN.U4CSE21235"
    assert verified_item["handover_recipient_name"] == "Rohan Gupta"

    # 7. Unauthorized user cannot perform in-person verification
    unauth_res = client.post(f"/api/lost-found/{unrelated_id}/in-person-verification", json={
        "claimant_college_id": "CB.EN.FAKE123",
        "claimant_name": "Fake Person"
    }, headers=headers_st1)  # Student role
    assert unauth_res.status_code == 403

def test_department_transfer_workflow(client):
    # Student finds item and routes to CSE Department
    login_st = client.post("/api/auth/quick-login/user-student-1")
    headers_st = {"Authorization": f"Bearer {login_st.json()['access_token']}"}

    res = client.post("/api/lost-found/report", json={
        "report_type": "found",
        "title": "Calculus Textbook (Stewart 8th Ed)",
        "category": "books",
        "description": "Hardcover calculus book found in corridor.",
        "location_found": "AB3 Floor 1",
        "destination_department_id": "dept-cse",
        "found_date": "2026-10-11"
    }, headers=headers_st)
    item_id = res.json()["id"]

    # CSE Handler transfers custody to Mathematics Department
    login_cse = client.post("/api/auth/quick-login/user-faculty-1")
    headers_cse = {"Authorization": f"Bearer {login_cse.json()['access_token']}"}

    transfer_res = client.post(f"/api/lost-found/{item_id}/transfer", json={
        "new_department_id": "dept-math",
        "transfer_reason": "Course textbook belongs to Mathematics Faculty repository.",
        "new_storage_location": "Mathematics Department AB1 Room 202"
    }, headers=headers_cse)

    assert transfer_res.status_code == 200
    transferred_item = transfer_res.json()
    assert transferred_item["destination_department_id"] == "dept-math"
    assert transferred_item["status"] == "transferred"
    assert len(transferred_item["custody_logs"]) >= 2
