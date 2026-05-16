import logging
import uuid
from datetime import datetime, timezone
from typing import List

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, assert_attempt_access
from app.models.admin import AdminEvent
from app.models.attempt import Attempt
from app.models.user import User
from app.models.witness import Witness
from app.schemas.witness import WitnessCreate, WitnessBulkCreate, WitnessUpdate, WitnessOut, WitnessReview
from app.services.auth_service import create_magic_link_token
from app.services.email_service import (
    send_magic_link,
    send_witness_decision_email,
    send_attempt_status_email,
)
from app.services.audit_service import write_audit
from app.services.notification_service import notify

router = APIRouter(prefix="/attempts/{attempt_id}/witnesses", tags=["witnesses"])


async def _get_attempt(attempt_id: str, db: AsyncSession, user: User) -> Attempt:
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    await assert_attempt_access(attempt, user, db)
    return attempt


async def _get_event_title(attempt: Attempt, db: AsyncSession) -> str | None:
    if not attempt.event_id:
        return None
    row = (await db.execute(select(AdminEvent).where(AdminEvent.id == attempt.event_id))).scalar_one_or_none()
    return row.title if row else None


@router.get("", response_model=List[WitnessOut])
async def list_witnesses(
    attempt_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _get_attempt(attempt_id, db, user)
    result = await db.execute(select(Witness).where(Witness.attempt_id == attempt_id))
    return result.scalars().all()


@router.post("", response_model=WitnessOut, status_code=201)
async def invite_witness(
    attempt_id: str,
    body: WitnessCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    attempt = await _get_attempt(attempt_id, db, user)
    witness_id = str(uuid.uuid4())
    will_email = body.send_email
    witness = Witness(
        id=witness_id,
        attempt_id=attempt_id,
        role=body.role,
        full_name=body.full_name,
        email=body.email,
        phone=body.phone,
        organisation=body.organisation,
        expertise=body.expertise,
        status="invited" if will_email else "pending",
        token=create_magic_link_token(witness_id),
        invited_at=datetime.now(timezone.utc) if will_email else None,
    )
    db.add(witness)
    await db.commit()
    await db.refresh(witness)

    if will_email:
        event_title = await _get_event_title(attempt, db)
        await send_magic_link(witness.email, witness.full_name, witness.token, attempt.record_title, event_title)
        await write_audit(db, "witness.invited", actor_id=user.id, target_type="witness", target_id=witness.id)
        await notify(
            db,
            user_id=attempt.organizer_id,
            title=f"Witness invited",
            detail=f"Invitation sent to {witness.full_name} ({witness.email}).",
            tone="info",
            link="/witnesses",
        )
        await db.commit()
    else:
        await write_audit(db, "witness.created", actor_id=user.id, target_type="witness", target_id=witness.id)
    return witness


@router.post("/bulk", response_model=List[WitnessOut], status_code=201)
async def bulk_invite(
    attempt_id: str,
    body: WitnessBulkCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    attempt = await _get_attempt(attempt_id, db, user)
    created = []
    for w in body.witnesses:
        witness = Witness(
            id=str(uuid.uuid4()),
            attempt_id=attempt_id,
            role=w.role,
            full_name=w.full_name,
            email=w.email,
            phone=w.phone,
            organisation=w.organisation,
            expertise=w.expertise,
            status="invited",
            invited_at=datetime.now(timezone.utc),
        )
        witness.token = create_magic_link_token(witness.id)
        db.add(witness)
        created.append(witness)
    await db.commit()
    event_title = await _get_event_title(attempt, db)
    for w in created:
        await db.refresh(w)
        await send_magic_link(w.email, w.full_name, w.token, attempt.record_title, event_title)
    return created


@router.patch("/{witness_id}", response_model=WitnessOut)
async def update_witness(
    attempt_id: str,
    witness_id: str,
    body: WitnessUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _get_attempt(attempt_id, db, user)
    result = await db.execute(
        select(Witness).where(Witness.id == witness_id, Witness.attempt_id == attempt_id)
    )
    witness = result.scalar_one_or_none()
    if not witness:
        raise HTTPException(status_code=404, detail="Witness not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(witness, field, value)

    await db.commit()
    await db.refresh(witness)
    return witness


@router.post("/{witness_id}/invite", response_model=WitnessOut)
async def resend_invite(
    attempt_id: str,
    witness_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    attempt = await _get_attempt(attempt_id, db, user)
    result = await db.execute(
        select(Witness).where(Witness.id == witness_id, Witness.attempt_id == attempt_id)
    )
    witness = result.scalar_one_or_none()
    if not witness:
        raise HTTPException(status_code=404, detail="Witness not found")

    witness.token = create_magic_link_token(witness.id)
    witness.invited_at = datetime.now(timezone.utc)
    witness.status = "invited"
    await db.commit()
    await db.refresh(witness)
    event_title = await _get_event_title(attempt, db)
    await send_magic_link(witness.email, witness.full_name, witness.token, attempt.record_title, event_title)
    return witness


@router.post("/{witness_id}/review", response_model=WitnessOut)
async def review_witness(
    attempt_id: str,
    witness_id: str,
    body: WitnessReview,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Adjudicator records an approval / rejection / clarification request."""
    if user.role not in ("adjudicator", "admin"):
        raise HTTPException(status_code=403, detail="Adjudicator access required")
    await _get_attempt(attempt_id, db, user)
    if body.decision not in ("approved", "rejected", "clarification_requested"):
        raise HTTPException(status_code=400, detail="Invalid decision")
    result = await db.execute(
        select(Witness).where(Witness.id == witness_id, Witness.attempt_id == attempt_id)
    )
    witness = result.scalar_one_or_none()
    if not witness:
        raise HTTPException(status_code=404, detail="Witness not found")

    witness.decision = body.decision
    witness.decision_note = body.note
    witness.reviewer_id = user.id
    witness.reviewed_at = datetime.now(timezone.utc)
    if body.decision == "rejected":
        witness.status = "rejected"
    elif body.decision == "clarification_requested":
        # Re-open the form for the witness — they need to update and re-submit.
        witness.status = "invited"
        witness.completed_at = None
    elif witness.status == "rejected":
        # Adjudicator reversed a prior rejection. Restore to completed.
        witness.status = "completed"
    await db.commit()
    await db.refresh(witness)
    await write_audit(
        db, f"witness.{body.decision}", actor_id=user.id, target_type="witness", target_id=witness.id
    )

    # Notify the witness of the adjudicator's decision (in-app + email).
    attempt = (await db.execute(select(Attempt).where(Attempt.id == attempt_id))).scalar_one_or_none()
    attempt_title = attempt.record_title if attempt else ""
    decision_label = {
        "approved": "approved",
        "rejected": "rejected",
        "clarification_requested": "flagged for clarification",
    }.get(body.decision, body.decision)

    witness_user = (await db.execute(
        select(User).where(User.email.ilike(witness.email))
    )).scalar_one_or_none()
    if witness_user:
        await notify(
            db,
            user_id=witness_user.id,
            title=f"Your witness statement was {decision_label}",
            detail=(body.note or f"An adjudicator {decision_label} your statement for {attempt_title}."),
            tone="success" if body.decision == "approved" else "warning" if body.decision == "clarification_requested" else "error",
            link="/witness",
        )
        await db.commit()

    if witness.email:
        try:
            await send_witness_decision_email(
                witness.email, witness.full_name, body.decision, attempt_title, body.note,
                invite_token=witness.token,
            )
        except Exception:
            logger.exception("send_witness_decision_email failed for %s", witness.email)

    # ------------------------------------------------------------------
    # Attempt-level rollup: derive attempt.status from witness decisions.
    # Only runs once the organizer has formally submitted; never overrides
    # a ratified attempt (ratification is terminal).
    # ------------------------------------------------------------------
    rollup_states = ("submitted", "review", "approved", "rejected")
    if attempt and attempt.status in rollup_states:
        siblings = (await db.execute(
            select(Witness).where(Witness.attempt_id == attempt_id)
        )).scalars().all()

        decisions = [w.decision for w in siblings]
        any_rejected = any(d == "rejected" for d in decisions) or any(w.status == "rejected" for w in siblings)
        any_pending_clarif = any(w.decision == "clarification_requested" and w.status != "completed" for w in siblings)
        all_decided = bool(siblings) and all(d in ("approved", "rejected") for d in decisions)
        all_approved = bool(siblings) and all(d == "approved" for d in decisions)

        new_status: str | None = None
        if any_rejected:
            new_status = "rejected"
        elif all_approved:
            new_status = "approved"
        elif any_pending_clarif:
            new_status = "review"

        if new_status and attempt.status != new_status:
            prev_status = attempt.status
            attempt.status = new_status
            await db.commit()
            await write_audit(
                db, f"attempt.status.{new_status}", actor_id=user.id,
                target_type="attempt", target_id=attempt.id,
            )

            if attempt.organizer_id and new_status in ("approved", "rejected"):
                summary = (
                    f"All {len(siblings)} witnesses have been reviewed for "
                    f"\"{attempt.record_title}\". Final outcome: {new_status}."
                )
                await notify(
                    db,
                    user_id=attempt.organizer_id,
                    title=f"Attempt {new_status}",
                    detail=summary,
                    tone="success" if new_status == "approved" else "error",
                    link="/organizer/submissions",
                )
                await db.commit()

                organizer = (await db.execute(
                    select(User).where(User.id == attempt.organizer_id)
                )).scalar_one_or_none()
                if organizer and organizer.email:
                    try:
                        await send_attempt_status_email(
                            organizer.email,
                            organizer.full_name or "Organizer",
                            attempt.record_title,
                            new_status,
                            summary,
                        )
                    except Exception:
                        logger.exception("send_attempt_status_email failed for %s", organizer.email)

    return witness
