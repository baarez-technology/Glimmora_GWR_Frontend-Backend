import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, assert_attempt_access
from app.models.attempt import Attempt
from app.models.user import User
from app.models.witness import Witness
from app.models.evidence import Evidence
from app.models.statement import Statement
from app.models.admin import AdminEvent, AdminAdjudicator, AdminAssignment
from app.schemas.attempt import AttemptCreate, AttemptUpdate, AttemptOut, SubmissionHealth
from app.schemas.admin import AdminEventOut
from app.services.audit_service import write_audit
from app.services.gwr_logic import compute_submission_health, AttemptHealthInput, compute_logbook, LogbookRow

router = APIRouter(prefix="/attempts", tags=["attempts"])


def _gen_ref() -> str:
    return f"GWR-{uuid.uuid4().hex[:8].upper()}"


@router.get("", response_model=List[AttemptOut])
async def list_attempts(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role == "organizer":
        result = await db.execute(select(Attempt).where(Attempt.organizer_id == user.id))
        return result.scalars().all()

    if user.role == "adjudicator":
        # An adjudicator only sees attempts filed under events they are
        # assigned to (via AdminAdjudicator.user_id → AdminAssignment.event_id).
        adj_row = (await db.execute(
            select(AdminAdjudicator).where(AdminAdjudicator.user_id == user.id)
        )).scalar_one_or_none()
        if not adj_row:
            return []
        event_ids = [
            row.event_id for row in (await db.execute(
                select(AdminAssignment).where(AdminAssignment.adjudicator_id == adj_row.id)
            )).scalars().all()
        ]
        if not event_ids:
            return []
        result = await db.execute(select(Attempt).where(Attempt.event_id.in_(event_ids)))
        return result.scalars().all()

    # admin & other roles: see all
    result = await db.execute(select(Attempt))
    return result.scalars().all()


@router.get("/events/available", response_model=List[AdminEventOut])
async def list_available_events(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Events the logged-in organizer can file an Attempt against.

    Returns events where ``organizer_user_id == user.id`` OR ``organizer_user_id IS NULL``
    (admin hasn't reserved them for a specific organizer) AND status is open
    (Draft / Scheduled / Live).
    """
    q = select(AdminEvent).where(
        AdminEvent.status.in_(["Draft", "Scheduled", "Live"]),
        (AdminEvent.organizer_user_id == user.id) | (AdminEvent.organizer_user_id.is_(None)),
    ).order_by(AdminEvent.start_iso)
    return (await db.execute(q)).scalars().all()


@router.post("", response_model=AttemptOut, status_code=201)
async def create_attempt(
    body: AttemptCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # If event_id is set, validate it and snapshot defaults from the event
    # so the attempt's category/location/date stay readable even if the
    # admin event is later deleted.
    category = body.category
    description = body.description
    attempt_date = body.attempt_date
    location = body.location
    record_title = body.record_title

    if body.event_id:
        ev = await db.get(AdminEvent, body.event_id)
        if not ev:
            raise HTTPException(status_code=404, detail="Event not found")
        if ev.organizer_user_id and ev.organizer_user_id != user.id:
            raise HTTPException(status_code=403, detail="This event is reserved for a different organizer")
        category = category or ev.category
        location = location or ", ".join([p for p in [ev.venue, ev.city, ev.country] if p])
        attempt_date = attempt_date or ev.start_iso
        if not record_title:
            record_title = ev.title

    attempt = Attempt(
        id=str(uuid.uuid4()),
        application_ref=_gen_ref(),
        record_title=record_title,
        organizer_id=user.id,
        event_id=body.event_id,
        category=category,
        description=description,
        attempt_date=attempt_date,
        location=location,
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)
    await write_audit(db, "attempt.created", actor_id=user.id, target_type="attempt", target_id=attempt.id)
    return attempt


@router.get("/{attempt_id}", response_model=AttemptOut)
async def get_attempt(
    attempt_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    await assert_attempt_access(attempt, user, db)
    return attempt


@router.patch("/{attempt_id}", response_model=AttemptOut)
async def update_attempt(
    attempt_id: str,
    body: AttemptUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    await assert_attempt_access(attempt, user, db)

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(attempt, field, value)

    await db.commit()
    await db.refresh(attempt)
    await write_audit(db, "attempt.updated", actor_id=user.id, target_type="attempt", target_id=attempt_id)
    return attempt


@router.get("/{attempt_id}/health", response_model=SubmissionHealth)
async def get_health(
    attempt_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    await assert_attempt_access(attempt, user, db)

    witnesses = (await db.execute(select(Witness).where(Witness.attempt_id == attempt_id))).scalars().all()
    evidence = (await db.execute(select(Evidence).where(Evidence.attempt_id == attempt_id))).scalars().all()
    statements = (await db.execute(select(Statement).where(Statement.attempt_id == attempt_id))).scalars().all()

    from app.models.activity import ActivityRow, RestRow
    act_rows = (await db.execute(select(ActivityRow).where(ActivityRow.attempt_id == attempt_id))).scalars().all()
    rest_rows = (await db.execute(select(RestRow).where(RestRow.attempt_id == attempt_id))).scalars().all()

    logbook = compute_logbook(
        [LogbookRow("activity", r.sequence, r.start_hhmm, r.end_hhmm, r.notes) for r in act_rows],
        [LogbookRow("rest", r.sequence, r.start_hhmm, r.end_hhmm, r.notes) for r in rest_rows],
    )

    data = AttemptHealthInput(
        witness_count=len(witnesses),
        witness_completed_count=sum(1 for w in witnesses if w.status == "completed"),
        evidence_count=len(evidence),
        evidence_indexed_count=sum(1 for e in evidence if e.status == "indexed"),
        statement_count=len(statements),
        logbook_violations=logbook.violations,
    )
    return compute_submission_health(data)
