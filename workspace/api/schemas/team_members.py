from pydantic import BaseModel, ConfigDict, EmailStr


class TeamMemberResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    name: str
    email: EmailStr
    is_active: bool
