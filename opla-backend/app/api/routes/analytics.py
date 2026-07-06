import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db, get_user_org_role
from app.api.schemas.analytics import (
    AnalyticsDashboardCreate,
    AnalyticsDashboardOut,
    AnalyticsDashboardUpdate,
    AnalyticsQueryRequest,
    AnalyticsQueryResponse,
    AnalyticsSource,
    ComparePeriodRequest,
    ComparePeriodResponse,
    GroupBySpec,
    SavedQuestionCreate,
    SavedQuestionOut,
    SavedQuestionUpdate,
)
from app.models.user import User
from app.services.analytics_service import AnalyticsService


router = APIRouter(prefix="/organizations/{org_id}/analytics", tags=["analytics"])


@router.get("/sources", response_model=list[AnalyticsSource])
def list_analytics_sources(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    membership=Depends(get_user_org_role),
):
    return AnalyticsService.list_sources(db, org_id)

from fastapi import UploadFile, File
import csv
import io
from app.models.form import Form, FormDataset
from app.models.form_dataset import FormDatasetField, FormDatasetFieldStatus, FormDatasetStatus
from app.models.submission import Submission

@router.post("/upload-csv")
async def upload_csv_dataset(
    org_id: uuid.UUID,
    project_id: uuid.UUID = Query(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    membership=Depends(get_user_org_role),
):
    # Parse CSV
    content = await file.read()
    text = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)

    if not rows:
        raise HTTPException(status_code=400, detail="CSV is empty")

    # Determine fields
    fields = []
    for key in reader.fieldnames or []:
        fields.append({
            "field_key": key,
            "label": key,
            "field_type": "number" if all(row[key].replace('.','',1).isdigit() for row in rows if row.get(key)) else "string",
            "field_identifier": f"csv_{key}"
        })

    # Create mock Form and FormDataset
    form = Form(
        org_id=org_id,
        project_id=project_id,
        title=f"Uploaded: {file.filename}",
        created_by=current_user.id,
        version=1,
        published_version=1,
        schema={"pages": [], "fields": fields}
    )
    db.add(form)
    db.flush()

    dataset_slug = f"csv_{form.id.hex[:8]}"
    dataset = FormDataset(
        form_id=form.id,
        name=form.title,
        slug=dataset_slug,
        status=FormDatasetStatus.ACTIVE,
        current_schema_version_number=1,
    )
    db.add(dataset)
    db.flush()

    # Create FormDatasetField records
    for idx, f in enumerate(fields):
        field = FormDatasetField(
            dataset_id=dataset.id,
            field_identifier=f["field_identifier"],
            field_key=f["field_key"],
            label=f["label"],
            field_type=f["field_type"],
            status=FormDatasetFieldStatus.ACTIVE,
            introduced_in_version_number=1,
        )
        db.add(field)

    # Update form dataset slug with id
    dataset.slug = dataset_slug
    db.flush()
    
    # Create Submissions
    for row in rows:
        sub = Submission(
            org_id=org_id,
            project_id=project_id,
            form_id=form.id,
            form_version=1,
            data=row,
            created_by=current_user.id
        )
        db.add(sub)
    
    db.commit()
    db.refresh(dataset)
    return {"status": "success", "dataset_id": dataset.id, "row_count": len(rows)}



@router.post("/query", response_model=AnalyticsQueryResponse)
def run_analytics_query(
    org_id: uuid.UUID,
    body: AnalyticsQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    membership=Depends(get_user_org_role),
):
    try:
        group_by = [
            item.model_dump() if isinstance(item, GroupBySpec) else item
            for item in body.group_by
        ]
        return AnalyticsService.execute_query(
            db=db,
            org_id=org_id,
            dataset_id=body.dataset_id,
            select_fields=body.select_fields,
            filters=body.filters,
            group_by=group_by,
            aggregates=[item.model_dump() for item in body.aggregates],
            order_by=[item.model_dump() for item in body.order_by],
            limit=body.limit,
            offset=body.offset,
            calculated_fields=body.calculated_fields,
        )
    except ValueError as exc:
        detail = str(exc)
        if detail == "DATASET_NOT_FOUND":
            raise HTTPException(status_code=404, detail="Dataset not found") from exc
        if detail.startswith("FIELD_NOT_ALLOWED:"):
            raise HTTPException(status_code=400, detail=f"Field not allowed: {detail.split(':', 1)[1]}") from exc
        if detail.startswith("AGG_NOT_ALLOWED:"):
            raise HTTPException(status_code=400, detail=f"Aggregate not allowed: {detail.split(':', 1)[1]}") from exc
        raise HTTPException(status_code=400, detail=detail) from exc


@router.post("/compare", response_model=ComparePeriodResponse)
def compare_analytics_period(
    org_id: uuid.UUID,
    body: ComparePeriodRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    membership=Depends(get_user_org_role),
):
    try:
        return AnalyticsService.compare_period(
            db=db,
            org_id=org_id,
            dataset_id=body.dataset_id,
            measure_field=body.measure_field,
            agg_fn=body.agg_fn,
            date_field=body.date_field,
            period=body.period,
            filters=body.filters,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/questions", response_model=SavedQuestionOut, status_code=status.HTTP_201_CREATED)
def create_saved_question(
    org_id: uuid.UUID,
    body: SavedQuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    membership=Depends(get_user_org_role),
):
    return AnalyticsService.create_question(db, org_id, current_user.id, body.model_dump())


@router.get("/questions", response_model=list[SavedQuestionOut])
def list_saved_questions(
    org_id: uuid.UUID,
    project_id: Optional[uuid.UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    membership=Depends(get_user_org_role),
):
    return AnalyticsService.list_questions(db, org_id, project_id)


@router.get("/questions/{question_id}", response_model=SavedQuestionOut)
def get_saved_question(
    org_id: uuid.UUID,
    question_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    membership=Depends(get_user_org_role),
):
    question = AnalyticsService.get_question(db, question_id)
    if not question or question.org_id != org_id:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


@router.patch("/questions/{question_id}", response_model=SavedQuestionOut)
def update_saved_question(
    org_id: uuid.UUID,
    question_id: uuid.UUID,
    body: SavedQuestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    membership=Depends(get_user_org_role),
):
    question = AnalyticsService.get_question(db, question_id)
    if not question or question.org_id != org_id:
        raise HTTPException(status_code=404, detail="Question not found")
    return AnalyticsService.update_question(db, question, body.model_dump(exclude_unset=True))


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_question(
    org_id: uuid.UUID,
    question_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    membership=Depends(get_user_org_role),
):
    question = AnalyticsService.get_question(db, question_id)
    if not question or question.org_id != org_id:
        raise HTTPException(status_code=404, detail="Question not found")
    AnalyticsService.delete_question(db, question)


@router.post("/dashboards", response_model=AnalyticsDashboardOut, status_code=status.HTTP_201_CREATED)
def create_dashboard(
    org_id: uuid.UUID,
    body: AnalyticsDashboardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    membership=Depends(get_user_org_role),
):
    return AnalyticsService.create_dashboard(db, org_id, current_user.id, body.model_dump())


@router.get("/dashboards", response_model=list[AnalyticsDashboardOut])
def list_dashboards(
    org_id: uuid.UUID,
    project_id: Optional[uuid.UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    membership=Depends(get_user_org_role),
):
    return AnalyticsService.list_dashboards(db, org_id, project_id)


@router.get("/dashboards/{dashboard_id}", response_model=AnalyticsDashboardOut)
def get_dashboard(
    org_id: uuid.UUID,
    dashboard_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    membership=Depends(get_user_org_role),
):
    dashboard = AnalyticsService.get_dashboard(db, dashboard_id)
    if not dashboard or dashboard.org_id != org_id:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dashboard


@router.patch("/dashboards/{dashboard_id}", response_model=AnalyticsDashboardOut)
def update_dashboard(
    org_id: uuid.UUID,
    dashboard_id: uuid.UUID,
    body: AnalyticsDashboardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    membership=Depends(get_user_org_role),
):
    dashboard = AnalyticsService.get_dashboard(db, dashboard_id)
    if not dashboard or dashboard.org_id != org_id:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return AnalyticsService.update_dashboard(db, dashboard, body.model_dump(exclude_unset=True))


@router.delete("/dashboards/{dashboard_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dashboard(
    org_id: uuid.UUID,
    dashboard_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    membership=Depends(get_user_org_role),
):
    dashboard = AnalyticsService.get_dashboard(db, dashboard_id)
    if not dashboard or dashboard.org_id != org_id:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    AnalyticsService.delete_dashboard(db, dashboard)
