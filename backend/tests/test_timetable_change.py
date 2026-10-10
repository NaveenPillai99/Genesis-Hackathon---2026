def test_timetable_change_request_and_approval_flow(client):
    # 1. Login as Class Rep
    login_rep = client.post("/api/auth/quick-login/user-classrep-1")
    token_rep = login_rep.json()["access_token"]
    headers_rep = {"Authorization": f"Bearer {token_rep}"}

    # Propose reschedule
    req_res = client.post("/api/timetable/change-requests", json={
        "course_code": "22CSC553",
        "course_name": "Cloud Computing",
        "class_section": "Int. M.Sc Data Science, VII B",
        "original_day": "Friday",
        "original_slot": "slot8",
        "original_room_id": "room-ab1-e103b",
        "proposed_day": "Thursday",
        "proposed_slot": "slot9",
        "proposed_room_id": "room-ab1-e103b",
        "proposed_date": "2026-10-15",
        "reason": "Faculty attending seminar on Friday; prepone to Thursday."
    }, headers=headers_rep)
    assert req_res.status_code == 200
    change_id = req_res.json()["id"]
    assert req_res.json()["status"] == "pending"

    # 2. Login as Class Advisor Dr Devika to approve
    login_adv = client.post("/api/auth/quick-login/user-classadvisor-1")
    token_adv = login_adv.json()["access_token"]
    headers_adv = {"Authorization": f"Bearer {token_adv}"}

    review_res = client.post(f"/api/timetable/change-requests/{change_id}/review", json={
        "decision": "approved",
        "review_notes": "Reviewed with Dr Kavitha. Approved."
    }, headers=headers_adv)
    assert review_res.status_code == 200
    assert review_res.json()["status"] == "approved"
    assert review_res.json()["approver_name"] == "Dr Devika"

    # 3. Verify timetable slots updated
    tt_res = client.get("/api/classrooms/timetable?day=Thursday&room_id=room-ab1-e103b")
    assert tt_res.status_code == 200
    slots = tt_res.json()
    new_slot = next((s for s in slots if s["slot_id"] == "slot9" and s["code"] == "22CSC553"), None)
    assert new_slot is not None
    assert new_slot["course_name"] == "Cloud Computing"
