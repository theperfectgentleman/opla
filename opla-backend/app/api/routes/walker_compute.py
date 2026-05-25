import uuid
import time
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.api.schemas.walker_compute import WalkerComputePayload, WalkerComputeResponse
from app.services.walker_compute_service import WalkerComputeService
from app.models.user import User

router = APIRouter(prefix="/analytics/walker", tags=["Analytics"])

@router.post("/{dataset_id}/compute", response_model=WalkerComputeResponse)
def compute_walker_payload(
    org_id: uuid.UUID,
    dataset_id: uuid.UUID,
    payload: WalkerComputePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        start_t = time.time()
        result = WalkerComputeService.process_payload(
            db=db,
            org_id=org_id,
            dataset_id=dataset_id,
            payload=payload.model_dump(exclude_none=True)
        )
        print(f"[WalkerCompute] Query processed in {time.time() - start_t:.3f}s")
        return WalkerComputeResponse(success=True, data=result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return WalkerComputeResponse(success=False, message=str(e))
