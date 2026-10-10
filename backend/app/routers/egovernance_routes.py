from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.auth import get_current_user
from app.models import User
from app.config import ROLE_SYS_ADMIN

router = APIRouter(prefix="/egovernance", tags=["University E-Governance Adapter"])

class SyncTriggerResponse(BaseModel):
    status: str
    synced_records: int
    source_identity_provider: str
    message: str

@router.get("/spec")
def get_egovernance_integration_spec():
    """
    Returns the technical specification and interface contract for the upcoming
    official University E-Governance and ERP integration (AUMS / MyAmrita).
    """
    return {
        "status": "MOCK_INTEGRATION_MODE",
        "description": "Integration adapter prepared for Amrita University E-Governance (AUMS) & MyAmrita SSO.",
        "identity_provider": {
            "protocol": "OpenID Connect (OIDC) / SAML 2.0",
            "issuer": "https://auth.amrita.edu/realms/campus",
            "token_endpoint": "https://auth.amrita.edu/realms/campus/protocol/openid-connect/token",
            "userinfo_endpoint": "https://auth.amrita.edu/realms/campus/protocol/openid-connect/userinfo",
        },
        "role_mappings": {
            "STUDENT_UG": "student",
            "STUDENT_PG": "student",
            "CLASS_REP_ELECTED": "class_rep",
            "CLASS_ADVISOR_ASSIGNED": "class_advisor",
            "FACULTY_TEACHING": "faculty",
            "TECHNICAL_STAFF_LAB": "lab_assistant",
            "LAB_INCHARGE_CHAIR": "lab_admin",
            "ESTATE_SPACE_ADMIN": "resource_admin",
            "STUDENT_WELFARE_OFFICER": "lost_property_handler",
            "ICT_SUPER_ADMIN": "sys_admin",
        },
        "approved_data_fields": [
            "campus_roll_no", "full_name", "institutional_email",
            "department_code", "batch_year", "section_code", "assigned_advisor_id"
        ],
        "sync_frequency": "Nightly delta sync (cron 02:00 IST) + On-demand webhook on class rep designation",
        "compliance": "Designed to adhere to India Digital Personal Data Protection (DPDP) Act, 2023 with localized storage and role-scoped data views."
    }

@router.post("/simulate-sync", response_model=SyncTriggerResponse)
def simulate_sync(current_user: User = Depends(get_current_user)):
    """Simulates a mock sync run with synthetic university records."""
    return SyncTriggerResponse(
        status="SUCCESS",
        synced_records=42,
        source_identity_provider="Amrita AUMS Mock Gateway v2.4",
        message="Simulated synchronization succeeded: 9 demo accounts, 5 department batches, and 2 active timetables validated against synthetic roster."
    )
