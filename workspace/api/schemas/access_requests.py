from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class AccessRequestCreate(BaseModel):
	name: str = Field(min_length=1, max_length=100)
	email: EmailStr
	password: str = Field(min_length=6, max_length=200)
	role: str = Field(pattern="^(employee|support)$")
	message: str | None = Field(default=None, max_length=1000)


class AccessRequestReview(BaseModel):
	status: str = Field(pattern="^(approved|rejected)$")
	review_note: str | None = Field(default=None, max_length=1000)


class AccessRequestResponse(BaseModel):
	model_config = ConfigDict(extra="ignore")

	id: int
	name: str
	email: EmailStr
	role: str
	message: str | None
	status: str
	created_at: datetime
	reviewed_at: datetime | None
	reviewed_by: int | None
	review_note: str | None
	# Returned only when an access request is approved: the temporary password
	# the admin must relay to the new user (they change it on first login).
	temporary_password: str | None = None
