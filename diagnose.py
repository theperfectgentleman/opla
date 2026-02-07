import redis
import psycopg2
from app.core.config import settings

def test_connections():
    print("--- Diagnostics ---")
    
    # Test Redis
    try:
        print(f"Testing Redis at {settings.REDIS_URL}...")
        r = redis.from_url(settings.REDIS_URL)
        r.ping()
        print("✅ Redis: Connected")
    except Exception as e:
        print(f"❌ Redis: Failed - {e}")

    # Test Database
    try:
        print(f"Testing Database at {settings.DATABASE_URL.split('@')[-1]}...") # Don't print full URL with password
        conn = psycopg2.connect(settings.DATABASE_URL)
        cur = conn.cursor()
        cur.execute("SELECT 1")
        print("✅ Database: Connected")
        
        # Check if users table exists
        cur.execute("SELECT to_regclass('public.users')")
        if cur.fetchone()[0]:
            print("✅ Database: 'users' table exists")
        else:
            print("❌ Database: 'users' table MISSING")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Database: Failed - {e}")

if __name__ == "__main__":
    test_connections()
