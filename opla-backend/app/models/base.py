from sqlalchemy.ext.declarative import declarative_base

# SQLAlchemy declarative base for all models
Base = declarative_base()

# Import all models here to ensure they're registered with Base
# This is important for Alembic migrations to detect all tables
from app.models.user import User  # noqa: F401
from app.models.organization import Organization  # noqa: F401
from app.models.org_member import OrgMember  # noqa: F401
from app.models.team import Team  # noqa: F401
from app.models.team_member import TeamMember  # noqa: F401
from app.models.project import Project  # noqa: F401
from app.models.project_access import ProjectAccess  # noqa: F401
from app.models.form import Form  # noqa: F401
from app.models.submission import Submission  # noqa: F401

__all__ = [
    "Base", 
    "User", 
    "Organization", 
    "OrgMember", 
    "Team", 
    "TeamMember", 
    "Project", 
    "ProjectAccess", 
    "Form",
    "Submission"
]
