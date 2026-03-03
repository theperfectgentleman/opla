import json
def run():
    try:
        from app.core.database import engine_sync, SessionLocal
        from sqlalchemy import inspect, text

        inspector = inspect(engine_sync)
        tables = inspector.get_table_names()
        
        output = [f"Found {len(tables)} tables:"]
        
        db = SessionLocal()
        for table in tables:
            try:
                count = db.execute(text(f'SELECT COUNT(*) FROM "{table}"')).scalar()
                output.append(f"✅ {table:<25} (Rows: {count})")
            except Exception as e:
                output.append(f"❌ {table:<25} Error: {e}")
                db.rollback()
                
        output.append("\nRole Assignments Enums Check:")
        try:
            roles = db.execute(text("SELECT DISTINCT global_role FROM org_members")).fetchall()
            output.append(f"OrgMember global_roles in use: {[r[0] for r in roles]}")
        except Exception as e:
            output.append(f"Could not fetch global_roles: {e}")
            db.rollback()
            
        db.close()

        with open("db_state.json", "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2)

    except Exception as e:
        import traceback
        with open("db_state.json", "w", encoding="utf-8") as f:
            json.dump({"error": str(e), "traceback": traceback.format_exc()}, f, indent=2)

if __name__ == '__main__':
    run()
