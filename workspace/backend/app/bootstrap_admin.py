import argparse
from getpass import getpass

from app.auth import hash_password
from database.app.database import SessionLocal
from database.app.models import TeamMember


def main():
    parser = argparse.ArgumentParser(description="Create the first Cloudnaut administrator account.")
    parser.add_argument("--name", required=True)
    parser.add_argument("--email", required=True)
    args = parser.parse_args()

    password = getpass("New admin password (12+ characters): ")
    confirmation = getpass("Confirm password: ")
    if len(password) < 12:
        parser.error("Password must be at least 12 characters.")
    if password != confirmation:
        parser.error("Passwords do not match.")

    db = SessionLocal()
    try:
        email = args.email.strip().lower()
        if db.query(TeamMember).filter(TeamMember.email.ilike(email)).first():
            parser.error("An account with this email already exists.")
        member = TeamMember(
            name=args.name.strip(),
            email=email,
            role="admin",
            password_hash=hash_password(password),
            is_active=True,
        )
        db.add(member)
        db.commit()
        print(f"Administrator account created for {email}.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()