"""Migrate existing team_members from RDS into a Cognito User Pool.

For each active team member this creates a Cognito user (username = email),
sets a TEMPORARY password (the user is forced to set a new one on first login,
since Cognito cannot import the existing argon2 hashes), and adds the user to
the Cognito group matching their role (employee / support / admin).

Idempotent: users that already exist in the pool are skipped.

Env vars:
    COGNITO_USER_POOL_ID   (required)
    DATABASE_URL           (required; same as the backend)
    MIGRATION_TEMP_PASSWORD (optional; default below)

Run (inside the backend image, which has boto3? -> no; see note). This script
is normally run locally with boto3 + a DB connection, or as a one-off task in
an image that has boto3 and SQLAlchemy installed.
"""
import os
import sys

import boto3
from botocore.exceptions import ClientError

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from database.app.database import SessionLocal
from database.app.models import TeamMember


VALID_ROLES = {"employee", "support", "admin"}
TEMP_PASSWORD = os.getenv("MIGRATION_TEMP_PASSWORD", "TempPass-Migrate-2026!")


def migrate():
    pool_id = os.environ["COGNITO_USER_POOL_ID"]
    region = os.getenv("AWS_REGION", "ap-south-1")
    cognito = boto3.client("cognito-idp", region_name=region)

    db = SessionLocal()
    created, skipped, errors = [], [], []
    try:
        members = db.query(TeamMember).filter(TeamMember.is_active.is_(True)).all()
        print(f"Found {len(members)} active team members to migrate.")
        for m in members:
            email = m.email.strip().lower()
            group = m.role if m.role in VALID_ROLES else "employee"
            try:
                cognito.admin_create_user(
                    UserPoolId=pool_id,
                    Username=email,
                    UserAttributes=[
                        {"Name": "email", "Value": email},
                        {"Name": "email_verified", "Value": "true"},
                        {"Name": "name", "Value": m.name or email},
                    ],
                    TemporaryPassword=TEMP_PASSWORD,
                    # Suppress the default Cognito invite email for a bulk migrate.
                    MessageAction="SUPPRESS",
                )
                cognito.admin_add_user_to_group(
                    UserPoolId=pool_id, Username=email, GroupName=group
                )
                created.append(f"{email} ({group})")
            except ClientError as exc:
                code = exc.response["Error"]["Code"]
                if code == "UsernameExistsException":
                    # Already migrated: ensure group membership is correct.
                    try:
                        cognito.admin_add_user_to_group(
                            UserPoolId=pool_id, Username=email, GroupName=group
                        )
                    except ClientError:
                        pass
                    skipped.append(email)
                else:
                    errors.append(f"{email}: {code}")
        print(f"\nCreated {len(created)}:")
        for u in created:
            print("  +", u)
        if skipped:
            print(f"Skipped {len(skipped)} already-present:", ", ".join(skipped))
        if errors:
            print(f"Errors {len(errors)}:")
            for e in errors:
                print("  !", e)
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
