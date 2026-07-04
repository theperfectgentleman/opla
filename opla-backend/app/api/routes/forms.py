from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Dict
from app.api.schemas.automation import FormAutomationRuleCreate, FormAutomationRuleOut, FormAutomationRuleUpdate
from app.api.dependencies import get_current_user, get_db
from app.api.schemas.dataset import FormDatasetOut, FormDatasetUpdateIn, LookupDatasetSourceOut, LookupOptionsOut
from app.api.schemas.form import (
    CatalogDesignationIn,
    CatalogEntryDeleteOut,
    CatalogEntryOut,
    CatalogEntryUpsertIn,
    CatalogLookupOptionsOut,
    CatalogLookupSourceOut,
    FormCreateIn,
    FormOut,
    FormRuntimeOut,
    FormVersionOut,
    FormStatsOut,
    PublishFormIn,
    FormResponsibilityUpdateIn,
)
from app.services.catalog_form_service import CatalogFormService
from app.services.dataset_service import DatasetService
from app.services.form_automation_service import FormAutomationService
from app.services.form_service import FormService
from app.services.project_access_service import ProjectAccessService
from app.models.project import ProjectStatus
from app.models.user import User
import uuid

router = APIRouter(prefix="/forms", tags=["forms"])
project_router = APIRouter(prefix="/projects/{project_id}/forms", tags=["forms"])

@project_router.post("", response_model=FormOut, status_code=status.HTTP_201_CREATED)
def create_form(
    project_id: uuid.UUID,
    form_in: FormCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = ProjectAccessService.ensure_can_create_form(db, current_user.id, project_id)
    return FormService.create_form(
        db=db,
        project_id=project_id,
        title=form_in.title,
        blueprint=form_in.blueprint,
        kind=form_in.kind.value,
    )

@project_router.get("", response_model=List[FormOut])
def list_project_forms(
    project_id: uuid.UUID,
    live_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    return FormService.get_project_forms(db, project_id, live_only=live_only)

@router.get("/{form_id}/stats", response_model=FormStatsOut)
def get_form_stats(
    form_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_view_form(db, current_user.id, form)
    stats = FormService.get_form_stats(db, form_id, current_user.id)
    return FormStatsOut(
        form_id=form.id,
        title=form.title,
        status=form.status,
        version=form.version,
        submission_count=stats["total"],
        my_submission_count=stats["mine"],
        last_submitted_at=stats["last_submitted_at"],
    )


@router.get("/{form_id}", response_model=FormOut)
def get_form(
    form_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_view_form(db, current_user.id, form)
    return form


@router.get("/{form_id}/runtime", response_model=FormRuntimeOut)
def get_runtime_form(
    form_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    source_form = FormService.get_form(db, form_id)
    if not source_form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_view_form(db, current_user.id, source_form)
    if source_form.project.status != ProjectStatus.ACTIVE:
        raise HTTPException(status_code=409, detail="Project is not active")

    form = FormService.get_runtime_form_by_id(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form is not deployed")
    return form


@router.get("/{form_id}/linked-forms", response_model=List[FormRuntimeOut])
def get_linked_forms(
    form_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all transitively linked child forms for offline pre-loading.

    Recursively resolves `linked_form_ids` from each form's live blueprint
    up to 3 levels deep. Returns runtime-shaped objects so the mobile client
    can cache and render them directly.
    """
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_view_form(db, current_user.id, form)

    linked = FormService.get_linked_forms(db, form_id)
    return linked

@router.put("/{form_id}/blueprint", response_model=FormOut)
def update_form_blueprint(
    form_id: uuid.UUID,
    blueprint: Dict,
    target_slot: int = 1,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    source_form = FormService.get_form(db, form_id)
    if not source_form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_edit_form(db, current_user.id, source_form)

    try:
        form = FormService.update_blueprint(
            db,
            form_id,
            blueprint,
            target_slot=target_slot,
            updated_by=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form

@router.patch("/{form_id}/blueprint", response_model=FormOut)
def update_form_blueprint_patch(
    form_id: uuid.UUID,
    blueprint: Dict,
    target_slot: int = 1,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return update_form_blueprint(form_id, blueprint, target_slot, db, current_user)


@router.get("/{form_id}/versions", response_model=List[FormVersionOut])
def list_form_versions(
    form_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_view_form(db, current_user.id, form)
    return FormService.get_form_versions(db, form_id)


@router.get("/{form_id}/dataset", response_model=FormDatasetOut)
def get_form_dataset(
    form_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_view_form(db, current_user.id, form)

    dataset = DatasetService.get_form_dataset(db, form_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found for this form")
    return dataset


@router.patch("/{form_id}/dataset", response_model=FormDatasetOut)
def update_form_dataset(
    form_id: uuid.UUID,
    payload: FormDatasetUpdateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_edit_form(db, current_user.id, form)
    return DatasetService.update_form_dataset(
        db,
        form=form,
        lookup_enabled=payload.lookup_enabled,
        public_lookup_enabled=payload.public_lookup_enabled,
    )


@router.get("/{form_id}/lookup-sources", response_model=List[LookupDatasetSourceOut])
def list_form_lookup_sources(
    form_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_view_form(db, current_user.id, form)
    return DatasetService.list_lookup_sources_for_form(db, form)


@router.get("/{form_id}/lookup-sources/{dataset_id}/options", response_model=LookupOptionsOut)
def get_form_lookup_options(
    form_id: uuid.UUID,
    dataset_id: uuid.UUID,
    label_field: str,
    value_field: str,
    search: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_view_form(db, current_user.id, form)
    bounded_limit = max(1, min(limit, 500))
    return DatasetService.get_lookup_options(
        db,
        form=form,
        dataset_id=dataset_id,
        label_field=label_field,
        value_field=value_field,
        search=search,
        limit=bounded_limit,
    )

@router.post("/{form_id}/publish", response_model=FormOut)
def publish_form(
    form_id: uuid.UUID,
    payload: PublishFormIn | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    source_form = FormService.get_form(db, form_id)
    if not source_form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_publish_form(db, current_user.id, source_form)

    # Extra validation for catalog forms: key + label fields must be designated
    CatalogFormService.validate_ready_to_publish(source_form)

    payload = payload or PublishFormIn()

    try:
        form = FormService.publish_form(
            db,
            form_id,
            draft_version_id=payload.draft_version_id,
            draft_slot=payload.draft_slot,
            changelog=payload.changelog,
            published_by=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form


# ---------------------------------------------------------------------------
# Catalog-specific endpoints
# ---------------------------------------------------------------------------

@router.patch("/{form_id}/catalog-designations", response_model=FormOut)
def update_catalog_designations(
    form_id: uuid.UUID,
    payload: CatalogDesignationIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Set or update the key/label field designations for a catalog form."""
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_edit_form(db, current_user.id, form)
    return CatalogFormService.update_catalog_designations(
        db,
        form,
        catalog_key_field_id=payload.catalog_key_field_id,
        catalog_label_field_id=payload.catalog_label_field_id,
    )


@router.get("/{form_id}/catalog-entries", response_model=List[CatalogEntryOut])
def get_catalog_entries(
    form_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return resolved catalog entries (latest per key, active only)."""
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_view_form(db, current_user.id, form)
    return CatalogFormService.get_catalog_entries(db, form)


@router.post("/{form_id}/catalog-entries", response_model=CatalogEntryOut, status_code=status.HTTP_201_CREATED)
def upsert_catalog_entry(
    form_id: uuid.UUID,
    payload: CatalogEntryUpsertIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create or update a catalog entry (append-only; latest per key wins)."""
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_edit_form(db, current_user.id, form)
    submission = CatalogFormService.upsert_entry(db, form, payload.data, actor_id=current_user.id)
    # Return in CatalogEntryOut shape
    key_field = form.catalog_key_field_id or ""
    label_field = form.catalog_label_field_id or key_field
    data = submission.data or {}
    return CatalogEntryOut(
        submission_id=str(submission.id),
        key_value=data.get(key_field),
        label_value=data.get(label_field),
        data=data,
        catalog_is_active=True,
        created_at=submission.created_at.isoformat() if submission.created_at else None,
    )


class _ActivePayload(BaseModel):
    active: bool


@router.patch("/{form_id}/catalog-entries/{submission_id}/active", response_model=CatalogEntryOut)
def set_catalog_entry_active(
    form_id: uuid.UUID,
    submission_id: uuid.UUID,
    payload: _ActivePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Activate or deactivate a catalog entry in one click."""
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_edit_form(db, current_user.id, form)
    return CatalogFormService.set_entry_active(db, form, submission_id, payload.active)


@router.delete("/{form_id}/catalog-entries/{submission_id}", response_model=CatalogEntryDeleteOut)
def delete_catalog_entry(
    form_id: uuid.UUID,
    submission_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete a catalog entry and all historical versions for its key."""
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_edit_form(db, current_user.id, form)
    return CatalogFormService.delete_entry(db, form, submission_id)


@router.get("/{form_id}/catalog-lookup-sources", response_model=List[CatalogLookupSourceOut])
def list_catalog_lookup_sources(
    form_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List published catalog forms in the same project that can populate survey lookups."""
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_view_form(db, current_user.id, form)
    return CatalogFormService.list_lookup_sources(db, form)


@router.get("/{form_id}/catalog-lookup-sources/{catalog_form_id}/options", response_model=CatalogLookupOptionsOut)
def get_catalog_lookup_options(
    form_id: uuid.UUID,
    catalog_form_id: uuid.UUID,
    search: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return dropdown/lookup options from a catalog form for use in a standard survey form."""
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_view_form(db, current_user.id, form)
    bounded_limit = max(1, min(limit, 500))
    return CatalogFormService.get_lookup_options(
        db,
        consumer_form=form,
        catalog_form_id=catalog_form_id,
        search=search,
        limit=bounded_limit,
    )


@router.put("/{form_id}/responsibility", response_model=FormOut)
def update_form_responsibility(
    form_id: uuid.UUID,
    payload: FormResponsibilityUpdateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_edit_form(db, current_user.id, form)
    return FormService.update_responsibility(
        db,
        form,
        lead_accessor_id=payload.lead_accessor_id,
        lead_accessor_type=payload.lead_accessor_type,
        assigned_accessor_id=payload.assigned_accessor_id,
        assigned_accessor_type=payload.assigned_accessor_type,
        guest_accessor_id=payload.guest_accessor_id,
        guest_accessor_type=payload.guest_accessor_type,
    )


@router.get("/{form_id}/automation-rules", response_model=List[FormAutomationRuleOut])
def list_form_automation_rules(
    form_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_view_form(db, current_user.id, form)
    return FormAutomationService.list_rules(db, form_id)


@router.post("/{form_id}/automation-rules", response_model=FormAutomationRuleOut, status_code=status.HTTP_201_CREATED)
def create_form_automation_rule(
    form_id: uuid.UUID,
    payload: FormAutomationRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_edit_form(db, current_user.id, form)
    return FormAutomationService.create_rule(
        db,
        form,
        name=payload.name,
        description=payload.description,
        event_type=payload.event_type,
        action_type=payload.action_type,
        is_active=payload.is_active,
        conditions_json=payload.conditions_json,
        action_config_json=payload.action_config_json,
        created_by=current_user.id,
    )


@router.patch("/{form_id}/automation-rules/{rule_id}", response_model=FormAutomationRuleOut)
def update_form_automation_rule(
    form_id: uuid.UUID,
    rule_id: uuid.UUID,
    payload: FormAutomationRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_edit_form(db, current_user.id, form)
    rule = FormAutomationService.get_rule(db, form_id, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Automation rule not found")
    return FormAutomationService.update_rule(
        db,
        rule,
        name=payload.name,
        description=payload.description,
        event_type=payload.event_type,
        action_type=payload.action_type,
        is_active=payload.is_active,
        conditions_json=payload.conditions_json,
        action_config_json=payload.action_config_json,
    )


@router.delete("/{form_id}/automation-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_form_automation_rule(
    form_id: uuid.UUID,
    rule_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_edit_form(db, current_user.id, form)
    rule = FormAutomationService.get_rule(db, form_id, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Automation rule not found")
    FormAutomationService.delete_rule(db, rule)
    return None
