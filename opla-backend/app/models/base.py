from sqlalchemy.ext.declarative import declarative_base

# SQLAlchemy declarative base for all models
Base = declarative_base()

# Import all models here to ensure they're registered with Base
# This is important for Alembic migrations to detect all tables
from app.models.user import User  # noqa: F401

__all__ = ["Base", "User"]

