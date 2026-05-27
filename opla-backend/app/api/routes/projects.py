from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List
from app.api.dependencies import get_current_user, get_db
from app.api.schemas.project import (
    ProjectAccessCreate,
    ProjectAccessOut,
    ProjectAttendanceCheckIn,
    ProjectAttendanceCheckOut,
    ProjectAttendanceOut,
    ProjectCatalogItemCreate,
    ProjectCatalogItemOut,
    ProjectCatalogItemUpdate,
    ProjectCreate,
    ProjectOut,
    ProjectTaskCreate,
    ProjectTaskOut,
    ProjectTaskUpdate,
    ProjectRoleTemplateCreate,
    ProjectRoleTemplateOut,
    ProjectRoleTemplateUpdate,
    ProjectUpdate,
)
from app.services.form_service import ProjectService
from app.services.organization_service import OrganizationService
from app.services.project_access_service import ProjectAccessService
from app.services.project_catalog_service import ProjectCatalogService
from app.services.project_attendance_service import ProjectAttendanceService
from app.services.project_role_service import ProjectRoleService
from app.services.project_task_service import ProjectTaskService
from app.models.project_access import AccessorType
from app.models.user import User
import uuid

router = APIRouter(prefix="/organizations/{org_id}/projects", tags=["projects"])


def _serialize_access_rule(rule) -> ProjectAccessOut:
    return ProjectAccessOut(
        id=rule.id,
        project_id=rule.project_id,
        accessor_id=rule.accessor_id,
        accessor_type=rule.accessor_type,
        role=rule.role,
        role_template_id=rule.role_template_id,
        role_name=rule.role_template.name if rule.role_template else (rule.role.value.title() if rule.role else None),
        role_slug=rule.role_template.slug if rule.role_template else (rule.role.value if rule.role else None),
        permissions=list(rule.role_template.permissions) if rule.role_template else [],
    )


def _serialize_role_template(role) -> ProjectRoleTemplateOut:
    return ProjectRoleTemplateOut(
        id=role.id,
        org_id=role.org_id,
        name=role.name,
        slug=role.slug,
        description=role.description,
        permissions=list(role.permissions or []),
        priority=role.priority,
        is_system=role.is_system,
        assignment_count=len(role.assignments),
        created_at=role.created_at,
        updated_at=role.updated_at,
    )

@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    project_in: ProjectCreate,
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify org membership and admin role
    members = OrganizationService.get_org_members(db, org_id)
    member = next((m for m in members if m.user_id == current_user.id), None)
    if not member or member.global_role != "admin":
        raise HTTPException(status_code=403, detail="Only org admins can create projects")
        
    return ProjectService.create_project(
        db=db,
        org_id=org_id,
        name=project_in.name,
        description=project_in.description,
        created_by=current_user.id,
    )

@router.get("", response_model=List[ProjectOut])
def list_projects(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify org membership
    members = OrganizationService.get_org_members(db, org_id)
    member = next((m for m in members if m.user_id == current_user.id), None)
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    projects = ProjectService.get_org_projects(db, org_id)
    if member.global_role == "admin":
        return projects

    visible_projects = []
    for project in projects:
        try:
            visible_projects.append(ProjectAccessService.ensure_can_view_project(db, current_user.id, project.id))
        except HTTPException:
            continue
    return visible_projects


@router.get("/role-templates", response_model=List[ProjectRoleTemplateOut])
def list_project_role_templates(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    members = OrganizationService.get_org_members(db, org_id)
    member = next((m for m in members if m.user_id == current_user.id), None)
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    return [_serialize_role_template(role) for role in ProjectRoleService.list_roles(db, org_id)]


@router.post("/role-templates", response_model=ProjectRoleTemplateOut, status_code=status.HTTP_201_CREATED)
def create_project_role_template(
    org_id: uuid.UUID,
    payload: ProjectRoleTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    members = OrganizationService.get_org_members(db, org_id)
    member = next((m for m in members if m.user_id == current_user.id), None)
    if not member or member.global_role != "admin":
        raise HTTPException(status_code=403, detail="Only org admins can create project role templates")
    role = ProjectRoleService.create_role(
        db,
        org_id,
        name=payload.name,
        description=payload.description,
        permissions=payload.permissions,
        priority=payload.priority,
    )
    return _serialize_role_template(role)


@router.patch("/role-templates/{role_template_id}", response_model=ProjectRoleTemplateOut)
def update_project_role_template(
    org_id: uuid.UUID,
    role_template_id: uuid.UUID,
    payload: ProjectRoleTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    members = OrganizationService.get_org_members(db, org_id)
    member = next((m for m in members if m.user_id == current_user.id), None)
    if not member or member.global_role != "admin":
        raise HTTPException(status_code=403, detail="Only org admins can update project role templates")
    role = ProjectRoleService.update_role(
        db,
        org_id,
        role_template_id,
        name=payload.name,
        description=payload.description,
        permissions=payload.permissions,
        priority=payload.priority,
    )
    if not role:
        raise HTTPException(status_code=404, detail="Project role template not found")
    return _serialize_role_template(role)


@router.delete("/role-templates/{role_template_id}")
def delete_project_role_template(
    org_id: uuid.UUID,
    role_template_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    members = OrganizationService.get_org_members(db, org_id)
    member = next((m for m in members if m.user_id == current_user.id), None)
    if not member or member.global_role != "admin":
        raise HTTPException(status_code=403, detail="Only org admins can delete project role templates")
    if not ProjectRoleService.delete_role(db, org_id, role_template_id):
        raise HTTPException(status_code=400, detail="Cannot delete system role template or template with assignments")
    return {"message": "Project role template deleted successfully"}


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    project_in: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if project_in.status is not None:
        project = ProjectAccessService.ensure_can_manage_project_lifecycle(db, current_user.id, project_id)
    else:
        project = ProjectAccessService.ensure_can_edit_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    ProjectAccessService.ensure_project_is_mutable(project)
    return ProjectService.update_project(
        db,
        project,
        name=project_in.name,
        description=project_in.description,
        status=project_in.status,
    )


@router.get("/{project_id}/access", response_model=List[ProjectAccessOut])
def list_project_access(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    rules = ProjectAccessService.list_access_rules(db, project_id)
    return [_serialize_access_rule(rule) for rule in rules]


@router.post("/{project_id}/access", response_model=ProjectAccessOut, status_code=status.HTTP_201_CREATED)
def grant_project_access(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    payload: ProjectAccessCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_manage_project_access(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    rule = ProjectAccessService.grant_access(
        db,
        project,
        accessor_id=payload.accessor_id,
        accessor_type=payload.accessor_type,
        role=payload.role,
        role_template_id=payload.role_template_id,
    )
    return _serialize_access_rule(rule)


@router.delete("/{project_id}/access/{accessor_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_project_access(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    accessor_id: uuid.UUID,
    accessor_type: AccessorType,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_manage_project_access(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    ProjectAccessService.revoke_access(db, project_id, accessor_id, accessor_type)
    return None


@router.get("/{project_id}/tasks", response_model=List[ProjectTaskOut])
def list_project_tasks(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectTaskService.list_tasks(db, project_id)


@router.get("/{project_id}/tasks/my-day", response_model=List[ProjectTaskOut])
def list_my_project_tasks_for_day(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    target_date: date = Query(alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectTaskService.list_tasks_for_user_day(db, project_id, current_user.id, target_date)


@router.get("/{project_id}/attendance", response_model=List[ProjectAttendanceOut])
def list_project_attendance(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    target_date: date | None = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectAttendanceService.list_records(db, project_id, target_date)


@router.get("/{project_id}/attendance/my-status", response_model=ProjectAttendanceOut | None)
def get_my_project_attendance_status(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    target_date: date = Query(alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectAttendanceService.get_record_for_user_day(db, project_id, current_user.id, target_date)


@router.post("/{project_id}/attendance/check-in", response_model=ProjectAttendanceOut, status_code=status.HTTP_201_CREATED)
def check_in_project_attendance(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    payload: ProjectAttendanceCheckIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectAttendanceService.check_in(
        db,
        project,
        user_id=current_user.id,
        timestamp=payload.timestamp or datetime.utcnow(),
        location=payload.location.model_dump(),
        note=payload.note,
        image_uri=payload.image_uri,
        signature=payload.signature,
    )


@router.post("/{project_id}/attendance/check-out", response_model=ProjectAttendanceOut)
def check_out_project_attendance(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    payload: ProjectAttendanceCheckOut,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectAttendanceService.check_out(
        db,
        project,
        user_id=current_user.id,
        timestamp=payload.timestamp or datetime.utcnow(),
        location=payload.location.model_dump(),
        note=payload.note,
        image_uri=payload.image_uri,
        signature=payload.signature,
    )


@router.post("/{project_id}/tasks", response_model=ProjectTaskOut, status_code=status.HTTP_201_CREATED)
def create_project_task(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    payload: ProjectTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_edit_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectTaskService.create_task(
        db,
        project,
        title=payload.title,
        description=payload.description,
        kind=payload.kind,
        starts_at=payload.starts_at,
        due_at=payload.due_at,
        visit_date=payload.visit_date,
        source_submission_id=payload.source_submission_id,
        context_json=payload.context_json,
        assigned_accessor_id=payload.assigned_accessor_id,
        assigned_accessor_type=payload.assigned_accessor_type,
        created_by=current_user.id,
    )


@router.patch("/{project_id}/tasks/{task_id}", response_model=ProjectTaskOut)
def update_project_task(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: ProjectTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = ProjectTaskService.get_task_or_404(db, project_id, task_id)
    project = ProjectTaskService.ensure_can_update_task(db, current_user.id, project_id, task)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectTaskService.update_task(
        db,
        project,
        task,
        title=payload.title,
        description=payload.description,
        kind=payload.kind,
        status=payload.status,
        starts_at=payload.starts_at,
        due_at=payload.due_at,
        visit_date=payload.visit_date,
        source_submission_id=payload.source_submission_id,
        context_json=payload.context_json,
        assigned_accessor_id=None if payload.clear_assignment else payload.assigned_accessor_id,
        assigned_accessor_type=None if payload.clear_assignment else payload.assigned_accessor_type,
        replace_assignment=payload.clear_assignment or payload.assigned_accessor_id is not None or payload.assigned_accessor_type is not None,
        replace_context="context_json" in payload.model_fields_set,
    )


@router.delete("/{project_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_task(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = ProjectTaskService.get_task_or_404(db, project_id, task_id)
    project = ProjectAccessService.ensure_can_edit_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    ProjectTaskService.delete_task(db, project, task)
    return None


@router.get("/{project_id}/catalog-items", response_model=List[ProjectCatalogItemOut])
def list_project_catalog_items(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectCatalogService.list_items(db, project_id)


@router.post("/{project_id}/catalog-items", response_model=ProjectCatalogItemOut, status_code=status.HTTP_201_CREATED)
def create_project_catalog_item(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    payload: ProjectCatalogItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_edit_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectCatalogService.create_item(
        db,
        project,
        sku_code=payload.sku_code,
        label=payload.label,
        default_price=payload.default_price,
        unit=payload.unit,
        brand=payload.brand,
        is_active=payload.is_active,
        price_editable=payload.price_editable,
        metadata_json=payload.metadata_json,
        created_by=current_user.id,
    )


@router.patch("/{project_id}/catalog-items/{item_id}", response_model=ProjectCatalogItemOut)
def update_project_catalog_item(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    item_id: uuid.UUID,
    payload: ProjectCatalogItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_edit_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    item = ProjectCatalogService.get_item_or_404(db, project_id, item_id)
    return ProjectCatalogService.update_item(
        db,
        project,
        item,
        sku_code=payload.sku_code,
        label=payload.label,
        default_price=payload.default_price,
        unit=payload.unit,
        brand=payload.brand,
        is_active=payload.is_active,
        price_editable=payload.price_editable,
        metadata_json=payload.metadata_json,
    )


@router.delete("/{project_id}/catalog-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_catalog_item(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_edit_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    item = ProjectCatalogService.get_item_or_404(db, project_id, item_id)
    ProjectCatalogService.delete_item(db, project, item)
    return None
