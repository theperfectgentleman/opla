from app.services.auth_service import auth_service
import traceback

try:
    print("Testing password hashing...")
    result = auth_service.hash_password("Test1234()")
    print("Hash result:", result)
except Exception as e:
    print("Error during hash_password:")
    traceback.print_exc()
