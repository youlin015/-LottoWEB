import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime, ARRAY, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


def _now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )

    recommendations: Mapped[list["Recommendation"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    preferences: Mapped[list["Preference"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    game_id: Mapped[str] = mapped_column(String(20), nullable=False)
    numbers: Mapped[list[int]] = mapped_column(ARRAY(Integer), nullable=False)
    special: Mapped[int | None] = mapped_column(Integer, nullable=True)
    exclude_nums: Mapped[list[int]] = mapped_column(ARRAY(Integer), default=list)
    exclude_sp: Mapped[list[int]] = mapped_column(ARRAY(Integer), default=list)
    ratio: Mapped[str] = mapped_column(String(10), default="ALL")
    limit_used: Mapped[int] = mapped_column(Integer, default=100)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )

    user: Mapped["User"] = relationship(back_populates="recommendations")


class Preference(Base):
    __tablename__ = "preferences"
    __table_args__ = (UniqueConstraint("user_id", "game_id", name="uq_user_game"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    game_id: Mapped[str] = mapped_column(String(20), nullable=False)
    exclude_nums: Mapped[list[int]] = mapped_column(ARRAY(Integer), default=list)
    exclude_sp: Mapped[list[int]] = mapped_column(ARRAY(Integer), default=list)
    ratio: Mapped[str] = mapped_column(String(10), default="ALL")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )

    user: Mapped["User"] = relationship(back_populates="preferences")
