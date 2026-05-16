from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, EmailStr


# ---------- Events ----------
class AdminEventBase(BaseModel):
    title: str
    category: str = "Other"
    organizer: Optional[str] = None
    organizer_user_id: Optional[str] = None
    venue: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    timezone: str = "UTC"
    lat: float = 0.0
    lon: float = 0.0
    start_iso: Optional[str] = None
    end_iso: Optional[str] = None
    status: str = "Draft"
    priority: str = "Standard"
    participant_count: int = 1
    required_adjudicators: int = 1
    description: Optional[str] = None
    geofence_radius_m: int = 250


class AdminEventCreate(AdminEventBase):
    id: Optional[str] = None


class AdminEventUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    organizer: Optional[str] = None
    organizer_user_id: Optional[str] = None
    venue: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    start_iso: Optional[str] = None
    end_iso: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    participant_count: Optional[int] = None
    required_adjudicators: Optional[int] = None
    description: Optional[str] = None
    geofence_radius_m: Optional[int] = None


class AdminEventOut(AdminEventBase):
    id: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ---------- Adjudicators ----------
class AdminAdjudicatorBase(BaseModel):
    name: str
    email: EmailStr
    initials: str = "AA"
    home_city: Optional[str] = None
    home_country: Optional[str] = None
    region: str = "Europe"
    specialties: List[str] = []
    languages: List[str] = []
    certifications: List[str] = []
    rating: float = 4.5
    years_experience: int = 1
    status: str = "Active"


class AdminAdjudicatorCreate(AdminAdjudicatorBase):
    id: Optional[str] = None
    user_id: Optional[str] = None


class AdminAdjudicatorUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    initials: Optional[str] = None
    home_city: Optional[str] = None
    home_country: Optional[str] = None
    region: Optional[str] = None
    specialties: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    certifications: Optional[List[str]] = None
    rating: Optional[float] = None
    years_experience: Optional[int] = None
    status: Optional[str] = None


class AdminAdjudicatorOut(AdminAdjudicatorBase):
    id: str
    user_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ---------- Assignments ----------
class AdminAssignmentCreate(BaseModel):
    event_id: str
    adjudicator_id: str
    role: str = "Adjudicator"
    note: Optional[str] = None


class AdminAssignmentUpdate(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None
    note: Optional[str] = None


class AdminAssignmentOut(BaseModel):
    id: str
    event_id: str
    adjudicator_id: str
    role: str
    status: str
    note: Optional[str] = None
    assigned_at: datetime
    model_config = {"from_attributes": True}


# ---------- Tracking ----------
class LocationPing(BaseModel):
    lat: float
    lon: float
    city: Optional[str] = None
    country: Optional[str] = None
    travel_status: str = "Available"
    accuracy_m: Optional[int] = None
    battery_pct: Optional[int] = None
    note: Optional[str] = None


class LocationOut(BaseModel):
    adjudicator_id: str
    lat: float
    lon: float
    city: Optional[str] = None
    country: Optional[str] = None
    travel_status: str
    accuracy_m: int
    consent: bool
    battery_pct: int
    last_ping_iso: datetime
    model_config = {"from_attributes": True}


class CheckInOut(BaseModel):
    id: str
    adjudicator_id: str
    ts: datetime
    city: Optional[str] = None
    country: Optional[str] = None
    travel_status: str
    note: Optional[str] = None
    model_config = {"from_attributes": True}


# ---------- Users (admin-readable user roster) ----------
class AdminUserOut(BaseModel):
    id: str
    email: EmailStr
    role: str
    full_name: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    model_config = {"from_attributes": True}


# ---------- Admin settings ----------
class AdminSettings(BaseModel):
    default_geofence_m: int = 250
    overdue_checkin_hours: int = 4
    low_battery_pct: int = 25
    lead_assignment_sla_days: int = 14
    audit_retention_days: int = 365
    email_on_assign: bool = True
    consent_requires_approval: bool = False
