from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, field_validator


MemberRole = Literal["member", "admin", "pm"]
MemberStatus = Literal["active", "inactive"]


class MemberCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    email: Optional[str] = None
    project_id: Optional[str] = None
    role: Optional[MemberRole] = None
    user_role: Optional[MemberRole] = None
    project_role: Optional[MemberRole] = None
    status: MemberStatus = "active"

    @field_validator("name", "email", "project_id", mode="before")
    @classmethod
    def strip_optional_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class MemberUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[MemberRole] = None
    user_role: Optional[MemberRole] = None
    project_role: Optional[MemberRole] = None
    status: Optional[MemberStatus] = None

    @field_validator("name", "email", mode="before")
    @classmethod
    def strip_optional_text(cls, value):
        return value.strip() if isinstance(value, str) else value
