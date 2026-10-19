"""Admin operations against the Cognito User Pool.

Used by the user-creation flows so that accounts created in the app also exist
in Cognito (the identity provider) and can therefore log in. Without this, a
new team_members row has no matching Cognito user and the person cannot sign in.
"""
import os

import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException


VALID_ROLES = {"employee", "support", "admin"}


class CognitoAdminError(RuntimeError):
    pass


def _client():
    region = os.getenv("AWS_REGION", os.getenv("COGNITO_REGION", "ap-south-1"))
    return boto3.client("cognito-idp", region_name=region)


def _pool_id() -> str:
    pool = os.getenv("COGNITO_USER_POOL_ID", "")
    if not pool:
        raise CognitoAdminError("COGNITO_USER_POOL_ID is not configured.")
    return pool


def create_user(
    email: str,
    name: str,
    role: str,
    *,
    password: str | None = None,
    permanent: bool = True,
) -> None:
    """Create a Cognito user and add them to their role group.

    - If `password` is given and `permanent=True`, the user can sign in
      immediately with that password (no force-change).
    - If `password` is None, a temporary password is generated and the user
      must set a new one on first login (status FORCE_CHANGE_PASSWORD).
    Idempotent: if the user already exists, we just ensure group membership.
    """
    email = email.strip().lower()
    role = role if role in VALID_ROLES else "employee"
    client = _client()
    pool = _pool_id()

    created = True
    try:
        kwargs = {
            "UserPoolId": pool,
            "Username": email,
            "UserAttributes": [
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "name", "Value": name or email},
            ],
            "MessageAction": "SUPPRESS",
        }
        if password:
            # Use the supplied password as the account's temporary password.
            # If permanent=True we promote it right after (immediately usable);
            # if permanent=False it stays a known temp password the user must
            # change on first login (status FORCE_CHANGE_PASSWORD).
            kwargs["TemporaryPassword"] = password
        client.admin_create_user(**kwargs)
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        if code == "UsernameExistsException":
            created = False
        elif code == "InvalidPasswordException":
            raise HTTPException(status_code=400, detail="Password does not meet the Cognito policy (12+ chars, upper, lower, number, symbol).")
        else:
            raise HTTPException(status_code=502, detail=f"Could not create the Cognito user ({code}).")

    # Make the password permanent (usable without a forced reset).
    if created and password and permanent:
        try:
            client.admin_set_user_password(
                UserPoolId=pool, Username=email, Password=password, Permanent=True
            )
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code == "InvalidPasswordException":
                raise HTTPException(status_code=400, detail="Password does not meet the Cognito policy (12+ chars, upper, lower, number, symbol).")
            raise HTTPException(status_code=502, detail=f"Could not set the Cognito password ({code}).")

    # Ensure the user is in the correct role group (idempotent).
    try:
        client.admin_add_user_to_group(UserPoolId=pool, Username=email, GroupName=role)
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        raise HTTPException(status_code=502, detail=f"Could not assign the Cognito role group ({code}).")


def set_user_role(email: str, new_role: str, previous_role: str | None = None) -> None:
    """Move a user to a different role group (used when an admin changes a role)."""
    email = email.strip().lower()
    new_role = new_role if new_role in VALID_ROLES else "employee"
    client = _client()
    pool = _pool_id()
    # Remove from the old group if known, then add to the new one.
    if previous_role and previous_role in VALID_ROLES and previous_role != new_role:
        try:
            client.admin_remove_user_from_group(UserPoolId=pool, Username=email, GroupName=previous_role)
        except ClientError:
            pass
    try:
        client.admin_add_user_to_group(UserPoolId=pool, Username=email, GroupName=new_role)
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        raise HTTPException(status_code=502, detail=f"Could not update the Cognito role group ({code}).")
