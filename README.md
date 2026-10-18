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

## Backend tests

```sh
cd backend
uv sync
uv run pytest
```
