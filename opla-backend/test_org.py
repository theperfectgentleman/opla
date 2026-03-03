import asyncio
from app.core.database import SessionLocal
from app.services.organization_service import OrganizationService
from app.models.user import User

db = SessionLocal()

try:
    user = db.query(User).first()
    if user:
        org = OrganizationService.create_organization(db=db, name="Test Org 2", owner_id=user.id)
        print("Success, created org with ID:", org.id)
except Exception as e:
    import traceback
    with open("err_log2.txt", "w") as f:
        f.write(traceback.format_exc())
    print("Failed. See err_log2.txt")
finally:
    db.close()
