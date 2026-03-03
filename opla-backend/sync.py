import asyncio
from app.core.database import engine_sync
from app.models.base import Base

# Imports needed to populate Base.metadata
import app.models

print("Creating all tables from Python definitions...")
Base.metadata.create_all(bind=engine_sync)
print("Complete.")
