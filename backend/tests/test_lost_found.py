def test_lost_found_classroom_automatic_routing(client):
    # Student finds item in classroom AB1 E-104 during Slot 2 on Monday (Deep Learning)
    login_st = client.post("/api/auth/quick-login/user-student-1")
    token = login_st.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/lost-found/report", json={
        "report_type": "found",
        "title": "USB-C Flash Drive 64GB",
        "category": "electronics",
        "description": "SanDisk metal thumb drive found on instructor podium.",
        "location_found": "AB1 E-104",
        "is_classroom": True,
        "room_id": "room-ab1-e104",
        "found_date": "2026-10-12",  # Monday
        "found_time": "09:15",       # Slot 2 (08:50 - 09:40)
        "storage_location": "Classroom Desk"
    }, headers=headers)

    assert res.status_code == 200
    item = res.json()
    # Verified automatic routing to Class Advisor Dr Devika
    assert item["assigned_handler_name"] == "Dr Devika"
    assert item["current_custody"] == "class_advisor"
    assert "Classroom Timetable Match" in item["routing_reason"]
    assert "Dr Devika" in item["routing_reason"]

def test_lost_found_outdoor_routing_to_student_welfare(client):
    # Student finds keys outside near football ground
    login_st = client.post("/api/auth/quick-login/user-student-1")
    token = login_st.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/lost-found/report", json={
        "report_type": "found",
        "title": "Motorcycle Key with Honda Keychain",
        "category": "keys",
        "description": "Honda bike key found on cafeteria benches.",
        "location_found": "Campus Cafeteria Outdoor Deck",
        "is_classroom": False,
        "room_id": None,
        "found_date": "2026-10-12",
        "found_time": "14:00"
    }, headers=headers)

    assert res.status_code == 200
    item = res.json()
    # Verified automatic routing to Student Welfare Handler Ms Priya Balan
    assert item["assigned_handler_name"] == "Ms Priya Balan"
    assert item["current_custody"] == "student_welfare"
    item_id = item["id"]

    # Student files claim
    claim_res = client.post(f"/api/lost-found/{item_id}/claim", json={
        "proof_description": "Honda Shine key with scratches on the plastic head.",
        "contact_phone": "+91 99887 76655"
    }, headers=headers)
    assert claim_res.status_code == 200
    claim_id = claim_res.json()["id"]

    # Handler approves claim and records return handover
    login_welfare = client.post("/api/auth/quick-login/user-welfare-1")
    token_welfare = login_welfare.json()["access_token"]
    headers_welfare = {"Authorization": f"Bearer {token_welfare}"}

    review_res = client.post(f"/api/lost-found/claims/{claim_id}/review", json={
        "decision": "approved",
        "handler_notes": "Student demonstrated ignition key match."
    }, headers=headers_welfare)
    assert review_res.status_code == 200

    # Handover
    handover_res = client.post(f"/api/lost-found/{item_id}/handover", json={
        "new_custody": "returned",
        "handover_notes": "Handed over to Aarav Menon at Student Welfare Desk."
    }, headers=headers_welfare)
    assert handover_res.status_code == 200
    assert handover_res.json()["status"] == "returned"
    assert handover_res.json()["return_date"] is not None
