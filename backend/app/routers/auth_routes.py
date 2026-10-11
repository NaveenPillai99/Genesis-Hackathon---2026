from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, TokenResponse, UserResponse, PeoplePriorityResponse

from app.auth import verify_password, create_access_token, get_current_user, record_audit, get_user_permissions

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == creds.email).first()
    if not user or not verify_password(creds.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    perms = sorted(list(get_user_permissions(user, db)))
    token = create_access_token({"sub": user.id, "role": user.role, "perms": perms})
    record_audit(db, user.id, user.name, user.role, "LOGIN", "USER", user.id, "Logged in via password")
    return TokenResponse(access_token=token, user=user, permissions=perms)

@router.get("/demo-users", response_model=list[UserResponse])
def get_demo_users(db: Session = Depends(get_db)):
    """Returns the 9 demonstration accounts for the pitch / evaluation switcher."""
    return db.query(User).all()

@router.post("/quick-login/{user_id}", response_model=TokenResponse)
def quick_login(user_id: str, db: Session = Depends(get_db)):
    """Allows one-click demo role switching during evaluation."""
    legacy_map = {
        "u-student-1": "user-student-1",
        "u-student-2": "user-student-1",
        "u-rep-1": "user-classrep-1",
        "u-rep-2": "user-classrep-1",
        "u-faculty-1": "user-faculty-1",
        "u-faculty-2": "user-classadvisor-1",
        "u-lab-1": "user-labassist-1",
        "u-lab-2": "user-labadmin-1",
        "u-admin-1": "user-resourceadmin-1",
    }
    resolved_id = legacy_map.get(user_id, user_id)
    user = db.query(User).filter(User.id == resolved_id).first()
    if not user:
        # Fallback to role search if user_id is a role name
        user = db.query(User).filter(User.role == resolved_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Demo account not found")
    perms = sorted(list(get_user_permissions(user, db)))
    token = create_access_token({"sub": user.id, "role": user.role, "perms": perms})
    record_audit(db, user.id, user.name, user.role, "QUICK_LOGIN", "USER", user.id, f"Switched to {user.role}")
    return TokenResponse(access_token=token, user=user, permissions=perms)

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/profile")
def get_full_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models import RoomBooking, UserInduction, Facility, TimetableChangeRequest, LostFoundItem
    from app.config import (
        ROLE_CAMPUS_DIRECTOR, ROLE_DEAN, ROLE_HOD,
        ROLE_STUDENT, ROLE_CLASS_REP, ROLE_CLASS_ADVISOR, ROLE_FACULTY,
        ROLE_LAB_ASSISTANT, ROLE_LAB_ADMIN, ROLE_RESOURCE_ADMIN,
        ROLE_LOST_PROPERTY_HANDLER, ROLE_SYS_ADMIN
    )

    role_labels = {
        ROLE_CAMPUS_DIRECTOR: "Campus Director",
        ROLE_DEAN: "Dean of School",
        ROLE_HOD: "Head of Department (HOD)",
        ROLE_STUDENT: "Student",
        ROLE_CLASS_REP: "Class Representative",
        ROLE_CLASS_ADVISOR: "Class Advisor",
        ROLE_FACULTY: "Faculty Member",
        ROLE_LAB_ASSISTANT: "Lab Assistant",
        ROLE_LAB_ADMIN: "Lab Administrator",
        ROLE_RESOURCE_ADMIN: "Central Resource Admin",
        ROLE_LOST_PROPERTY_HANDLER: "Student Welfare (Lost Property)",
        ROLE_SYS_ADMIN: "System Administrator",
    }

    role_permissions = {
        ROLE_CAMPUS_DIRECTOR: [
            "Final Approval Authority for Campus Resource Bookings",
            "Institution-Wide Timetable & Venue Visibility",
            "Algorithmic Priority Policy Management & Override",
            "Campus Resource Governance & Audits"
        ],
        ROLE_DEAN: [
            "School-Wide Timetable & Faculty Visibility",
            "Review & Recommend Department Event Proposals",
            "Departmental Space & Resource Oversight"
        ],
        ROLE_HOD: [
            "Department-Wide Class & Batch Timetable Oversight",
            "Department Faculty Teaching Schedule Access",
            "Department Event Endorsement & Recommendations"
        ],
        ROLE_STUDENT: [
            "View Classroom Availability", "View Approved Events",
            "Book Inducted Labs", "Submit Lost/Found Reports", "Track Personal Claims"
        ],
        ROLE_CLASS_REP: [
            "Book Free Classrooms", "Propose Timetable Prepone/Postpone",
            "Submit Additional Sessions", "Track Class Requests"
        ],
        ROLE_CLASS_ADVISOR: [
            "Approve/Reject Timetable Changes", "Manage Assigned Section",
            "Receive Auto-Routed Classroom Lost Items", "Audit Class Conflicts"
        ],
        ROLE_FACULTY: [
            "Manage Teaching Timetable", "Submit Event Venue Requests",
            "Review Timetable Proposals", "Approve Student HPC Jobs"
        ],
        ROLE_LAB_ASSISTANT: [
            "Toggle Equipment Maintenance", "Record Diagnostic Faults",
            "Manage Lab Slot Bookings", "Update Equipment Custody"
        ],
        ROLE_LAB_ADMIN: [
            "Configure Lab Policies", "Grant Safety Inductions",
            "Manage Lab Assistants", "Review Lab Utilization"
        ],
        ROLE_RESOURCE_ADMIN: [
            "Approve Event Venues with Priority Scoring", "Resolve Exclusive Conflicts",
            "Manage Resource Catalogue", "View Institutional Utilization"
        ],
        ROLE_LOST_PROPERTY_HANDLER: [
            "Receive Campus Found Property", "Verify Ownership Claims",
            "Record Return Handovers", "Maintain Custody Audit Logs"
        ],
        ROLE_SYS_ADMIN: [
            "Full System Configuration", "Inspect Append-Only Audit Trail",
            "E-Governance (AUMS) Gateway Sync", "User Role Governance"
        ],
    }

    # Query stats
    active_bks = db.query(RoomBooking).filter(
        RoomBooking.booked_by == current_user.id,
        RoomBooking.status.in_(["booked", "checked_in"])
    ).count()

    inductions = db.query(Facility.name).join(
        UserInduction, UserInduction.facility_id == Facility.id
    ).filter(UserInduction.user_id == current_user.id).all()
    inducted_fac_names = [f[0] for f in inductions]

    pending_reqs = db.query(TimetableChangeRequest).filter(
        TimetableChangeRequest.status == "pending"
    ).count()

    custody_items = db.query(LostFoundItem).filter(
        (LostFoundItem.assigned_handler_id == current_user.id) |
        (LostFoundItem.current_custody == current_user.role)
    ).count()

    from app.priority_service import calculate_people_priority
    prio_data = calculate_people_priority(current_user.role)
    is_staff = current_user.role in [ROLE_SYS_ADMIN, ROLE_RESOURCE_ADMIN, ROLE_FACULTY, ROLE_LAB_ADMIN]

    return {
        "user": current_user,
        "role_label": role_labels.get(current_user.role, current_user.role),
        "permissions": role_permissions.get(current_user.role, ["Standard Access"]),
        "active_bookings_count": active_bks,
        "inducted_facilities": inducted_fac_names,
        "pending_timetable_requests_count": pending_reqs,
        "custody_items_count": custody_items,
        "egovernance_verified": True,
        "last_login": "Just now",
        "priority": prio_data["priority"],
        "priority_label": prio_data["priority_label"],
        "raw_score": prio_data["raw_score"] if is_staff else None,
        "sigmoid_confidence": prio_data["sigmoid_confidence"] if is_staff else None,
    }

@router.get("/priority", response_model=PeoplePriorityResponse)
def get_people_priority(
    user_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns role-based Sigmoid priority score for a person.
    Evaluates strictly from the verified backend role (never frontend-submitted).
    Only administrators can query priority for other user IDs.
    """
    from app.priority_service import calculate_people_priority
    from app.config import ROLE_SYS_ADMIN, ROLE_RESOURCE_ADMIN

    target_user = current_user
    if user_id and user_id != current_user.id:
        if current_user.role not in [ROLE_SYS_ADMIN, ROLE_RESOURCE_ADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Account lacks administrative permission to inspect other users' priority."
            )
        target = db.query(User).filter(User.id == user_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="Requested user not found.")
        target_user = target

    res = calculate_people_priority(target_user.role)
    return {
        "user_id": target_user.id,
        "user_name": target_user.name,
        "role": target_user.role,
        "priority": res["priority"],
        "priority_label": res["priority_label"],
        "raw_score": res["raw_score"],
        "sigmoid_confidence": res["sigmoid_confidence"],
        "cutoff": res["cutoff"],
        "steepness": res["steepness"],
    }

@router.put("/profile", response_model=UserResponse)
def update_profile(
    updates: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Security: Users cannot modify their own roles or weights to manipulate priority
    if "name" in updates and updates["name"]:
        current_user.name = str(updates["name"]).strip()
    if "department" in updates:
        current_user.department = updates["department"]
    if "class_section" in updates:
        current_user.class_section = updates["class_section"]
    db.commit()
    db.refresh(current_user)
    record_audit(db, current_user.id, current_user.name, current_user.role, "PROFILE_UPDATED", "USER", current_user.id, "User updated profile info")
    return current_user

