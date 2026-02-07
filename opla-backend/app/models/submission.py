from sqlalchemy import Column, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.models.base import Base

class Submission(Base):
    __tablename__ = "submissions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    form_id = Column(UUID(as_uuid=True), ForeignKey("forms.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True) # Null for public submissions
    data = Column(JSONB, nullable=False) # The actual form response
    metadata_json = Column(JSONB, nullable=True) # Browser info, duration, etc.
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    form = relationship("Form", backref="submissions")
    user = relationship("User", backref="submissions")
