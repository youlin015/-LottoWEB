import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


# ─── Auth ────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    display_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    display_name: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ─── Recommendations ─────────────────────────────────────────────────────────

class RecommendationCreate(BaseModel):
    numbers: list[int]
    special: Optional[int] = None
    exclude_nums: list[int] = []
    exclude_sp: list[int] = []
    ratio: str = "ALL"
    limit_used: int = 100


class RecommendationOut(BaseModel):
    id: uuid.UUID
    game_id: str
    numbers: list[int]
    special: Optional[int]
    exclude_nums: list[int]
    exclude_sp: list[int]
    ratio: str
    limit_used: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Preferences ─────────────────────────────────────────────────────────────

class PreferenceUpdate(BaseModel):
    exclude_nums: list[int] = []
    exclude_sp: list[int] = []
    ratio: str = "ALL"


class PreferenceOut(BaseModel):
    game_id: str
    exclude_nums: list[int]
    exclude_sp: list[int]
    ratio: str
    updated_at: datetime

    model_config = {"from_attributes": True}
