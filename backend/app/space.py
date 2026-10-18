def current_space() -> str:
    """The data space for this request.

    Always the owner's pantry for now; stage 4 resolves guest sandboxes from the session cookie.
    """
    return "main"
