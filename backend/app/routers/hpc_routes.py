from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, HPCNode, HPCJob, HPCIncident, HPCAllocation
from app.schemas import (
    HPCOverviewResponse,
    HPCNodeResponse,
    HPCNodeStatusUpdate,
    HPCJobResponse,
    HPCIncidentCreate,
    HPCIncidentResponse,
    HPCResponse,
    HPCCreate,
)
from app.auth import (
    get_current_user,
    require_permission,
    get_user_permissions,
    record_audit,
    send_notification,
)

router = APIRouter(prefix="/hpc", tags=["HPC Operations"])

@router.get("/overview", response_model=HPCOverviewResponse)
def get_hpc_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    nodes = db.query(HPCNode).all()
    total_nodes = len(nodes)
    healthy_nodes = sum(1 for n in nodes if n.status == "healthy")
    busy_nodes = sum(1 for n in nodes if n.status == "busy")
    idle_nodes = sum(1 for n in nodes if n.status == "idle")
    offline_nodes = sum(1 for n in nodes if n.status == "offline")
    maintenance_nodes = sum(1 for n in nodes if n.status == "maintenance")

    active_jobs = db.query(HPCJob).filter(HPCJob.status == "running").count()
    queued_jobs = db.query(HPCJob).filter(HPCJob.status == "queued").count()
    pending_allocs = db.query(HPCAllocation).filter(HPCAllocation.status == "pending").count()

    avg_cpu = round(sum(n.cpu_utilization_pct for n in nodes) / total_nodes, 1) if total_nodes else 0.0
    avg_gpu = round(sum(n.gpu_utilization_pct for n in nodes) / total_nodes, 1) if total_nodes else 0.0
    available_cap = round((idle_nodes / total_nodes) * 100.0, 1) if total_nodes else 0.0

    return HPCOverviewResponse(
        total_nodes=total_nodes,
        healthy_nodes=healthy_nodes,
        busy_nodes=busy_nodes,
        idle_nodes=idle_nodes,
        offline_nodes=offline_nodes,
        maintenance_nodes=maintenance_nodes,
        available_capacity_pct=available_cap,
        active_jobs_count=active_jobs,
        queued_jobs_count=queued_jobs,
        pending_allocations_count=pending_allocs,
        avg_cpu_utilization=avg_cpu,
        avg_gpu_utilization=avg_gpu,
        telemetry_source="SYNTHETIC_TELEMETRY_ENGINE (SIMULATED FOR DEMONSTRATION)",
    )

@router.get("/nodes", response_model=List[HPCNodeResponse])
def list_hpc_nodes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Enforce permission to view nodes
    perms = get_user_permissions(current_user, db)
    if "hpc.view_public" not in perms and "hpc.manage_nodes" not in perms:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Account lacks HPC access permission.",
        )
    return db.query(HPCNode).all()

@router.post("/nodes/{node_id}/status", response_model=HPCNodeResponse)
def update_node_status(
    node_id: str,
    payload: HPCNodeStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hpc.manage_nodes")),
):
    node = db.query(HPCNode).filter(HPCNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="HPC node not found.")

    old_status = node.status
    node.status = payload.status
    if payload.notes:
        node.notes = payload.notes
    node.last_heartbeat = datetime.utcnow()
    db.commit()
    db.refresh(node)

    record_audit(
        db=db,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action="UPDATE_HPC_NODE_STATUS",
        entity_type="HPC_NODE",
        entity_id=node.id,
        details=f"Status changed from {old_status} to {payload.status}. Notes: {payload.notes or 'None'}",
    )
    return node

@router.get("/jobs", response_model=List[HPCJobResponse])
def list_hpc_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    perms = get_user_permissions(current_user, db)
    if "hpc.manage_nodes" in perms or "hpc.review_allocations" in perms:
        return db.query(HPCJob).all()
    # Otherwise scoped to user's own jobs
    return db.query(HPCJob).filter(HPCJob.user_id == current_user.id).all()

@router.get("/allocations", response_model=List[HPCResponse])
def list_hpc_allocations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    perms = get_user_permissions(current_user, db)
    if "hpc.review_allocations" in perms:
        return db.query(HPCAllocation).order_by(HPCAllocation.created_at.desc()).all()
    # Scoped: Users without review permissions only see their own requests
    return (
        db.query(HPCAllocation)
        .filter(HPCAllocation.user_id == current_user.id)
        .order_by(HPCAllocation.created_at.desc())
        .all()
    )

@router.post("/allocations", response_model=HPCResponse)
def request_hpc_allocation(
    payload: HPCCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hpc.request_allocation")),
):
    req = HPCAllocation(
        user_id=current_user.id,
        user_name=current_user.name,
        project_name=payload.project_name,
        node_hours=payload.node_hours,
        supervisor_name=payload.supervisor_name,
        reason=payload.reason,
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    record_audit(
        db=db,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action="REQUEST_HPC_ALLOCATION",
        entity_type="HPC_ALLOCATION",
        entity_id=req.id,
        details=f"Requested {payload.node_hours} node-hours for '{payload.project_name}'",
    )
    return req

@router.post("/allocations/{allocation_id}/decide", response_model=HPCResponse)
def decide_hpc_allocation(
    allocation_id: str,
    decision: str,  # 'approved', 'declined'
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hpc.approve_allocations")),
):
    alloc = db.query(HPCAllocation).filter(HPCAllocation.id == allocation_id).first()
    if not alloc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="HPC allocation request not found.")

    # RULE 9: A user cannot approve their own request unless a documented policy explicitly permits it
    if alloc.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conflict of Interest: Users are prohibited from approving their own allocation requests.",
        )

    alloc.status = decision
    if reason:
        alloc.reason = reason
    db.commit()
    db.refresh(alloc)

    send_notification(
        db=db,
        recipient_id=alloc.user_id,
        title=f"HPC Allocation {decision.capitalize()}",
        message=f"Your request for {alloc.node_hours} node-hours on '{alloc.project_name}' has been {decision}.",
        category="facility",
    )

    record_audit(
        db=db,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action=f"HPC_ALLOCATION_{decision.upper()}",
        entity_type="HPC_ALLOCATION",
        entity_id=alloc.id,
        details=f"Decision by {current_user.name}. Reason: {reason or 'None'}",
    )
    return alloc

@router.get("/incidents", response_model=List[HPCIncidentResponse])
def list_hpc_incidents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(HPCIncident).order_by(HPCIncident.created_at.desc()).all()

@router.post("/incidents", response_model=HPCIncidentResponse)
def create_hpc_incident(
    payload: HPCIncidentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hpc.record_maintenance")),
):
    incident = HPCIncident(
        node_id=payload.node_id,
        incident_type=payload.incident_type,
        severity=payload.severity,
        reported_by=current_user.name,
        description=payload.description,
        status="open",
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    record_audit(
        db=db,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action="LOG_HPC_INCIDENT",
        entity_type="HPC_INCIDENT",
        entity_id=incident.id,
        details=f"Logged {payload.severity} incident on {payload.node_id}: {payload.description}",
    )
    return incident
