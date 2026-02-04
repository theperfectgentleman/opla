# Phase 1 Backend Test Script
# Tests all authentication endpoints

import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

print("=" * 60)
print("🧪 OPLA BACKEND API - PHASE 1 AUTHENTICATION TESTS")
print("=" * 60)

# 1. Health Check
print("\n1️⃣ Testing Health Check...")
try:
    response = requests.get(f"http://localhost:8000/health")
    print(f"   ✅ Status: {response.status_code}")
    print(f"   Response: {response.json()}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# 2. Register with Email
print("\n2️⃣ Testing Email Registration...")
try:
    data = {
        "email": "test@opla.ai",
        "password": "Test1234",
        "full_name": "Test User"
    }
    response = requests.post(f"{BASE_URL}/auth/register/email", json=data)
    print(f"   ✅ Status: {response.status_code}")
    result = response.json()
    print(f"   User ID: {result['user']['id']}")
    print(f"   Access Token: {result['access_token'][:30]}...")
    
    # Save token for later
    access_token = result['access_token']
except Exception as e:
    print(f"   ❌ Error: {e}")
    access_token = None

# 3. Login with Email
print("\n3️⃣ Testing Email Login...")
try:
    data = {
        "email": "test@opla.ai",
        "password": "Test1234"
    }
    response = requests.post(f"{BASE_URL}/auth/login", json=data)
    print(f"   ✅ Status: {response.status_code}")
    result = response.json()
    print(f"   Full Name: {result['user']['full_name']}")
    access_token = result['access_token']
except Exception as e:
    print(f"   ❌ Error: {e}")

# 4. Get Current User (Protected Route)
print("\n4️⃣ Testing Protected Route (/auth/me)...")
if access_token:
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
        print(f"   ✅ Status: {response.status_code}")
        result = response.json()
        print(f"   Email: {result['email']}")
        print(f"   Full Name: {result['full_name']}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
else:
    print("   ⚠️  Skipped (no access token)")

# 5. Register with Phone (will fail if Redis not running)
print("\n5️⃣ Testing Phone Registration (requires Redis)...")
try:
    data = {
        "phone": "+254712345678",
        "full_name": "Phone User"
    }
    response = requests.post(f"{BASE_URL}/auth/register/phone", json=data)
    print(f"   ✅ Status: {response.status_code}")
    result = response.json()
    print(f"   Message: {result['message']}")
    if 'data' in result and result['data'] and 'otp' in result['data']:
        print(f"   OTP (dev mode): {result['data']['otp']}")
        test_otp = result['data']['otp']
    else:
        test_otp = None
except Exception as e:
    print(f"   ❌ Error: {e}")
    print(f"   💡 Note: Redis must be running for OTP functionality")
    test_otp = None

# 6. Verify OTP
if test_otp:
    print("\n6️⃣ Testing OTP Verification...")
    try:
        data = {
            "phone": "+254712345678",
            "otp": test_otp
        }
        response = requests.post(f"{BASE_URL}/auth/otp/verify", json=data)
        print(f"   ✅ Status: {response.status_code}")
        result = response.json()
        print(f"   User: {result['user']['full_name']}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
else:
    print("\n6️⃣ Skipping OTP Verification (no OTP available)")

#7. API Documentation
print("\n" + "=" * 60)
print("📚 API Documentation: http://localhost:8000/api/docs")
print("=" * 60)
print("\n✅ Phase 1 Backend Tests Complete!")
print("\nNote: Phone/OTP features require Redis to be running.")
print("      Install Redis: https://redis.io/docs/getting-started/")
print("\nNext Steps:")
print("  1. Start Redis server (if testing OTP)")
print("  2. Open http://localhost:8000/api/docs to explore all endpoints")
print("  3. Build  the Studio frontend (Phase 1 - Frontend)")
