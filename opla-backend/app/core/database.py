import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.base import Base

# Sync Engine for Alembic
from sqlalchemy import create_engine
engine_sync = create_engine(settings.DATABASE_URL)

# SessionLocal for dependency
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_sync)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
