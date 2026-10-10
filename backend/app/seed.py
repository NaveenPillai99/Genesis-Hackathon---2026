from datetime import datetime
from app.database import SessionLocal, Base, engine
from app.models import (
    User, Role, Permission, RolePermission, ResourceAssignment,
    Room, TimetableSlot, RoomBooking, TimetableChangeRequest,
    EventRequest, Facility, FacilityBooking, HPCAllocation, HPCNode, HPCJob, HPCIncident,
    UserInduction, LostFoundItem, ItemClaim, CustodyLog, Notification, AuditLog
)
from app.auth import hash_password, ROLE_PERMISSIONS

def seed_database(db: SessionLocal = None):
    Base.metadata.create_all(bind=engine)
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    print("Seeding synthetic CampusConnect data with strict RBAC & HPC...")

    # 1. Seed Roles & Permissions
    roles_data = [
        ("student", "Student", "Access free study spaces, view timetable, search campus resources, file claims"),
        ("class_rep", "Class Representative", "Submit class reschedule proposals, book revision rooms within cap"),
        ("class_advisor", "Class Advisor", "Authorize reschedule proposals for assigned classes, classroom custody"),
        ("faculty", "General Faculty", "Teaching schedule, seminar hall requests, approve compute research"),
        ("hpc_faculty", "HPC Faculty / HPC Manager", "Dedicated HPC cluster operations, nodes, allocations, maintenance"),
        ("lab_assistant", "Lab Assistant", "Manage assigned physical equipment, toggle maintenance, certify inductions"),
        ("lab_admin", "Lab Administrator", "Oversight of laboratory fleets, assistants, utilization and policies"),
        ("resource_admin", "Central Resource Admin", "Campus resource catalogue, venue allocation, conflict resolution, audit"),
        ("lost_property_handler", "Student Welfare (Lost Property)", "Campus-wide physical custody, claims verification, secure returns"),
        ("sys_admin", "System Administrator", "User management, RBAC matrix, system health, security audit, AUMS sync"),
    ]

    for r_id, r_name, r_desc in roles_data:
        if not db.query(Role).filter(Role.id == r_id).first():
            db.add(Role(id=r_id, name=r_name, description=r_desc))
    db.commit()

    # Permissions list
    all_permissions = set()
    for role_id, perms in ROLE_PERMISSIONS.items():
        all_permissions.update(perms)

    for p_id in all_permissions:
        cat = p_id.split(".")[0]
        if not db.query(Permission).filter(Permission.id == p_id).first():
            db.add(Permission(id=p_id, name=p_id, category=cat, description=f"Grants {p_id} authority"))
    db.commit()

    # Map RolePermissions
    for r_id, perms in ROLE_PERMISSIONS.items():
        for p_id in perms:
            exists = db.query(RolePermission).filter(
                RolePermission.role_id == r_id,
                RolePermission.permission_id == p_id
            ).first()
            if not exists:
                db.add(RolePermission(role_id=r_id, permission_id=p_id))
    db.commit()

    # 2. Users (All 10 Personas)
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
            id="user-hpcfaculty-1",
            name="Dr Radhika N",
            email="radhika.hpc@cb.amrita.edu",
            role="hpc_faculty",
            department="Centre for Computational Engineering",
            class_section=None,
            assigned_facility_id="fac-hpc",
            password_hash=pwd
        ),
        User(
            id="user-labassist-1",
            name="Mr Suresh Kumar",
            email="suresh.lab@cb.amrita.edu",
            role="lab_assistant",
            department="HPC & Innovation Lab",
            class_section=None,
            assigned_facility_id="fac-3dprint",
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
        existing = db.query(User).filter(User.id == u.id).first()
        if not existing:
            db.add(u)
        else:
            existing.role = u.role
            existing.class_section = u.class_section
            existing.assigned_facility_id = u.assigned_facility_id
    db.commit()

    # 3. Resource Assignments (Resource-level scoping)
    scopes = [
        ("user-classadvisor-1", "class_section", "Int. M.Sc Data Science, VII B"),
        ("user-classrep-1", "class_section", "Int. M.Sc Data Science, VII B"),
        ("user-labassist-1", "facility", "fac-3dprint"),
        ("user-labassist-1", "facility", "fac-vr"),
        ("user-hpcfaculty-1", "facility", "fac-hpc"),
    ]
    for uid, stype, sid in scopes:
        ex = db.query(ResourceAssignment).filter(
            ResourceAssignment.user_id == uid,
            ResourceAssignment.scope_type == stype,
            ResourceAssignment.scope_id == sid
        ).first()
        if not ex:
            db.add(ResourceAssignment(user_id=uid, scope_type=stype, scope_id=sid))
    db.commit()

    # 4. HPC Nodes (Dedicated cluster nodes with telemetry)
    hpc_nodes = [
        HPCNode(
            id="node-gpu-01",
            name="CCE-DGX-A100-01",
            cluster_id="cce-hpc-cluster",
            status="busy",
            cpu_cores=64,
            memory_gb=256,
            gpu_count=4,
            gpu_model="NVIDIA A100 80GB",
            cpu_utilization_pct=78.2,
            memory_utilization_pct=64.0,
            gpu_utilization_pct=92.5,
            active_jobs=2,
            queued_jobs=1,
            total_node_hours_served=2450.0,
            notes="Primary deep learning research node"
        ),
        HPCNode(
            id="node-gpu-02",
            name="CCE-DGX-A100-02",
            cluster_id="cce-hpc-cluster",
            status="idle",
            cpu_cores=64,
            memory_gb=256,
            gpu_count=4,
            gpu_model="NVIDIA A100 80GB",
            cpu_utilization_pct=14.5,
            memory_utilization_pct=22.0,
            gpu_utilization_pct=5.0,
            active_jobs=0,
            queued_jobs=0,
            total_node_hours_served=1890.0,
            notes="Available for student thesis jobs"
        ),
        HPCNode(
            id="node-cpu-01",
            name="CCE-EPYC-Compute-01",
            cluster_id="cce-hpc-cluster",
            status="busy",
            cpu_cores=128,
            memory_gb=512,
            gpu_count=0,
            gpu_model="None",
            cpu_utilization_pct=88.4,
            memory_utilization_pct=72.0,
            gpu_utilization_pct=0.0,
            active_jobs=4,
            queued_jobs=2,
            total_node_hours_served=5600.0,
            notes="Monte Carlo simulation partition"
        ),
        HPCNode(
            id="node-cpu-02",
            name="CCE-EPYC-Compute-02",
            cluster_id="cce-hpc-cluster",
            status="maintenance",
            cpu_cores=128,
            memory_gb=512,
            gpu_count=0,
            gpu_model="None",
            cpu_utilization_pct=0.0,
            memory_utilization_pct=0.0,
            gpu_utilization_pct=0.0,
            active_jobs=0,
            queued_jobs=0,
            total_node_hours_served=4100.0,
            notes="Scheduled ECC RAM replacement by vendor support"
        ),
    ]
    for n in hpc_nodes:
        if not db.query(HPCNode).filter(HPCNode.id == n.id).first():
            db.add(n)
    db.commit()

    # 5. HPC Jobs
    hpc_jobs = [
        HPCJob(
            id="job-01",
            allocation_id="hpc-001",
            user_id="user-student-1",
            user_name="Aarav Menon",
            job_name="ResNet-50 Distributed Pretraining",
            node_id="node-gpu-01",
            status="running",
            requested_nodes=1,
            gpu_requested=2,
            cpu_hours_used=14.2
        ),
        HPCJob(
            id="job-02",
            allocation_id="hpc-002",
            user_id="user-faculty-1",
            user_name="Dr Thilaga M",
            job_name="Transformer Architecture Search",
            node_id="node-gpu-01",
            status="running",
            requested_nodes=1,
            gpu_requested=2,
            cpu_hours_used=32.0
        ),
    ]
    for j in hpc_jobs:
        if not db.query(HPCJob).filter(HPCJob.id == j.id).first():
            db.add(j)
    db.commit()

    # 6. HPC Incident
    if not db.query(HPCIncident).first():
        db.add(HPCIncident(
            id="inc-01",
            node_id="node-cpu-02",
            incident_type="scheduled_maintenance",
            severity="warning",
            reported_by="Dr Radhika N",
            description="DIMM slot 4 ECC multi-bit error detected during routine diagnostic run. Replaced memory module pending burn-in validation.",
            status="open"
        ))
        db.commit()

    # 7. Rooms
    rooms_data = [
        Room(id="AB1-E103B", name="AB1 E103B", building="AB1", floor="E1", capacity=65, type="classroom", has_projector=True, has_ac=False, has_audio=False, notes="Home room for Int. M.Sc Data Science VII B"),
        Room(id="room-ab1-e103b", name="AB1 E103B", building="AB1", floor="E1", capacity=65, type="classroom", has_projector=True, has_ac=False, has_audio=False, notes="Home room for Int. M.Sc Data Science VII B"),
        Room(id="AB1-E104", name="AB1 E104", building="AB1", floor="E1", capacity=70, type="classroom", has_projector=True, has_ac=True, has_audio=True),
        Room(id="room-ab1-e104", name="AB1 E104", building="AB1", floor="E1", capacity=70, type="classroom", has_projector=True, has_ac=True, has_audio=True),
        Room(id="AB1-W102", name="AB1 W102", building="AB1", floor="W1", capacity=40, type="classroom", has_projector=True, has_ac=False, has_audio=False, notes="Lab-friendly layout"),
        Room(id="AB2-201", name="AB2 201", building="AB2", floor="2", capacity=60, type="classroom", has_projector=True, has_ac=False, has_audio=False),
        Room(id="room-ab2-202", name="AB2 202", building="AB2", floor="2", capacity=50, type="classroom", has_projector=True, has_ac=False, has_audio=False),
        Room(id="AB2-305", name="AB2 305", building="AB2", floor="3", capacity=55, type="classroom", has_projector=True, has_ac=False, has_audio=False),
        Room(id="VENUE-AUDITORIUM", name="Amriteshwari Auditorium", building="Admin Block", floor="1", capacity=1200, type="event_venue", has_projector=True, has_ac=True, has_audio=True, notes="University flagship hall"),
        Room(id="VENUE-SEMINAR-AB1", name="Seminar Hall, AB1", building="AB1", floor="Ground", capacity=150, type="event_venue", has_projector=True, has_ac=True, has_audio=True),
        Room(id="VENUE-AMPHITHEATRE", name="Campus Open Amphitheatre", building="Central Quad", floor="Outdoor", capacity=800, type="event_venue", has_projector=False, has_ac=False, has_audio=True),
    ]
    for r in rooms_data:
        if not db.query(Room).filter(Room.id == r.id).first():
            db.add(r)
    db.commit()

    # 8. Timetable Slots
    slots_data = [
        TimetableSlot(room_id="AB1-E103B", day="Monday", slot_id="slot4", start_time="10:45", end_time="11:35", code="22CSC401", course_name="Deep Learning", faculty="Dr Thilaga M", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),
        TimetableSlot(room_id="room-ab1-e103b", day="Monday", slot_id="slot4", start_time="10:45", end_time="11:35", code="22CSC401", course_name="Deep Learning", faculty="Dr Thilaga M", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),
        TimetableSlot(room_id="room-ab1-e103b", day="Friday", slot_id="slot8", start_time="14:05", end_time="14:55", code="22CSC553", course_name="Cloud Computing", faculty="Dr Kavitha P", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),
        TimetableSlot(room_id="AB1-E103B", day="Monday", slot_id="slot5", start_time="11:35", end_time="12:25", code="22CSC343", course_name="Business Analytics", faculty="Dr Subhraaj R", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),
        TimetableSlot(room_id="AB1-E103B", day="Monday", slot_id="slot6", start_time="12:25", end_time="13:15", code="22CSC404", course_name="Data Security", faculty="Dr Boovamithar", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),
        TimetableSlot(room_id="AB1-E103B", day="Tuesday", slot_id="slot4", start_time="10:45", end_time="11:35", code="22CSC404", course_name="Data Security", faculty="Dr Boovamithar", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),
        TimetableSlot(room_id="AB1-W102", day="Tuesday", slot_id="slot5", start_time="11:35", end_time="12:25", code="22CSC401L", course_name="Open Lab-I", faculty="Ms Kavipriya", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),
        TimetableSlot(room_id="AB1-E103B", day="Wednesday", slot_id="slot4", start_time="10:45", end_time="11:35", code="22CSC401", course_name="Deep Learning", faculty="Dr Thilaga M", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),
        TimetableSlot(room_id="AB1-E103B", day="Wednesday", slot_id="slot5", start_time="11:35", end_time="12:25", code="22MAT401", course_name="Probabilistic Graphical Models", faculty="Dr Kalaivani", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),
        TimetableSlot(room_id="AB1-E103B", day="Thursday", slot_id="slot4", start_time="10:45", end_time="11:35", code="22MAT401", course_name="Probabilistic Graphical Models", faculty="Dr Kalaivani", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),
        TimetableSlot(room_id="AB1-E103B", day="Friday", slot_id="slot4", start_time="10:45", end_time="11:35", code="22CSC403", course_name="Reinforcement Learning", faculty="Dr Jeyaramakrishnan", class_section="Int. M.Sc Data Science, VII B", advisor="Dr Devika"),
        TimetableSlot(room_id="AB1-E104", day="Monday", slot_id="slot2", start_time="08:50", end_time="09:40", code="22CSC401", course_name="Deep Learning", faculty="Dr Thilaga M", class_section="CSE, VII A", advisor="Dr Devika"),
        TimetableSlot(room_id="room-ab1-e104", day="Monday", slot_id="slot2", start_time="08:50", end_time="09:40", code="22CSC401", course_name="Deep Learning", faculty="Dr Thilaga M", class_section="CSE, VII A", advisor="Dr Devika"),
        TimetableSlot(room_id="AB1-E104", day="Monday", slot_id="slot3", start_time="09:40", end_time="10:30", code="22CSC404", course_name="Data Security", faculty="Dr Boovamithar", class_section="CSE, VII A", advisor="Dr Devika"),
        TimetableSlot(room_id="room-ab1-e104", day="Monday", slot_id="slot3", start_time="09:40", end_time="10:30", code="22CSC404", course_name="Data Security", faculty="Dr Boovamithar", class_section="CSE, VII A", advisor="Dr Devika"),
    ]
    for s in slots_data:
        ex = db.query(TimetableSlot).filter(
            TimetableSlot.room_id == s.room_id,
            TimetableSlot.day == s.day,
            TimetableSlot.slot_id == s.slot_id
        ).first()
        if not ex:
            db.add(s)
    db.commit()

    # 9. Facilities
    facilities_data = [
        Facility(
            id="fac-3dprint",
            name="3D Rapid Prototyping Lab",
            type="equipment",
            location="Innovation Lab, AB1 Ground Floor",
            description="Dual-extrusion FDM & SLA resin printers for rapid physical prototyping.",
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
            name="VR / AR Simulation Suite",
            type="equipment",
            location="Innovation Lab, AB1 Ground Floor",
            description="Meta Quest 3 and HTC Vive Pro 2 dev kits for spatial computing research.",
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
            name="Electronics Prototyping Workbench",
            type="equipment",
            location="AB2 Basement, Room B04",
            description="Digital storage oscilloscopes, SMD rework stations, logic analyzers.",
            contact="ece-lab@cb.amrita.edu",
            induction_required=False,
            allocation_model="time_slot",
            image="🔧",
            status="available",
            responsible_staff_id="user-labadmin-1",
            responsible_staff_name="Dr Anand Shenoy"
        ),
        Facility(
            id="fac-hpc",
            name="High Performance Compute Cluster (CCE)",
            type="compute",
            location="Centre for Computational Engineering, AB4 Floor 3",
            description="Shared GPU/CPU supercomputing cluster with 8x NVIDIA A100 nodes for deep learning.",
            contact="hpc-support@cb.amrita.edu",
            induction_required=True,
            allocation_model="compute_time",
            image="🖥️",
            status="available",
            responsible_staff_id="user-hpcfaculty-1",
            responsible_staff_name="Dr Radhika N"
        ),
    ]
    for f in facilities_data:
        ex = db.query(Facility).filter(Facility.id == f.id).first()
        if not ex:
            db.add(f)
        else:
            ex.responsible_staff_id = f.responsible_staff_id
    db.commit()

    # 10. Sample Timetable Change Request
    if not db.query(TimetableChangeRequest).first():
        db.add(TimetableChangeRequest(
            id="req-001",
            course_code="22CSC401",
            course_name="Deep Learning",
            class_section="Int. M.Sc Data Science, VII B",
            requester_id="user-classrep-1",
            requester_name="Devika Nair",
            original_day="Monday",
            original_slot="slot4",
            original_room_id="AB1-E103B",
            proposed_day="Tuesday",
            proposed_slot="slot6",
            proposed_room_id="AB1-E103B",
            proposed_date="2026-10-13",
            reason="Faculty attending academic symposium on Monday morning; rescheduled with section agreement.",
            status="pending"
        ))
        db.commit()

    # 11. Sample Events
    if not db.query(EventRequest).first():
        db.add(EventRequest(
            id="evt-001",
            name="GENESIS 2026 Hackathon & Tech Summit",
            organizer="Campus Innovation & Technical Council",
            organizer_id="user-faculty-1",
            venue_id="VENUE-AUDITORIUM",
            event_date="2026-10-15",
            start_slot="slot2",
            end_slot="slot10",
            expected_audience=800,
            level="university",
            is_academic=True,
            has_external_guests=True,
            priority_score=95,
            av_requirements="Projector, Stage Audio, 4 Cordless Mics, Live Stream Deck",
            purpose="Flagship annual 36-hour national university hackathon.",
            status="approved"
        ))
        db.commit()

    # 12. Sample Lost and Found
    if not db.query(LostFoundItem).first():
        db.add(LostFoundItem(
            id="lf-001",
            report_type="found",
            title="Casio FX-991CW Scientific Calculator",
            category="electronics",
            description="Black scientific calculator with green engraved sticker 'VII B DS' on the casing.",
            location_found="Classroom AB1-E104, Desk Row 3",
            is_classroom=True,
            room_id="AB1-E104",
            found_date="2026-10-10",
            found_time="10:35",
            finder_id="user-student-1",
            finder_name="Aarav Menon",
            current_custody="class_advisor",
            storage_location="Desk of Class Advisor Dr Devika (AB1-204)",
            assigned_handler_id="user-classadvisor-1",
            assigned_handler_name="Dr Devika",
            routing_reason="Classroom Slot Match: Automatically routed to Class Advisor Dr Devika.",
            status="in_custody"
        ))
        db.commit()

    # 13. Audit Log
    if not db.query(AuditLog).first():
        db.add(AuditLog(
            actor_id="user-sysadmin-1",
            actor_name="Prof. K. R. Ramakrishnan",
            actor_role="sys_admin",
            action="SYSTEM_INIT",
            entity_type="SYSTEM",
            entity_id="ROOT",
            details="CampusConnect production pilot initialized with strict RBAC, resource scoping, and HPC operations."
        ))
        db.commit()

    if should_close:
        db.close()
    print("Seed complete! 10 personas, roles, permissions, scopes, and HPC telemetry populated.")

if __name__ == "__main__":
    seed_database()
