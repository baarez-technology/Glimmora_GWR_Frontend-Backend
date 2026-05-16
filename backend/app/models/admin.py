"""
Admin-domain models: events, adjudicator roster, assignments, live tracking.

Distinct from the organizer/witness "attempts" workflow — these power the
GWR Operations Admin console (mission control, calendar, live tracking).
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, Float, Boolean, DateTime, ForeignKey, Text, func, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


class AdminEvent(Base):
    __tablename__ = "admin_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: _new_id("EVT"))
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    category: Mapped[str] = mapped_column(String(120), default="Other")
    organizer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # Optional FK to a real organizer User account — when set, that organizer
    # sees this event in their dashboard and can file an Attempt against it.
    organizer_user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    venue: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    lat: Mapped[float] = mapped_column(Float, default=0.0)
    lon: Mapped[float] = mapped_column(Float, default=0.0)
    start_iso: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    end_iso: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    # Draft | Scheduled | Live | Completed | Cancelled
    status: Mapped[str] = mapped_column(String(40), default="Draft")
    # Low | Standard | High | Flagship
    priority: Mapped[str] = mapped_column(String(20), default="Standard")
    participant_count: Mapped[int] = mapped_column(Integer, default=1)
    required_adjudicators: Mapped[int] = mapped_column(Integer, default=1)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    geofence_radius_m: Mapped[int] = mapped_column(Integer, default=250)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class AdminAdjudicator(Base):
    __tablename__ = "admin_adjudicators"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: _new_id("ADJ"))
    # Optional FK to users.id for adjudicators who also log in.
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    initials: Mapped[str] = mapped_column(String(8), default="AA")
    home_city: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    home_country: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    # Europe | Americas | Asia-Pacific | MEA
    region: Mapped[str] = mapped_column(String(40), default="Europe")
    specialties: Mapped[list] = mapped_column(JSON, default=list)
    languages: Mapped[list] = mapped_column(JSON, default=list)
    certifications: Mapped[list] = mapped_column(JSON, default=list)
    rating: Mapped[float] = mapped_column(Float, default=4.5)
    years_experience: Mapped[int] = mapped_column(Integer, default=1)
    # Active | On leave | Suspended
    status: Mapped[str] = mapped_column(String(40), default="Active")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class AdminAssignment(Base):
    __tablename__ = "admin_assignments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: _new_id("ASN"))
    event_id: Mapped[str] = mapped_column(String(64), ForeignKey("admin_events.id", ondelete="CASCADE"), nullable=False)
    adjudicator_id: Mapped[str] = mapped_column(String(64), ForeignKey("admin_adjudicators.id", ondelete="CASCADE"), nullable=False)
    # Lead Adjudicator | Adjudicator | Observer
    role: Mapped[str] = mapped_column(String(40), default="Adjudicator")
    # Assigned | Travelling | On-site | Completed | Cancelled
    status: Mapped[str] = mapped_column(String(40), default="Assigned")
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class AdjudicatorLocation(Base):
    __tablename__ = "adjudicator_locations"

    # One row per adjudicator — represents the *current* position.
    adjudicator_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("admin_adjudicators.id", ondelete="CASCADE"), primary_key=True
    )
    lat: Mapped[float] = mapped_column(Float, default=0.0)
    lon: Mapped[float] = mapped_column(Float, default=0.0)
    city: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    # Available | Assigned | Travelling | On-site | Completed | Off-duty
    travel_status: Mapped[str] = mapped_column(String(40), default="Available")
    accuracy_m: Mapped[int] = mapped_column(Integer, default=50)
    consent: Mapped[bool] = mapped_column(Boolean, default=True)
    battery_pct: Mapped[int] = mapped_column(Integer, default=100)
    last_ping_iso: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class AdjudicatorCheckIn(Base):
    __tablename__ = "adjudicator_checkins"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: _new_id("CHK"))
    adjudicator_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("admin_adjudicators.id", ondelete="CASCADE"), nullable=False
    )
    ts: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    city: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    travel_status: Mapped[str] = mapped_column(String(40), default="Available")
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
