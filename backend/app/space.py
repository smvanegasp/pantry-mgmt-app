from fastapi import HTTPException, Request, status

from app.session import read_session


def current_space(request: Request) -> str:
    """The data space for this request, taken only from the signed session cookie.

    Owners get the real pantry ("main"); guests get their own sandbox. Request bodies and
    URLs can never choose a space, so a guest has no way to reach the owner's data.
    """
    session = read_session(request)
    if session is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No session; start a demo or log in")
    return session.space
