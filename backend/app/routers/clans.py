from __future__ import annotations

import secrets
import string
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from citizenship_score.config import DEFAULT_CONFIG
from citizenship_score.scoring.clans import ClanMember as PhaseClanMember
from citizenship_score.scoring.clans import clan_score, participation_factor

from app.auth import get_current_profile
from app.db import get_db
from app.models.clan import Clan, ClanMember
from app.models.daily_score import DailyScore
from app.models.profile import Profile
from app.models.workout import WorkoutRecord
from app.schemas.clans import ClanCreate, ClanMemberOut, ClanOut, JoinClanRequest
from app.services.scoring import today_utc

router = APIRouter(prefix="/clans", tags=["clans"])

_INVITE_CODE_ALPHABET = string.ascii_uppercase + string.digits
_INVITE_CODE_LENGTH = 8
_MAX_CODE_ATTEMPTS = 10


def _new_invite_code() -> str:
    return "".join(secrets.choice(_INVITE_CODE_ALPHABET) for _ in range(_INVITE_CODE_LENGTH))


def _build_clan_out(db: Session, clan: Clan) -> ClanOut:
    members = list(db.scalars(select(ClanMember).where(ClanMember.clan_id == clan.id)))
    member_ids = [m.user_id for m in members]
    profiles = {p.id: p for p in db.scalars(select(Profile).where(Profile.id.in_(member_ids)))}
    today = today_utc()
    window_start = today - timedelta(days=DEFAULT_CONFIG.clan_participation_window_days - 1)

    phase_members = []
    member_outs = []
    for m in members:
        score_row = db.get(DailyScore, (m.user_id, today))
        rolling_score = score_row.rolling_score if score_row else 0.0
        class_name = score_row.class_name if score_row else "Outsider"
        workout_dates = list(
            db.scalars(
                select(WorkoutRecord.perform_date).where(
                    WorkoutRecord.user_id == m.user_id,
                    WorkoutRecord.perform_date >= window_start,
                    WorkoutRecord.perform_date <= today,
                )
            )
        )
        phase_members.append(
            PhaseClanMember(member_id=str(m.user_id), rolling_score=rolling_score, workout_dates=workout_dates)
        )
        display_name = profiles[m.user_id].display_name if m.user_id in profiles else None
        member_outs.append(ClanMemberOut(display_name=display_name, rolling_score=rolling_score, class_name=class_name))

    return ClanOut(
        id=clan.id,
        name=clan.name,
        invite_code=clan.invite_code,
        clan_score=clan_score(phase_members, today, DEFAULT_CONFIG),
        participation=participation_factor(phase_members, today, DEFAULT_CONFIG),
        members=member_outs,
    )


@router.post("", response_model=ClanOut, status_code=status.HTTP_201_CREATED)
def create_clan(
    body: ClanCreate,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> ClanOut:
    for _ in range(_MAX_CODE_ATTEMPTS):
        clan = Clan(name=body.name, invite_code=_new_invite_code(), owner_id=profile.id)
        db.add(clan)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            continue
        break
    else:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not generate a unique invite code")

    db.add(ClanMember(clan_id=clan.id, user_id=profile.id))
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "You're already in a clan") from exc

    db.refresh(clan)
    return _build_clan_out(db, clan)


@router.post("/join", response_model=ClanOut)
def join_clan(
    body: JoinClanRequest,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> ClanOut:
    clan = db.scalar(select(Clan).where(Clan.invite_code == body.invite_code))
    if clan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No clan with that invite code")

    db.add(ClanMember(clan_id=clan.id, user_id=profile.id))
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "You're already in a clan") from exc

    return _build_clan_out(db, clan)


@router.post("/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_clan(
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> None:
    membership = db.scalar(select(ClanMember).where(ClanMember.user_id == profile.id))
    if membership is not None:
        db.delete(membership)
        db.commit()


@router.post("/regenerate-code", response_model=ClanOut)
def regenerate_invite_code(
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> ClanOut:
    membership = db.scalar(select(ClanMember).where(ClanMember.user_id == profile.id))
    if membership is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not in a clan")
    clan = db.get(Clan, membership.clan_id)
    if clan.owner_id != profile.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the clan owner can regenerate the invite code")

    for _ in range(_MAX_CODE_ATTEMPTS):
        clan.invite_code = _new_invite_code()
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            continue
        break
    else:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not generate a unique invite code")

    return _build_clan_out(db, clan)


@router.get("/me", response_model=ClanOut)
def get_my_clan(
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> ClanOut:
    membership = db.scalar(select(ClanMember).where(ClanMember.user_id == profile.id))
    if membership is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not in a clan")
    clan = db.get(Clan, membership.clan_id)
    return _build_clan_out(db, clan)
