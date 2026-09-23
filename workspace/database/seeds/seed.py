import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from database.app.database import SessionLocal, init_db
from database.app.models import TeamMember, SupportRequest, HistoryEvent


def seed_database():
    init_db()
    db = SessionLocal()

    try:
        if db.query(TeamMember).count() == 0:
            members = [
                TeamMember(name="Priya Sharma", email="priya@cloudnaut.com", is_active=True),
                TeamMember(name="Rahul Verma", email="rahul@cloudnaut.com", is_active=True),
            ]
            db.add_all(members)
            db.commit()
            print("Successfully seeded team members.")

        if db.query(SupportRequest).count() == 0:
            req = SupportRequest(
                title="VPN Issue",
                description="Unable to access internal dev environment",
                requester_name="Alex",
                requester_email="alex@cloudnaut.com",
                category="Access",
                priority="High",
                status="Open",
            )
            db.add(req)
            db.commit()
            db.refresh(req)

            event = HistoryEvent(
                request_id=req.id,
                event_type="created",
                description="Request created by Alex",
            )
            db.add(event)
            db.commit()
            print(f"Successfully seeded sample request ID: {req.id}")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()