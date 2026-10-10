def test_availability_calculation(client):
    res = client.get("/api/classrooms/availability?date=2026-10-12")  # 2026-10-12 is Monday
    assert res.status_code == 200
    data = res.json()
    assert data["day_of_week"] == "Monday"
    assert len(data["availability"]) > 0

    # AB1 E-104 on Monday slot2 has Deep Learning -> should be 'timetabled'
    room_104 = next((r for r in data["availability"] if r["room_id"] == "room-ab1-e104"), None)
    assert room_104 is not None
    assert room_104["slots"]["slot2"]["status"] == "timetabled"

def test_booking_conflict_prevention_and_double_booking(client):
    # Quick login as Class Rep
    login_res = client.post("/api/auth/quick-login/user-classrep-1")
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Attempt to book a slot that is already in official timetable (Monday Slot 2 in AB1-E104)
    res_conflict = client.post("/api/classrooms/book", json={
        "room_id": "room-ab1-e104",
        "booking_date": "2026-10-12",
        "slot_id": "slot2",
        "purpose": "Class revision"
    }, headers=headers)
    assert res_conflict.status_code == 409
    assert "Conflict: Slot already occupied by official timetable" in res_conflict.json()["detail"]

    # 2. Book a free slot (e.g. AB2-202 on Monday Slot 8)
    res_success = client.post("/api/classrooms/book", json={
        "room_id": "room-ab2-202",
        "booking_date": "2026-10-12",
        "slot_id": "slot8",
        "purpose": "Study circle"
    }, headers=headers)
    assert res_success.status_code == 200
    booking_id = res_success.json()["id"]

    # 3. Double-booking attempt on same room, date, and slot -> MUST FAIL with 409
    res_double = client.post("/api/classrooms/book", json={
        "room_id": "room-ab2-202",
        "booking_date": "2026-10-12",
        "slot_id": "slot8",
        "purpose": "Another conflicting group"
    }, headers=headers)
    assert res_double.status_code == 409
    assert "Double-booking prevented" in res_double.json()["detail"]

    # 4. Check in to the booking
    res_checkin = client.post(f"/api/classrooms/bookings/{booking_id}/checkin", headers=headers)
    assert res_checkin.status_code == 200
    assert res_checkin.json()["status"] == "checked_in"

def test_student_cannot_book_directly(client):
    # Login as student
    login_res = client.post("/api/auth/quick-login/user-student-1")
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/classrooms/book", json={
        "room_id": "room-ab2-202",
        "booking_date": "2026-10-13",
        "slot_id": "slot4",
        "purpose": "Student group"
    }, headers=headers)
    assert res.status_code == 403
