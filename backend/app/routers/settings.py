from fastapi import APIRouter, Depends

from app import db
from app.models import Settings
from app.space import current_space

router = APIRouter(prefix="/api/settings", tags=["settings"])

SK = "SETTINGS"


def get_settings(space: str) -> Settings:
    row = db.get(space, SK)
    return Settings(**row) if row else Settings()


@router.get("")
def read_settings(space: str = Depends(current_space)) -> Settings:
    return get_settings(space)


@router.put("")
def replace_settings(body: Settings, space: str = Depends(current_space)) -> Settings:
    db.put(space, SK, body.model_dump())
    return body
