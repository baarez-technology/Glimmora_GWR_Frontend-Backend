"""
GWR Operations Admin console — events, adjudicators, assignments, tracking.

All routes require admin role.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.models.admin import (
    AdminEvent, AdminAdjudicator, AdminAssignment,
    AdjudicatorLocation, AdjudicatorCheckIn,
)
from app.models.notification import Notification
from app.models.user import User
from app.services.auth_service import hash_password
from app.services.email_service import send_notification_email
import secrets
from app.schemas.admin import (
    AdminEventCreate, AdminEventUpdate, AdminEventOut,
    AdminAdjudicatorCreate, AdminAdjudicatorUpdate, AdminAdjudicatorOut,
    AdminAssignmentCreate, AdminAssignmentUpdate, AdminAssignmentOut,
    LocationPing, LocationOut, CheckInOut, AdminUserOut,
)


router = APIRouter(prefix="/admin", tags=["admin"])


# ============================================================
# Users (admin-only roster lookup, used by event/assignment forms)
# ============================================================
@router.get("/users", response_model=List[AdminUserOut])
async def list_users(
    role: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    q = select(User).order_by(User.created_at.desc())
    if role:
        q = q.where(User.role == role)
    return (await db.execute(q)).scalars().all()


# ============================================================
# Events
# ============================================================
@router.get("/events", response_model=List[AdminEventOut])
async def list_events(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    q = select(AdminEvent).order_by(AdminEvent.created_at.desc())
    if status:
        q = q.where(AdminEvent.status == status)
    return (await db.execute(q)).scalars().all()


@router.get("/events/{event_id}", response_model=AdminEventOut)
async def get_event(event_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    ev = await db.get(AdminEvent, event_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    return ev


@router.post("/events", response_model=AdminEventOut, status_code=201)
async def create_event(
    body: AdminEventCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    data = body.model_dump(exclude_unset=True)
    if not data.get("id"):
        data.pop("id", None)
    ev = AdminEvent(**data)
    db.add(ev)
    await db.commit()
    await db.refresh(ev)
    return ev


@router.patch("/events/{event_id}", response_model=AdminEventOut)
async def update_event(
    event_id: str,
    body: AdminEventUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    ev = await db.get(AdminEvent, event_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(ev, k, v)
    await db.commit()
    await db.refresh(ev)
    return ev


@router.delete("/events/{event_id}", status_code=204)
async def delete_event(event_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    ev = await db.get(AdminEvent, event_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.delete(ev)
    await db.commit()
    return None


# ============================================================
# Adjudicators
# ============================================================
@router.get("/adjudicators", response_model=List[AdminAdjudicatorOut])
async def list_adjudicators(
    region: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    q = select(AdminAdjudicator).order_by(AdminAdjudicator.created_at.desc())
    if region:
        q = q.where(AdminAdjudicator.region == region)
    return (await db.execute(q)).scalars().all()


@router.get("/adjudicators/{adj_id}", response_model=AdminAdjudicatorOut)
async def get_adjudicator(adj_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    a = await db.get(AdminAdjudicator, adj_id)
    if not a:
        raise HTTPException(status_code=404, detail="Adjudicator not found")
    return a


@router.post("/adjudicators", response_model=AdminAdjudicatorOut, status_code=201)
async def create_adjudicator(
    body: AdminAdjudicatorCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    data = body.model_dump(exclude_unset=True)
    if not data.get("id"):
        data.pop("id", None)

    # Auto-provision a User account so the adjudicator can actually log in.
    # If admin passed an explicit user_id, link to that; otherwise look up
    # by email or create a fresh user with a one-time temporary password.
    user_id = data.get("user_id")
    temp_password: Optional[str] = None
    if not user_id and data.get("email"):
        existing = (await db.execute(select(User).where(User.email == data["email"]))).scalar_one_or_none()
        if existing:
            user_id = existing.id
            if existing.role != "adjudicator":
                existing.role = "adjudicator"
        else:
            temp_password = secrets.token_urlsafe(10)
            new_user = User(
                email=data["email"],
                role="adjudicator",
                full_name=data.get("name"),
                password_hash=hash_password(temp_password),
                is_active=True,
            )
            db.add(new_user)
            await db.flush()
            user_id = new_user.id
        data["user_id"] = user_id

    a = AdminAdjudicator(**data)
    db.add(a)
    await db.commit()
    await db.refresh(a)

    if temp_password:
        await send_notification_email(
            data["email"],
            "Your GWR Adjudicator account is ready",
            f"Hello {data.get('name') or ''},<br><br>"
            f"An administrator has provisioned an adjudicator account for you on the GWR portal.<br><br>"
            f"<b>Sign in details</b><br>"
            f"Username: {data['email']}<br>"
            f"Temporary password: <code>{temp_password}</code><br><br>"
            f"Please sign in and change your password.",
        )
    return a


@router.patch("/adjudicators/{adj_id}", response_model=AdminAdjudicatorOut)
async def update_adjudicator(
    adj_id: str,
    body: AdminAdjudicatorUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    a = await db.get(AdminAdjudicator, adj_id)
    if not a:
        raise HTTPException(status_code=404, detail="Adjudicator not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    await db.commit()
    await db.refresh(a)
    return a


@router.delete("/adjudicators/{adj_id}", status_code=204)
async def delete_adjudicator(adj_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    a = await db.get(AdminAdjudicator, adj_id)
    if not a:
        raise HTTPException(status_code=404, detail="Adjudicator not found")
    await db.delete(a)
    await db.commit()
    return None


# ============================================================
# Assignments
# ============================================================
@router.get("/assignments", response_model=List[AdminAssignmentOut])
async def list_assignments(
    event_id: Optional[str] = None,
    adjudicator_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    q = select(AdminAssignment).order_by(AdminAssignment.assigned_at.desc())
    if event_id:
        q = q.where(AdminAssignment.event_id == event_id)
    if adjudicator_id:
        q = q.where(AdminAssignment.adjudicator_id == adjudicator_id)
    return (await db.execute(q)).scalars().all()


@router.post("/assignments", response_model=AdminAssignmentOut, status_code=201)
async def create_assignment(
    body: AdminAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    # Reject duplicate (same event + same adjudicator)
    existing = (await db.execute(
        select(AdminAssignment).where(
            AdminAssignment.event_id == body.event_id,
            AdminAssignment.adjudicator_id == body.adjudicator_id,
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Adjudicator already assigned to this event")

    ev = await db.get(AdminEvent, body.event_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    adj = await db.get(AdminAdjudicator, body.adjudicator_id)
    if not adj:
        raise HTTPException(status_code=404, detail="Adjudicator not found")

    a = AdminAssignment(**body.model_dump())
    db.add(a)
    await db.commit()
    await db.refresh(a)

    # Notify admin user (and adjudicator if they have a user_id)
    notif = Notification(
        user_id=admin.id,
        title=f"Assigned {adj.name}",
        detail=f"{a.role} on {ev.title}",
        tone="info",
        link=f"/admin/events/{ev.id}",
    )
    db.add(notif)
    if adj.user_id:
        db.add(Notification(
            user_id=adj.user_id,
            title=f"You've been assigned to {ev.title}",
            detail=f"Role: {a.role} · {ev.city or ''}",
            tone="info",
            link=f"/admin/events/{ev.id}",
        ))
    await db.commit()

    return a


@router.patch("/assignments/{asn_id}", response_model=AdminAssignmentOut)
async def update_assignment(
    asn_id: str,
    body: AdminAssignmentUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    a = await db.get(AdminAssignment, asn_id)
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    await db.commit()
    await db.refresh(a)
    return a


@router.delete("/assignments/{asn_id}", status_code=204)
async def delete_assignment(asn_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    a = await db.get(AdminAssignment, asn_id)
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    await db.delete(a)
    await db.commit()
    return None


# ============================================================
# Tracking
# ============================================================
@router.get("/tracking/locations", response_model=List[LocationOut])
async def list_locations(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    return (await db.execute(select(AdjudicatorLocation))).scalars().all()


@router.post("/tracking/{adj_id}/ping", response_model=LocationOut)
async def ping_location(
    adj_id: str,
    body: LocationPing,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    adj = await db.get(AdminAdjudicator, adj_id)
    if not adj:
        raise HTTPException(status_code=404, detail="Adjudicator not found")

    loc = await db.get(AdjudicatorLocation, adj_id)
    if loc:
        loc.lat = body.lat
        loc.lon = body.lon
        if body.city is not None: loc.city = body.city
        if body.country is not None: loc.country = body.country
        loc.travel_status = body.travel_status
        if body.accuracy_m is not None: loc.accuracy_m = body.accuracy_m
        if body.battery_pct is not None: loc.battery_pct = body.battery_pct
        loc.last_ping_iso = datetime.utcnow()
    else:
        loc = AdjudicatorLocation(
            adjudicator_id=adj_id,
            lat=body.lat, lon=body.lon,
            city=body.city, country=body.country,
            travel_status=body.travel_status,
            accuracy_m=body.accuracy_m or 50,
            battery_pct=body.battery_pct or 100,
            consent=True,
        )
        db.add(loc)

    db.add(AdjudicatorCheckIn(
        adjudicator_id=adj_id,
        city=body.city, country=body.country,
        travel_status=body.travel_status,
        note=body.note,
    ))
    await db.commit()
    await db.refresh(loc)
    return loc


@router.post("/tracking/{adj_id}/consent", response_model=LocationOut)
async def toggle_consent(
    adj_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    loc = await db.get(AdjudicatorLocation, adj_id)
    if not loc:
        raise HTTPException(status_code=404, detail="No location data for adjudicator")
    loc.consent = not loc.consent
    await db.commit()
    await db.refresh(loc)
    return loc


@router.get("/tracking/checkins", response_model=List[CheckInOut])
async def list_checkins(
    adjudicator_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    q = select(AdjudicatorCheckIn).order_by(AdjudicatorCheckIn.ts.desc()).limit(limit)
    if adjudicator_id:
        q = q.where(AdjudicatorCheckIn.adjudicator_id == adjudicator_id)
    return (await db.execute(q)).scalars().all()
