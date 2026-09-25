import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from database.app.database import SessionLocal
from database.app.models import TeamMember, SupportRequest, HistoryEvent, TicketNote


def seed_database():
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

        req = db.query(SupportRequest).filter_by(title="VPN Issue").first()
        if not req:
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

        sample_note = db.query(TicketNote).filter_by(
            request_id=req.id,
            note="Initial investigation started",
            created_by="Admin",
        ).first()
        if not sample_note:
            note = TicketNote(
                request_id=req.id,
                note="Initial investigation started",
                created_by="Admin",
            )
            db.add(note)
            db.commit()
            print(f"Successfully seeded note for request ID: {req.id}")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()