from datetime import datetime
from app.database import SessionLocal, Base, engine
from app.models import (
    User, Room, TimetableSlot, RoomBooking, TimetableChangeRequest,
    EventRequest, Facility, FacilityBooking, HPCAllocation, UserInduction,
    LostFoundItem, ItemClaim, CustodyLog, Notification, AuditLog
)
from app.auth import hash_password

def seed_database(db: SessionLocal = None):
    Base.metadata.create_all(bind=engine)
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    # Clear existing if needed
    if db.query(User).first():
        db.close()
        return

    print("Seeding synthetic CampusConnect data...")

    # 1. Users (All 9 Roles)
    pwd = hash_password("demo123")
    demo_users = [
        User(
            id="user-student-1",
            name="Aarav Menon",
            email="aarav@cb.students.amrita.edu",
            role="student",
            department="CSE",
            class_section="CSE, V A",
            password_hash=pwd
        ),
        User(
            id="user-classrep-1",
            name="Devika Nair",
            email="devika.rep@cb.students.amrita.edu",
            role="class_rep",
            department="Int. M.Sc Data Science",
            class_section="Int. M.Sc Data Science, VII B",
            password_hash=pwd
        ),
        User(
            id="user-classadvisor-1",
            name="Dr Devika",
            email="devika.advisor@cb.amrita.edu",
            role="class_advisor",
            department="Mathematics",
            class_section="Int. M.Sc Data Science, VII B",
            password_hash=pwd
        ),
        User(
            id="user-faculty-1",
            name="Dr Thilaga M",
            email="thilaga@cb.amrita.edu",
            role="faculty",
            department="CSE",
            class_section="CSE / Data Science",
            password_hash=pwd
        ),
        User(
            id="user-labassist-1",
            name="Mr Suresh Kumar",
            email="suresh.lab@cb.amrita.edu",
            role="lab_assistant",
            department="HPC & Innovation Lab",
            class_section=None,
            password_hash=pwd
        ),
        User(
            id="user-labadmin-1",
            name="Dr Anand Shenoy",
            email="anand.labadmin@cb.amrita.edu",
            role="lab_admin",
            department="Computational Engineering",
            class_section=None,
            password_hash=pwd
        ),
        User(
            id="user-resourceadmin-1",
            name="Mr Ramesh Iyer",
            email="ramesh.admin@cb.amrita.edu",
            role="resource_admin",
            department="Event & Space Office",
            class_section=None,
            password_hash=pwd
        ),
        User(
            id="user-welfare-1",
            name="Ms Priya Balan",
            email="priya.welfare@cb.amrita.edu",
            role="lost_property_handler",
            department="Office of Student Welfare",
            class_section=None,
            password_hash=pwd
        ),
        User(
            id="user-sysadmin-1",
            name="Prof. K. R. Ramakrishnan",
            email="sysadmin@cb.amrita.edu",
            role="sys_admin",
            department="ICT & Campus Systems",
            class_section=None,
            password_hash=pwd
        ),
    ]
    for u in demo_users:
        db.add(u)
    db.commit()

    # 2. Rooms
    rooms = [
        Room(
            id="room-ab1-e103b",
            name="AB1 E-103B",
            building="AB1",
            floor="1st Floor",
            capacity=65,
            type="classroom",
            has_projector=True,
            has_ac=False,
            has_audio=False,
            notes="Standard lecture classroom with Smart Board."
        ),
        Room(
            id="room-ab1-e104",
            name="AB1 E-104",
            building="AB1",
            floor="1st Floor",
            capacity=70,
            type="classroom",
            has_projector=True,
            has_ac=True,
            has_audio=True,
            notes="Smart Classroom with dual projectors and microphone."
        ),
        Room(
            id="room-ab2-201",
            name="AB2-201",
            building="AB2",
            floor="2nd Floor",
            capacity=60,
            type="classroom",
            has_projector=True,
            has_ac=False,
            has_audio=False,
            notes="Classroom for Data Science & Business Analytics."
        ),
        Room(
            id="room-ab2-202",
            name="AB2-202",
            building="AB2",
            floor="2nd Floor",
            capacity=55,
            type="classroom",
            has_projector=True,
            has_ac=False,
            has_audio=False,
            notes="Seminar style classroom with tiered seating."
        ),
        Room(
            id="room-ab3-301",
            name="AB3-301",
            building="AB3",
            floor="3rd Floor",
            capacity=80,
            type="classroom",
            has_projector=True,
            has_ac=True,
            has_audio=True,
            notes="Large smart classroom."
        ),
        Room(
            id="venue-audi",
            name="Amriteshwari Auditorium",
            building="AB3",
            floor="Ground Floor",
            capacity=450,
            type="event_venue",
            has_projector=True,
            has_ac=True,
            has_audio=True,
            notes="Main university auditorium with acoustic dampening and backstage."
        ),
        Room(
            id="venue-seminar-ab1",
            name="AB1 Seminar Hall",
            building="AB1",
            floor="Ground Floor",
            capacity=120,
            type="event_venue",
            has_projector=True,
            has_ac=True,
            has_audio=True,
            notes="Air-conditioned conference and guest lecture hall."
        ),
    ]
    for r in rooms:
        db.add(r)
    db.commit()

    # 3. Timetable Slots
    timetable = [
        # AB1 E-103B
        TimetableSlot(room_id="room-ab1-e103b", day="Monday", slot_id="slot4", start_time="10:45", end_time="11:35", code="22CSC553", course_name="Cloud Computing", faculty="Dr Kavitha P", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),
        TimetableSlot(room_id="room-ab1-e103b", day="Monday", slot_id="slot5", start_time="11:35", end_time="12:25", code="22CSC553", course_name="Cloud Computing", faculty="Dr Kavitha P", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),
        TimetableSlot(room_id="room-ab1-e103b", day="Wednesday", slot_id="slot4", start_time="10:45", end_time="11:35", code="22CSC553", course_name="Cloud Computing", faculty="Dr Kavitha P", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),
        TimetableSlot(room_id="room-ab1-e103b", day="Friday", slot_id="slot8", start_time="14:05", end_time="14:55", code="22CSC553", course_name="Cloud Computing", faculty="Dr Kavitha P", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),

        # AB1 E-104
        TimetableSlot(room_id="room-ab1-e104", day="Monday", slot_id="slot2", start_time="08:50", end_time="09:40", code="22CSC401", course_name="Deep Learning", faculty="Dr Thilaga M", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),
        TimetableSlot(room_id="room-ab1-e104", day="Monday", slot_id="slot3", start_time="09:40", end_time="10:30", code="22CSC404", course_name="Data Security", faculty="Dr Boovamithar Rakshit", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),
        TimetableSlot(room_id="room-ab1-e104", day="Wednesday", slot_id="slot2", start_time="08:50", end_time="09:40", code="22CSC401", course_name="Deep Learning", faculty="Dr Thilaga M", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),
        TimetableSlot(room_id="room-ab1-e104", day="Wednesday", slot_id="slot3", start_time="09:40", end_time="10:30", code="22CSC404", course_name="Data Security", faculty="Dr Boovamithar Rakshit", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),
        TimetableSlot(room_id="room-ab1-e104", day="Friday", slot_id="slot2", start_time="08:50", end_time="09:40", code="22CSC401", course_name="Deep Learning", faculty="Dr Thilaga M", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),

        # AB2-201
        TimetableSlot(room_id="room-ab2-201", day="Tuesday", slot_id="slot2", start_time="08:50", end_time="09:40", code="22CSC343", course_name="Business Analytics", faculty="Dr Subhraaj R", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),
        TimetableSlot(room_id="room-ab2-201", day="Thursday", slot_id="slot2", start_time="08:50", end_time="09:40", code="22CSC343", course_name="Business Analytics", faculty="Dr Subhraaj R", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),
    ]
    for ts in timetable:
        db.add(ts)
    db.commit()

    # 4. Facilities
    facilities = [
        Facility(
            id="fac-hpc",
            name="HPC GPU Cluster",
            type="compute",
            location="Centre for Computational Engineering, AB4",
            description="Shared GPU/CPU cluster with 8x NVIDIA A100 nodes for deep learning training and scientific simulation.",
            contact="hpc-support@cb.amrita.edu",
            induction_required=True,
            allocation_model="compute_time",
            image="🖥️",
            status="available",
            responsible_staff_id="user-labassist-1",
            responsible_staff_name="Mr Suresh Kumar"
        ),
        Facility(
            id="fac-3dprint",
            name="3D Rapid Prototyping Lab",
            type="equipment",
            location="Innovation Lab, AB1 Ground Floor",
            description="Industrial FDM and SLA resin 3D printers with high-precision slicing software.",
            contact="innovationlab@cb.amrita.edu",
            induction_required=True,
            allocation_model="time_slot",
            image="🖨️",
            status="available",
            responsible_staff_id="user-labassist-1",
            responsible_staff_name="Mr Suresh Kumar"
        ),
        Facility(
            id="fac-vr",
            name="VR / AR Immersive Lab",
            type="equipment",
            location="Innovation Lab, AB1 Ground Floor",
            description="Meta Quest 3 and HTC Vive Pro headsets with spatial tracking and development workstations.",
            contact="innovationlab@cb.amrita.edu",
            induction_required=True,
            allocation_model="time_slot",
            image="🥽",
            status="available",
            responsible_staff_id="user-labassist-1",
            responsible_staff_name="Mr Suresh Kumar"
        ),
        Facility(
            id="fac-electronics",
            name="Electronics Prototyping Bench",
            type="equipment",
            location="AB2 Basement Lab",
            description="Rigol digital oscilloscopes, SMD rework soldering stations, signal generators, Raspberry Pi & ESP32 developer kits.",
            contact="ece-lab@cb.amrita.edu",
            induction_required=False,
            allocation_model="time_slot",
            image="🔧",
            status="maintenance",
            maintenance_reason="Oscilloscope calibration in progress until tomorrow afternoon.",
            responsible_staff_id="user-labassist-1",
            responsible_staff_name="Mr Suresh Kumar"
        ),
    ]
    for f in facilities:
        db.add(f)
    db.commit()

    # 5. User Inductions
    inductions = [
        UserInduction(
            user_id="user-student-1",
            facility_id="fac-3dprint",
            inducted_by="Mr Suresh Kumar"
        ),
        UserInduction(
            user_id="user-classrep-1",
            facility_id="fac-3dprint",
            inducted_by="Mr Suresh Kumar"
        ),
        UserInduction(
            user_id="user-classrep-1",
            facility_id="fac-vr",
            inducted_by="Mr Suresh Kumar"
        ),
    ]
    for ind in inductions:
        db.add(ind)
    db.commit()

    # 6. Sample Timetable Change Request
    tt_req = TimetableChangeRequest(
        id="tt-req-001",
        course_code="22CSC401",
        course_name="Deep Learning",
        class_section="Int. M.Sc Data Science, VII B",
        requester_id="user-classrep-1",
        requester_name="Devika Nair",
        original_day="Friday",
        original_slot="slot2",
        original_room_id="room-ab1-e104",
        proposed_day="Thursday",
        proposed_slot="slot4",
        proposed_room_id="room-ab1-e104",
        proposed_date="2026-10-15",
        reason="Students participating in Inter-University Hackathon on Friday morning. Requesting reschedule to Thursday Slot 4.",
        status="pending",
        review_notes="Under review by Class Advisor Dr Devika and Course Faculty Dr Thilaga M."
    )
    db.add(tt_req)

    # 7. Sample Events
    events = [
        EventRequest(
            id="evt-001",
            name="GENESIS 2026 Annual Technology Hackathon",
            organizer="Department of CSE & ACM Student Chapter",
            organizer_id="user-faculty-1",
            venue_id="venue-audi",
            event_date="2026-10-20",
            start_slot="slot2",
            end_slot="slot10",
            expected_audience=350,
            level="university",
            is_academic=True,
            has_external_guests=True,
            priority_score=92,
            av_requirements="Dual 4K Projection, 4 wireless mics, live video streaming setup",
            purpose="Flagship 36-hour hackathon bringing inter-college teams together.",
            status="approved",
            admin_notes="Approved by Event Office. Audio technician assigned."
        ),
        EventRequest(
            id="evt-002",
            name="AI in Healthcare Research Colloquium",
            organizer="Dr Thilaga M",
            organizer_id="user-faculty-1",
            venue_id="venue-seminar-ab1",
            event_date="2026-10-22",
            start_slot="slot4",
            end_slot="slot6",
            expected_audience=110,
            level="department",
            is_academic=True,
            has_external_guests=False,
            priority_score=78,
            av_requirements="Projector and podium mic",
            purpose="Faculty symposium on medical imaging and clinical transformers.",
            status="pending",
            admin_notes="Awaiting final auditorium schedule confirmation."
        )
    ]
    for ev in events:
        db.add(ev)
    db.commit()

    # 8. Sample Lost & Found Items
    # A) Classroom-found item (Smart Auto-routed to Class Advisor Dr Devika)
    lost_item_1 = LostFoundItem(
        id="lf-001",
        report_type="found",
        title="Casio Scientific Calculator FX-991CW",
        category="electronics",
        description="Black non-programmable calculator found on the 2nd row desk near the window.",
        location_found="AB1 E-104 (1st Floor)",
        is_classroom=True,
        room_id="room-ab1-e104",
        found_date="2026-10-09",
        found_time="09:40",
        finder_id="user-student-1",
        finder_name="Aarav Menon",
        current_custody="class_advisor",
        storage_location="Class Advisor Office (Mathematics Dept, AB1 Room 214)",
        assigned_handler_id="user-classadvisor-1",
        assigned_handler_name="Dr Devika",
        routing_reason="Smart Matched: Timetable slot Monday Slot 2 (Deep Learning, Int. M.Sc Data Science VII B). Automatically routed to Class Advisor Dr Devika.",
        status="in_custody"
    )
    db.add(lost_item_1)
    db.commit()

    # Custody log for item 1
    db.add(CustodyLog(
        item_id="lf-001",
        actor_id="user-student-1",
        actor_name="Aarav Menon",
        action="reported",
        from_custodian="Finder",
        to_custodian="Class Advisor Dr Devika",
        notes="Finder handed over to Dr Devika after class."
    ))

    # B) Non-classroom found item (Smart Auto-routed to Student Welfare Ms Priya Balan)
    lost_item_2 = LostFoundItem(
        id="lf-002",
        report_type="found",
        title="Navy Blue Campus Backpack (Wildcraft)",
        category="bags",
        description="Wildcraft navy blue backpack with a water bottle and spiral notebooks inside.",
        location_found="AB2 Central Lawn benches",
        is_classroom=False,
        room_id=None,
        found_date="2026-10-10",
        found_time="13:20",
        finder_id="user-student-1",
        finder_name="Aarav Menon",
        current_custody="student_welfare",
        storage_location="Student Welfare Lost Property Locker #4",
        assigned_handler_id="user-welfare-1",
        assigned_handler_name="Ms Priya Balan",
        routing_reason="Outdoor / Common Campus Location. Automatically routed to Student Welfare Office.",
        status="claim_pending"
    )
    db.add(lost_item_2)
    db.commit()

    # Claim for item 2
    claim_2 = ItemClaim(
        id="claim-001",
        item_id="lf-002",
        claimant_id="user-classrep-1",
        claimant_name="Devika Nair",
        proof_description="Contains Data Science notebooks with student name 'Devika N' on page 1 and a silver steel water bottle.",
        contact_phone="+91 98765 43210",
        status="pending",
        handler_notes="Claim submitted; awaiting in-person ID verification."
    )
    db.add(claim_2)

    db.add(CustodyLog(
        item_id="lf-002",
        actor_id="user-welfare-1",
        actor_name="Ms Priya Balan",
        action="claim_filed",
        from_custodian="Student Welfare",
        to_custodian="Student Welfare",
        notes="Claim filed by Devika Nair; verification pending."
    ))

    # C) Returned item example
    lost_item_3 = LostFoundItem(
        id="lf-003",
        report_type="found",
        title="Hostel Room Key with Brass Ring",
        category="keys",
        description="Key labeled 'HB2-314' on a circular brass ring.",
        location_found="Library Ground Floor Reading Hall",
        is_classroom=False,
        room_id=None,
        found_date="2026-10-08",
        found_time="16:00",
        finder_id="user-student-1",
        finder_name="Aarav Menon",
        current_custody="student_welfare",
        storage_location="Student Welfare Desk",
        assigned_handler_id="user-welfare-1",
        assigned_handler_name="Ms Priya Balan",
        routing_reason="Common Facility: Routed to Student Welfare.",
        status="returned",
        return_date="2026-10-09",
        handover_notes="Returned to student after verification of hostel room allotment card."
    )
    db.add(lost_item_3)

    # 9. Sample Notifications
    notifications = [
        Notification(
            recipient_id="user-classrep-1",
            title="Classroom Booking Confirmed",
            message="Your reservation for AB1-E104 on Friday Slot 8 has been confirmed.",
            category="booking",
            link="/classrooms"
        ),
        Notification(
            recipient_id="user-classadvisor-1",
            title="Action Required: Lost Item Auto-Routed",
            message="A calculator found in AB1-E104 during your class slot was automatically routed to your custody.",
            category="lost_found",
            link="/lost-found"
        ),
        Notification(
            recipient_id="user-classadvisor-1",
            title="Timetable Change Request Pending",
            message="Class Rep Devika Nair requested to move Deep Learning from Friday Slot 2 to Thursday Slot 4.",
            category="timetable",
            link="/academic-scheduling"
        ),
        Notification(
            recipient_id="user-welfare-1",
            title="New Claim on Wildcraft Backpack",
            message="Devika Nair filed a claim for the navy blue backpack in your custody.",
            category="lost_found",
            link="/lost-found"
        ),
    ]
    for n in notifications:
        db.add(n)

    # 10. Sample Audit Log
    audits = [
        AuditLog(
            actor_id="user-sysadmin-1",
            actor_name="Prof. K. R. Ramakrishnan",
            actor_role="sys_admin",
            action="SYSTEM_INIT",
            entity_type="SYSTEM",
            entity_id="ROOT",
            details="CampusConnect production pilot initialized with synthetic timetable and facility records."
        ),
        AuditLog(
            actor_id="user-resourceadmin-1",
            actor_name="Mr Ramesh Iyer",
            actor_role="resource_admin",
            action="EVENT_APPROVE",
            entity_type="EVENT",
            entity_id="evt-001",
            details="Approved GENESIS 2026 Hackathon in Amriteshwari Auditorium."
        ),
    ]
    for a in audits:
        db.add(a)

    db.commit()
    if should_close:
        db.close()
    print("Seed complete! All 9 personas, rooms, timetables, facilities, and lost-found items populated.")

if __name__ == "__main__":
    seed_database()
