import uuid
import time
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db, get_user_org_role
from app.api.schemas.walker_compute import WalkerComputePayload, WalkerComputeResponse
from app.services.walker_compute_service import WalkerComputeService
from app.models.user import User

router = APIRouter(prefix="/organizations/{org_id}/analytics/walker", tags=["analytics"])


@router.post("/{dataset_id}/compute", response_model=WalkerComputeResponse)
def compute_walker_payload(
    org_id: uuid.UUID,
    dataset_id: uuid.UUID,
    payload: WalkerComputePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    membership=Depends(get_user_org_role),
):
    try:
        start_t = time.time()
        result = WalkerComputeService.process_payload(
            db=db,
            org_id=org_id,
            dataset_id=dataset_id,
            payload=payload.model_dump(exclude_none=True),
        )
        elapsed = time.time() - start_t
        return WalkerComputeResponse(success=True, data=result, message=f"{elapsed:.3f}s")
    except ValueError as exc:
        detail = str(exc)
        if detail == "DATASET_NOT_FOUND":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found") from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
