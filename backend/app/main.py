import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import db
from app.routers import categories, items


@asynccontextmanager
async def lifespan(_: FastAPI):
    if os.environ.get("AUTO_CREATE_TABLE") == "1":
        db.create_table_if_missing()
    yield


app = FastAPI(
    title="Pantry API",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)
app.include_router(categories.router)
app.include_router(items.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
