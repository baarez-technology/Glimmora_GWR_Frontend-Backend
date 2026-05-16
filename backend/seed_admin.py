"""
Seed the admin domain (events, adjudicators, assignments, locations) with
realistic demo data so the GWR Operations console has something to show on
first run. Idempotent — safe to re-run.

Usage:   python seed_admin.py
"""
import asyncio
from datetime import datetime, timedelta

from sqlalchemy import select

from app.database import AsyncSessionLocal, create_tables
from app.models.admin import (
    AdminEvent, AdminAdjudicator, AdminAssignment,
    AdjudicatorLocation, AdjudicatorCheckIn,
)
from app.models.user import User
from app.services.auth_service import hash_password


DEMO_USERS = [
    dict(email="admin@gwr.com",       password="Admin@123",       role="admin",       full_name="Vaigai Ramesh"),
    dict(email="organizer@gwr.com",   password="Organizer@123",   role="organizer",   full_name="Aurora Events Organizer"),
    dict(email="adjudicator@gwr.com", password="Adjudicator@123", role="adjudicator", full_name="Eleanor Whitfield"),
    dict(email="witness@gwr.com",     password="Witness@123",     role="witness",     full_name="Demo Witness"),
]


EVENTS = [
    dict(id="GWR-2026-0411", title="Longest continuous violin performance by an ensemble",
         category="Music & Performing Arts", organizer="Aurora Events International",
         venue="Royal Albert Hall · Main Stage", city="London", country="United Kingdom",
         timezone="Europe/London", lat=51.5009, lon=-0.1773,
         start_iso="2026-05-12T09:00:00Z", end_iso="2026-05-15T09:00:00Z",
         status="Live", priority="Flagship", participant_count=24, required_adjudicators=2,
         description="72-hour continuous ensemble violin performance.", geofence_radius_m=200),
    dict(id="GWR-2026-0418", title="Largest simultaneous origami crane folding",
         category="Mass Participation", organizer="Origami Tokyo Foundation",
         venue="Tokyo Big Sight · Hall A", city="Tokyo", country="Japan",
         timezone="Asia/Tokyo", lat=35.6298, lon=139.7937,
         start_iso="2026-05-22T01:00:00Z", end_iso="2026-05-22T04:00:00Z",
         status="Scheduled", priority="High", participant_count=4280, required_adjudicators=3,
         description="Coordinated mass attempt with steward sign-off per zone.", geofence_radius_m=500),
    dict(id="GWR-2026-0501", title="Fastest marathon in a full firefighter uniform",
         category="Athletics", organizer="Berlin Fire & Rescue Athletics",
         venue="Berlin Marathon Route", city="Berlin", country="Germany",
         timezone="Europe/Berlin", lat=52.52, lon=13.405,
         start_iso="2026-05-31T08:00:00Z", end_iso="2026-05-31T13:30:00Z",
         status="Scheduled", priority="Standard", participant_count=1, required_adjudicators=2,
         description="Solo PPE marathon attempt with continuous GPS tracking.", geofence_radius_m=1500),
    dict(id="GWR-2026-0612", title="Largest underwater clean-up by certified divers",
         category="Environment", organizer="Dubai Reef Initiative",
         venue="Palm Jumeirah Reef Zone", city="Dubai", country="United Arab Emirates",
         timezone="Asia/Dubai", lat=25.1124, lon=55.139,
         start_iso="2026-06-12T05:00:00Z", end_iso="2026-06-12T13:00:00Z",
         status="Scheduled", priority="High", participant_count=640, required_adjudicators=2,
         description="Coordinated diving teams across 12 zones.", geofence_radius_m=800),
    dict(id="GWR-2026-0704", title="Longest line of robot dancers in unison",
         category="Technology", organizer="SoCal Robotics Collective",
         venue="Santa Monica Pier", city="Los Angeles", country="United States",
         timezone="America/Los_Angeles", lat=34.0089, lon=-118.4973,
         start_iso="2026-07-04T18:00:00Z", end_iso="2026-07-04T20:00:00Z",
         status="Scheduled", priority="Standard", participant_count=422, required_adjudicators=1,
         description="Synchronised robot choreography record attempt.", geofence_radius_m=300),
]


ADJUDICATORS = [
    dict(id="ADJ-001", name="Eleanor Whitfield", email="adjudicator@gwr.com",
         initials="EW", home_city="London", home_country="United Kingdom", region="Europe",
         specialties=["Music & Performing Arts", "Athletics"], languages=["English", "French"],
         certifications=["GWR Senior Adjudicator", "Time-keeping Lvl 3"],
         rating=4.9, years_experience=12, status="Active"),
    dict(id="ADJ-002", name="Kenji Watanabe", email="k.watanabe@gwr.com",
         initials="KW", home_city="Tokyo", home_country="Japan", region="Asia-Pacific",
         specialties=["Mass Participation", "Technology"], languages=["Japanese", "English", "Mandarin"],
         certifications=["GWR Adjudicator", "Mass-event coordination"],
         rating=4.8, years_experience=9, status="Active"),
    dict(id="ADJ-003", name="Sofia Marquez", email="s.marquez@gwr.com",
         initials="SM", home_city="Madrid", home_country="Spain", region="Europe",
         specialties=["Acrobatics", "Music & Performing Arts"], languages=["Spanish", "English", "Portuguese"],
         certifications=["GWR Adjudicator", "Outdoor-safety officer"],
         rating=4.7, years_experience=7, status="Active"),
    dict(id="ADJ-004", name="Daniel O'Connor", email="d.oconnor@gwr.com",
         initials="DO", home_city="New York", home_country="United States", region="Americas",
         specialties=["Athletics", "Technology"], languages=["English"],
         certifications=["GWR Senior Adjudicator"],
         rating=4.6, years_experience=11, status="Active"),
    dict(id="ADJ-005", name="Amal Hassan", email="a.hassan@gwr.com",
         initials="AH", home_city="Dubai", home_country="United Arab Emirates", region="MEA",
         specialties=["Environment", "Mass Participation"], languages=["Arabic", "English"],
         certifications=["GWR Adjudicator", "Marine-event certified"],
         rating=4.85, years_experience=8, status="Active"),
]

ASSIGNMENTS = [
    dict(id="ASN-001", event_id="GWR-2026-0411", adjudicator_id="ADJ-001",
         role="Lead Adjudicator", status="On-site", note="Lead — owns ratification call."),
    dict(id="ASN-002", event_id="GWR-2026-0411", adjudicator_id="ADJ-003",
         role="Observer", status="On-site"),
    dict(id="ASN-003", event_id="GWR-2026-0418", adjudicator_id="ADJ-002",
         role="Lead Adjudicator", status="Travelling"),
    dict(id="ASN-005", event_id="GWR-2026-0501", adjudicator_id="ADJ-004",
         role="Lead Adjudicator", status="Assigned"),
    dict(id="ASN-006", event_id="GWR-2026-0612", adjudicator_id="ADJ-005",
         role="Lead Adjudicator", status="Assigned"),
]

LOCATIONS = [
    dict(adjudicator_id="ADJ-001", lat=51.5009, lon=-0.1773, city="London", country="United Kingdom",
         travel_status="On-site", accuracy_m=12, consent=True, battery_pct=78),
    dict(adjudicator_id="ADJ-002", lat=35.5494, lon=139.7798, city="Tokyo (Haneda Apt)", country="Japan",
         travel_status="Travelling", accuracy_m=42, consent=True, battery_pct=64),
    dict(adjudicator_id="ADJ-003", lat=51.4975, lon=-0.176, city="London", country="United Kingdom",
         travel_status="On-site", accuracy_m=18, consent=True, battery_pct=51),
    dict(adjudicator_id="ADJ-004", lat=40.7128, lon=-74.006, city="New York", country="United States",
         travel_status="Available", accuracy_m=25, consent=True, battery_pct=88),
    dict(adjudicator_id="ADJ-005", lat=25.2048, lon=55.2708, city="Dubai", country="United Arab Emirates",
         travel_status="Assigned", accuracy_m=30, consent=True, battery_pct=92),
]


async def upsert():
    async with AsyncSessionLocal() as db:
        # 1) Demo users (idempotent by email)
        user_by_email: dict[str, User] = {}
        for u in DEMO_USERS:
            existing = (await db.execute(
                select(User).where(User.email == u["email"])
            )).scalar_one_or_none()
            if existing:
                user_by_email[u["email"]] = existing
                continue
            row = User(
                email=u["email"],
                password_hash=hash_password(u["password"]),
                role=u["role"],
                full_name=u["full_name"],
            )
            db.add(row)
            user_by_email[u["email"]] = row
        await db.commit()
        for row in user_by_email.values():
            await db.refresh(row)

        organizer_user = user_by_email.get("organizer@gwr.com")
        adjudicator_user = user_by_email.get("adjudicator@gwr.com")

        # 2) Events — assign first two events to the demo organizer so they
        # show up in the organizer's "available events" dropdown.
        for idx, ev in enumerate(EVENTS):
            existing = await db.get(AdminEvent, ev["id"])
            if existing:
                continue
            data = dict(ev)
            if organizer_user and idx < 2:
                data["organizer_user_id"] = organizer_user.id
            db.add(AdminEvent(**data))

        # 3) Adjudicator roster — wire ADJ-001 to the demo adjudicator user
        for a in ADJUDICATORS:
            existing = await db.get(AdminAdjudicator, a["id"])
            if existing:
                continue
            data = dict(a)
            if a["id"] == "ADJ-001" and adjudicator_user:
                data["user_id"] = adjudicator_user.id
            db.add(AdminAdjudicator(**data))
        await db.commit()

        for asn in ASSIGNMENTS:
            existing = await db.get(AdminAssignment, asn["id"])
            if not existing:
                db.add(AdminAssignment(**asn))
        for loc in LOCATIONS:
            existing = await db.get(AdjudicatorLocation, loc["adjudicator_id"])
            if not existing:
                db.add(AdjudicatorLocation(**loc))
        await db.commit()

        # Sprinkle a few check-ins
        for loc in LOCATIONS:
            db.add(AdjudicatorCheckIn(
                adjudicator_id=loc["adjudicator_id"],
                city=loc["city"], country=loc["country"],
                travel_status=loc["travel_status"],
                note="Initial seed check-in",
            ))
        await db.commit()

        # Counts
        events = (await db.execute(select(AdminEvent))).scalars().all()
        adjs = (await db.execute(select(AdminAdjudicator))).scalars().all()
        asns = (await db.execute(select(AdminAssignment))).scalars().all()
        locs = (await db.execute(select(AdjudicatorLocation))).scalars().all()
        print(f"Events: {len(events)} · Adjudicators: {len(adjs)} · Assignments: {len(asns)} · Locations: {len(locs)}")


if __name__ == "__main__":
    asyncio.run(create_tables())
    asyncio.run(upsert())
    print("OK")
