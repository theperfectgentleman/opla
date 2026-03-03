import asyncio
from app.core.database import SessionLocal
from app.api.routes.auth import register_with_email
from app.api.schemas.auth import RegisterEmailRequest

db = SessionLocal()
req = RegisterEmailRequest(email="test567@opla.ai", password="Test1234()", full_name="Test")

try:
    print("Testing register...")
    # It's a synchronous handler: register_with_email(request, db)
    result = register_with_email(req, db)
    print("Success:", result)
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
