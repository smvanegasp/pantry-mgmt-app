import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import db, storage
from app.routers import categories, grocery_list, items, photos, recognition, session, settings


@asynccontextmanager
async def lifespan(_: FastAPI):
    if os.environ.get("AUTO_CREATE_TABLE") == "1":
        db.create_table_if_missing()
        storage.create_bucket_if_missing()
    yield


app = FastAPI(
    title="Pantry API",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)
app.include_router(session.router)
app.include_router(categories.router)
app.include_router(items.router)
app.include_router(settings.router)
app.include_router(grocery_list.router)
app.include_router(photos.router)
app.include_router(recognition.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
