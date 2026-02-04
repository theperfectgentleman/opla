import psycopg2
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database URL
db_url = os.getenv("DATABASE_URL")

# Parse connection string
# Format: postgresql://user:password@host:port/database
parts = db_url.replace("postgresql://", "").split("@")
user_pass = parts[0].split(":")
host_port_db = parts[1].split("/")
host_port = host_port_db[0].split(":")

conn = psycopg2.connect(
    host=host_port[0],
    port=host_port[1],
    database=host_port_db[1],
    user=user_pass[0],
    password=user_pass[1].replace("%40", "@")
)

cursor = conn.cursor()

# Drop alembic version table
try:
    cursor.execute("DROP TABLE IF EXISTS alembic_version CASCADE;")
    print("✓ Dropped alembic_version table")
except Exception as e:
    print(f"Error dropping alembic_version: {e}")

# Drop existing tables (if any)
tables = ['projects', 'teams', 'users', 'organizations']
for table in tables:
    try:
        cursor.execute(f"DROP TABLE IF EXISTS {table} CASCADE;")
        print(f"✓ Dropped {table} table")
    except Exception as e:
        print(f"Error dropping {table}: {e}")

conn.commit()
cursor.close()
conn.close()

print("\n✅ Database reset complete! You can now run: python -m alembic upgrade head")
