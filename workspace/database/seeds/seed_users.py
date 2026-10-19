"""Seed 10 realistic user records into team_members for Cognito migration testing.

Idempotent: skips any email that already exists. Each user gets a known
password so the accounts are usable before migration. Run as a one-off task:

    python -m workspace.database.seeds.seed_users      (from repo root), or
    python /app/workspace/database/seeds/seed_users.py (inside the container)
"""
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from app.auth import hash_password  # backend image has app on PYTHONPATH
from database.app.database import SessionLocal
from database.app.models import TeamMember


# 10 users: 6 employees, 3 support, 1 admin. Shared known password for testing.
DEFAULT_PASSWORD = "Cloudnaut-Test-2026!"

USERS = [
    ("Aarav Mehta", "aarav.mehta@cloudnaut.com", "employee"),
    ("Diya Nair", "diya.nair@cloudnaut.com", "employee"),
    ("Kabir Rao", "kabir.rao@cloudnaut.com", "employee"),
    ("Ananya Iyer", "ananya.iyer@cloudnaut.com", "employee"),
    ("Vivaan Gupta", "vivaan.gupta@cloudnaut.com", "employee"),
    ("Ishaan Bose", "ishaan.bose@cloudnaut.com", "employee"),
    ("Meera Pillai", "meera.pillai@cloudnaut.com", "support"),
    ("Rohan Kapoor", "rohan.kapoor@cloudnaut.com", "support"),
    ("Sara Khan", "sara.khan@cloudnaut.com", "support"),
    ("Neha Reddy", "neha.reddy@cloudnaut.com", "admin"),
]


def seed_users():
    db = SessionLocal()
    created, skipped = [], []
    try:
        for name, email, role in USERS:
            email = email.strip().lower()
            existing = db.query(TeamMember).filter(TeamMember.email.ilike(email)).first()
            if existing:
                skipped.append(email)
                continue
            db.add(
                TeamMember(
                    name=name,
                    email=email,
                    role=role,
                    password_hash=hash_password(DEFAULT_PASSWORD),
                    is_active=True,
                )
            )
            created.append(f"{email} ({role})")
        db.commit()
        print(f"Created {len(created)} users:")
        for u in created:
            print("  +", u)
        if skipped:
            print(f"Skipped {len(skipped)} existing:", ", ".join(skipped))
        total = db.query(TeamMember).count()
        print(f"team_members total now: {total}")
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        print("Error seeding users:", exc)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_users()
