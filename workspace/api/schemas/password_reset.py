from pydantic import BaseModel, EmailStr, Field


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=6, max_length=200)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=12, max_length=200)