from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict

class SubmissionCreate(BaseModel):
    form_id: UUID
    data: Dict
    metadata: Optional[Dict] = None

class PublicSubmissionCreate(BaseModel):
    data: Dict
    metadata: Optional[Dict] = None

class SubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    form_id: UUID
    user_id: Optional[UUID] = None
    data: Dict
    metadata_json: Optional[Dict] = None
    created_at: datetime
