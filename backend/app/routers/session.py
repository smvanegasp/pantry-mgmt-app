from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel, StringConstraints

from app import ratelimit
from app.config import passcode_hash
from app.passcode import verify_passcode
from app.sandbox import OWNER_SPACE, create_sandbox, expires_at
from app.session import Session, clear_session, read_session, write_session

router = APIRouter(prefix="/api/session", tags=["session"])

# Sandboxes copy the whole pantry, so cap how fast they can be created.
SANDBOXES_PER_IP_PER_HOUR = 20
SANDBOXES_PER_HOUR = 500
# A 4-digit code has 10,000 options: a handful of guesses per IP and a global cap
# make guessing it impractical. Her session lasts 90 days, so she rarely logs in.
LOGIN_FAILURES_PER_IP = 5
LOGIN_FAILURE_WINDOW = 15 * 60
LOGIN_FAILURES_GLOBAL_PER_HOUR = 20


class SessionInfo(BaseModel):
    role: Literal["owner", "guest"] | None
    expiresAt: int | None = None
    ownerLoginEnabled: bool


class OwnerLogin(BaseModel):
    passcode: Annotated[str, StringConstraints(pattern=r"^\d{4}$")]


def _info(session: Session | None) -> SessionInfo:
    return SessionInfo(
        role=session.role if session else None,
        expiresAt=expires_at(session.space) if session else None,
        ownerLoginEnabled=passcode_hash() is not None,
    )


@router.get("")
def get_session(request: Request) -> SessionInfo:
    return _info(read_session(request))


def _start_sandbox(request: Request, response: Response) -> SessionInfo:
    ip = ratelimit.client_ip(request)
    if (
        ratelimit.hit(f"sandbox-ip#{ip}", 3600) > SANDBOXES_PER_IP_PER_HOUR
        or ratelimit.hit("sandbox-all", 3600) > SANDBOXES_PER_HOUR
    ):
        raise ratelimit.too_many("Too many demos started; try again in a bit")
    session = Session(role="guest", space=create_sandbox())
    write_session(response, session)
    return _info(session)


@router.post("/guest")
def start_guest(request: Request, response: Response) -> SessionInfo:
    """Start a demo with a private copy of the pantry (or keep the one already running)."""
    session = read_session(request)
    if session and session.role == "guest":
        return _info(session)
    return _start_sandbox(request, response)


@router.post("/guest/reset")
def reset_guest(request: Request, response: Response) -> SessionInfo:
    """Throw away this demo's changes and start over from a fresh copy."""
    return _start_sandbox(request, response)


@router.post("/owner")
def owner_login(body: OwnerLogin, request: Request, response: Response) -> SessionInfo:
    stored = passcode_hash()
    if stored is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Owner login isn't set up")
    ip_key = f"login-fail-ip#{ratelimit.client_ip(request)}"
    if (
        ratelimit.count(ip_key, LOGIN_FAILURE_WINDOW) >= LOGIN_FAILURES_PER_IP
        or ratelimit.count("login-fail-all", 3600) >= LOGIN_FAILURES_GLOBAL_PER_HOUR
    ):
        raise ratelimit.too_many("Too many attempts; try again in a few minutes")
    if not verify_passcode(body.passcode, stored):
        ratelimit.hit(ip_key, LOGIN_FAILURE_WINDOW)
        ratelimit.hit("login-fail-all", 3600)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong passcode")
    session = Session(role="owner", space=OWNER_SPACE)
    write_session(response, session)
    return _info(session)


@router.delete("")
def logout(response: Response) -> SessionInfo:
    clear_session(response)
    return _info(None)
