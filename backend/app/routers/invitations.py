from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.attempt import Attempt
from app.models.witness import Witness
from app.models.statement import Statement
from app.models.user import User
from app.schemas.statement import StatementSubmit, StatementOut
from app.services.auth_service import verify_magic_link_token
from app.services.notification_service import notify

router = APIRouter(prefix="/invitations", tags=["invitations"])


@router.get("/mine")
async def list_my_invitations(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """All witness invitations addressed to the logged-in user's email.

    Returns the witness rows plus their attempt context so the witness portal
    can list everything they've been invited to without needing a magic link.
    """
    if not user.email:
        return []
    rows = (await db.execute(
        select(Witness).where(Witness.email.ilike(user.email))
    )).scalars().all()
    out = []
    for w in rows:
        attempt = (await db.execute(select(Attempt).where(Attempt.id == w.attempt_id))).scalar_one_or_none()
        out.append({
            "witness_id": w.id,
            "attempt_id": w.attempt_id,
            "attempt_title": attempt.record_title if attempt else "",
            "attempt_location": attempt.location if attempt else None,
            "attempt_date": attempt.attempt_date if attempt else None,
            "witness_name": w.full_name,
            "witness_role": w.role,
            "status": w.status,
            "decision": w.decision,
            "token": w.token,
            "invited_at": w.invited_at.isoformat() if w.invited_at else None,
            "completed_at": w.completed_at.isoformat() if w.completed_at else None,
        })
    return out


@router.get("/{token}")
async def resolve_invitation(token: str, db: AsyncSession = Depends(get_db)):
    """Public endpoint — resolves a magic-link token to invitation details."""
    witness_id = verify_magic_link_token(token)
    if not witness_id:
        raise HTTPException(status_code=401, detail="Invalid or expired invitation link")

    result = await db.execute(select(Witness).where(Witness.id == witness_id))
    witness = result.scalar_one_or_none()
    if not witness:
        raise HTTPException(status_code=404, detail="Witness not found")

    attempt = (await db.execute(select(Attempt).where(Attempt.id == witness.attempt_id))).scalar_one_or_none()

    return {
        "witness_id": witness.id,
        "attempt_id": witness.attempt_id,
        "attempt_title": attempt.record_title if attempt else "",
        "attempt_location": attempt.location if attempt else None,
        "attempt_date": attempt.attempt_date if attempt else None,
        "attempt_category": attempt.category if attempt else None,
        "attempt_description": attempt.description if attempt else None,
        "witness_name": witness.full_name,
        "witness_email": witness.email,
        "witness_role": witness.role,
        "witness_organisation": witness.organisation,
        "witness_expertise": witness.expertise,
        "status": witness.status,
        "decision": witness.decision,
        "decision_note": witness.decision_note,
    }


@router.post("/{token}/statement", response_model=StatementOut, status_code=201)
async def submit_witness_statement(
    token: str,
    body: StatementSubmit,
    db: AsyncSession = Depends(get_db),
):
    """Witness submits their statement via magic link."""
    import json, uuid
    witness_id = verify_magic_link_token(token)
    if not witness_id:
        raise HTTPException(status_code=401, detail="Invalid or expired invitation link")

    result = await db.execute(select(Witness).where(Witness.id == witness_id))
    witness = result.scalar_one_or_none()
    if not witness:
        raise HTTPException(status_code=404, detail="Witness not found")

    kind = "timekeeper" if witness.role == "timekeeper" else "witness"

    statement = Statement(
        id=str(uuid.uuid4()),
        attempt_id=witness.attempt_id,
        witness_id=witness.id,
        kind=kind,
        fields_jsonb=json.dumps(body.fields),
        signature_png=body.signature_png,
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(statement)
    witness.status = "completed"
    witness.completed_at = datetime.now(timezone.utc)
    # If this is a re-submission after the adjudicator requested clarification,
    # clear the prior decision so the witness reappears as a fresh review.
    if witness.decision == "clarification_requested":
        witness.decision = None
        witness.decision_note = None
        witness.reviewer_id = None
        witness.reviewed_at = None

    # Notify the attempt's organizer.
    attempt = (await db.execute(select(Attempt).where(Attempt.id == witness.attempt_id))).scalar_one_or_none()
    if attempt and attempt.organizer_id:
        await notify(
            db,
            user_id=attempt.organizer_id,
            title=f"Witness statement submitted",
            detail=f"{witness.full_name} submitted their statement for {attempt.record_title}.",
            tone="success",
            link=f"/organizer/submissions",
        )
    await db.commit()
    await db.refresh(statement)

    out = StatementOut(
        id=statement.id,
        attempt_id=statement.attempt_id,
        witness_id=statement.witness_id,
        kind=statement.kind,
        fields=body.fields,
        submitted_at=statement.submitted_at,
        created_at=statement.created_at,
    )
    return out
