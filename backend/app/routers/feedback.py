"""Feedback left in the app (Settings), kept outside every sandbox so it outlives the 24h demo.

Notes from the owner account (Sergio's wife, or Sergio) show in her Settings inbox, where they
can be edited and marked done. Visitors' notes never show there (they may write anything): a log
line turns each into an email to Sergio (infra/monitoring.tf), and scripts/feedback.py lists them.
Ported from the fit app.
"""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, status

from app import db, ratelimit, storage
from app.models import Feedback, FeedbackCreate, FeedbackUpdate
from app.routers.photos import object_keys, owns
from app.sandbox import FEEDBACK_SPACE
from app.session import Session, read_session

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

PER_IP_PER_HOUR = 10
ALL_PER_DAY = 200

log = logging.getLogger("uvicorn.error")


def _session(request: Request) -> Session:
    session = read_session(request)
    if session is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No session; try the demo or log in")
    return session


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@router.post("", status_code=status.HTTP_201_CREATED)
def send_feedback(body: FeedbackCreate, request: Request) -> Feedback:
    session = _session(request)
    if (
        ratelimit.hit(f"feedback-ip#{ratelimit.client_ip(request)}", 3600) > PER_IP_PER_HOUR
        or ratelimit.hit("feedback-all", 86400) > ALL_PER_DAY
    ):
        raise ratelimit.too_many("That's a lot of feedback; thank you! Try again in a bit")
    feedback_id = uuid.uuid4().hex[:12]
    feedback = Feedback(
        id=feedback_id,
        text=body.text.strip(),
        page=body.page.strip(),
        role=session.role,
        createdAt=_now(),
        userAgent=request.headers.get("user-agent", "")[:200],
        photos=[_keep(session.space, key, f"feedback/{feedback_id}-{n}") for n, key in enumerate(body.photos)],
        space=session.space,
    )
    db.put(
        FEEDBACK_SPACE,
        f"FEEDBACK#{feedback.createdAt}#{feedback.id}",
        {**feedback.model_dump(), "space": session.space},
    )
    if session.role == "guest":
        # The guest-feedback alarm emails Sergio when it sees this line (infra/monitoring.tf).
        log.warning("Guest feedback received")
    return feedback


def _keep(space: str, key: str, copy: str) -> str:
    """Copy a screenshot the sender uploaded to feedback/, where it outlives a demo's photos."""
    if not owns(space, key):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Attach photos uploaded from this app")
    for source, target in zip(object_keys(key), object_keys(copy)):
        found = storage.get(source)
        if found is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That photo isn't there anymore")
        storage.put(target, *found)
    return copy


@router.get("")
def list_feedback(request: Request) -> list[Feedback]:
    """The owner's inbox, newest first: only notes sent from the owner account."""
    if _session(request).role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner reads feedback")
    rows = db.query(FEEDBACK_SPACE, "FEEDBACK#")
    return [Feedback(**row) for row in reversed(rows) if row.get("role") == "owner"]


@router.patch("/{feedback_id}")
def update_feedback(feedback_id: str, body: FeedbackUpdate, request: Request) -> Feedback:
    """Mark done / not done (owner, on the owner's notes), or fix the text (whoever wrote it)."""
    session = _session(request)
    for sk, row in db.keys(FEEDBACK_SPACE, "FEEDBACK#"):
        if row.get("id") != feedback_id:
            continue
        mine = row.get("space") == session.space
        # Visitors' notes are invisible in the app: to the owner they don't exist.
        if not mine and not (session.role == "owner" and row.get("role") == "owner"):
            break
        if body.status is not None and session.role != "owner":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner marks feedback")
        changes: dict[str, str] = {}
        if body.status is not None:
            changes["status"] = body.status
        if body.text is not None and body.text.strip() != row["text"]:
            changes |= {"text": body.text.strip(), "editedAt": _now()}
        updated = {**row, **changes}
        db.put(FEEDBACK_SPACE, sk, updated)
        return Feedback(**updated)
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Feedback not found")
