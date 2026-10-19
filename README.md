# Pantry

A mobile-first app to manage a home pantry: log items, auto-generate a grocery list, check items off while shopping, and restock in a few taps when you get home.

Visitors get a private demo sandbox (reset after 24h); only the owner, with a passcode, edits the real pantry.

## Stack

- **Backend:** Python 3.12, FastAPI, managed with [uv](https://docs.astral.sh/uv/)
- **Frontend:** React + TypeScript + Vite
- **Local dev:** Docker Compose (+ ngrok to test on a phone)
- **Production (later):** AWS Lambda (container image), API Gateway, DynamoDB, S3, CloudFront, managed with Terraform

## Run locally

```sh
docker compose up --build
```

- App: http://localhost:5173
- API docs: http://localhost:8080/api/docs

Test on your phone:

```sh
ngrok http 5173
```

## Owner passcode (local)

Visitors get a private demo sandbox (a copy of the owner's pantry that expires after 24h).
To enable the owner login ("I'm Sergio's wife"), set the 4-digit passcode once:

```sh
cd backend
uv run python ../scripts/set_passcode.py
docker compose up -d api
```

This writes `PASSCODE_HASH` and `SESSION_SECRET` to `backend/.env` (git-ignored); the passcode
itself is never stored.

## Photo recognition (local)

Taking a photo of a new item fills in its name, category, tracking mode and printed expiry
date using Gemini. Add your key to `backend/.env` (git-ignored), then `docker compose up -d api`:

```sh
GEMINI_API_KEY='...'
# optional, defaults to gemini-3.8-flash
GEMINI_MODEL='gemini-3.8-flash'
```

Daily caps per demo, for the owner, and overall keep costs bounded (`app/routers/recognition.py`).

## Tutorial clips

The welcome screen shows short clips recorded from the real app in a throwaway demo sandbox
(sample pantry, so no real data appears). Re-record them after UI changes:

```sh
docker compose up -d
cd frontend
npx playwright install chromium   # once
npm run record-tutorials          # needs ffmpeg on PATH
```

## Backend tests

```sh
cd backend
uv sync
uv run pytest
```
