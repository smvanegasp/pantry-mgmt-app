# AGENTS.md: Pantry app

Read this first. It is the full context for continuing work in a new chat: what the app is, how
we work, what's done, how to run and test it, the rules that matter, and what's next. The
open work list lives in **[docs/BACKLOG.md](docs/BACKLOG.md)**; keep both files up to date.

---

## 1. What this is

A mobile-first web app for managing a home pantry: log what you have, auto-generate a grocery
list from what's running low, check things off in the store, and put groceries away in a few
taps when you get home. Photos of products are read by an AI model to fill items in.

- **Owner:** Sergio (GitHub `smvanegasp`). It's a personal project for his website.
- **Real user:** Sergio's wife, the only account. She logs in with a **4-digit passcode** via
  the "I'm Sergio's wife" button. Sergio uses the same account.
- **Everyone else** gets a **private demo sandbox**: a copy of her pantry (or a sample pantry if
  hers is empty) that expires after 24h and can never change her data. Visitors should get
  the full experience, photo AI included.
- Repo: <https://github.com/smvanegasp/pantry-mgmt-app> (private). Local path:
  `c:\Users\smvan\repos\pantry-mgmt-app` (Windows 11).

## 2. How we work (follow this)

- **Small stages, each ending at a gate:** tests pass, I check the UI myself with Playwright in a
  phone-sized browser, Sergio tests on his phone through ngrok, then a PR. **Don't start the
  next stage until Sergio is happy.** Stay local until the app is ready; deploy to AWS (stage 6)
  only after that.
- **Branch per stage**, PR into `main`, body ends with the Claude Code attribution line.
  **Sergio merges PRs himself**: the permission system blocks the agent from merging. Small
  follow-ups go on the same PR branch while it's open.
- **Sergio's preferences:** concise explanations, recommendations over option lists, honest
  status (say what wasn't tested). He gives UI feedback in rounds; small, safe fixes can be done
  right away, bigger ideas go in the backlog.
- **UI style:** no emojis anywhere. Use Phosphor icons (`@phosphor-icons/react`,
  `weight="fill"`) with purpose and solid colors. Add an `InfoTip` (i) popover wherever a
  feature isn't obvious. Black/charcoal dark mode (not warm brown).
- **Python:** managed with **uv** (`uv sync`, `uv run pytest`, `uv add`).

## 3. Status

| Stage | What | PR |
|---|---|---|
| 0 | Skeleton: FastAPI + React/Vite, Docker Compose, CI, MCP servers | (direct to main) |
| 1 | Pantry core: categories, items, level/count, expiry chips; fuzzy search, filters, sort | #1 |
| 2 | Grocery list: thresholds, Generate list, add box with suggestions, shopping check-off | #2 |
| 3a | Packages per item (open bag + spare, batches with different expiry), Phosphor icons, info tips | #3 |
| 3b | "I'm home" restock sheet; page titles removed | #4 |
| 4a | Guest sandboxes, owner passcode login, welcome screen, viewport-aware tooltips | #5 |
| 4b | Welcome tutorial clips (recorded with Playwright), sample demo pantry, swipeable packages | #6 |
| 5a | Product photos (resized on device, S3), thumbnails, viewer, camera-first button | #7 |
| 5b | Photo recognition (Groq; OpenAI/Gemini supported), focus/zoom fixes after the camera | #8 |
| 5c | "Stock your pantry": in-app camera, background reading, swipe review, fix list; one camera button + menu; foldable sections; dark mode; delete/discard photos | #9 |
| **6** | **Deploy to AWS with Terraform. In progress: infra code written and validated, not yet applied (branch `stage-6-aws`).** | |
| 7 | Polish, domain, extras. See the backlog | |

All features are built and tested locally. Nothing is deployed yet.

## 4. Architecture

```
Phone ─ HTTPS ─▶ (local) ngrok ─▶ Vite dev server :5173 ─ /api proxy ─▶ FastAPI :8080
                                                                        ├─ DynamoDB Local :8000
                                                                        ├─ S3Mock (photos)
                                                                        └─ Groq API (photo reading)
(AWS, stage 6) CloudFront ─┬─ /*     → S3 (built frontend)
                           └─ /api/* → API Gateway → Lambda (same Docker image) → DynamoDB, S3, Groq
                                       (+ X-Origin-Verify)               secrets from SSM /pantry/*
```

- **Backend:** Python 3.12, FastAPI, boto3, httpx, itsdangerous. `backend/app/`.
- **Frontend:** React 19 + TypeScript + Vite 6, Tailwind v4, TanStack Query, Phosphor icons.
  `frontend/src/`. Same-origin `/api`, so there's no CORS and auth uses an httpOnly cookie.
- **One Docker image** for local and Lambda: `backend/Dockerfile` has an `app` stage (compose
  and CI) and a final `lambda` stage that adds the AWS Lambda Web Adapter (built at deploy time
  only, because public ECR rate-limits CI runners).

### Repo map

```
AGENTS.md, CLAUDE.md, docs/BACKLOG.md
docker-compose.yml          api, dynamodb (DynamoDB Local), s3 (adobe/s3mock), web (node:22 Vite)
.github/workflows/ci.yml    pytest, vitest + build, docker build --target app, terraform validate
.mcp.json                   Playwright, AWS docs, Terraform MCP servers
scripts/set_passcode.py     owner sets the passcode (hidden prompt) -> backend/.env
scripts/set_aws_secrets.py  passcode hash, Groq key, session secret -> SSM (never printed)
scripts/deploy.sh           image -> ECR, terraform apply, frontend -> S3, CloudFront invalidation
infra/bootstrap/            Terraform state bucket (local state, applied once)
infra/                      versions (S3 backend), data (DynamoDB, photos), api (ECR, Lambda,
                            HTTP API, IAM), web (frontend bucket, CloudFront), outputs
backend/
  app/main.py               app + routers; loads SSM; CloudFront-only middleware on AWS;
                            creates table/bucket locally (AUTO_CREATE_TABLE=1)
  app/config.py             env config (SESSION_SECRET, PASSCODE_HASH, COOKIE_SECURE, limits)
  app/ssm.py                SSM /pantry/* -> environment variables at startup (SSM_PREFIX)
  app/db.py                 DynamoDB single table: put/get/query/delete, copy_space, counters, TTL
  app/models.py             Pydantic models (Item, Package, Category, ListEntry, Settings, ...)
  app/stock.py              totals, is_low, normalize_packages (drop finished packages)
  app/session.py, space.py  signed cookie -> data space ("main" or "sb-<expiry>-<id>")
  app/sandbox.py            create/expire sandboxes; sample_data.py seeds the sample pantry
  app/passcode.py           scrypt hash/verify; ratelimit.py DynamoDB fixed-window counters
  app/storage.py            S3 photos; recognize.py model providers (Groq / OpenAI / Gemini)
  app/routers/              categories, items, grocery_list, settings, session, photos, recognition
  tests/                    pytest with moto (in-memory AWS); fixtures client/guest/anon
frontend/
  src/App.tsx               session gate (Welcome vs app), tabs Pantry / List / Settings
  src/api.ts, hooks.ts      API client and TanStack Query hooks
  src/pages/                PantryPage, ListPage, SettingsPage, WelcomePage
  src/components/           ItemCard, ItemForm, PackageCarousel, Photo, StockUpSheet, SwipeDeck,
                            CameraCapture, RestockSheet, AddMenu, InfoTip, BottomSheet, ...
  src/lib/                  pure logic + tests: items (filter/sort/sections), packages, search
                            (fuzzy), dates, stockup, theme, images (resize), useShotQueue
  scripts/record-tutorials.mjs   records public/tutorials/*.mp4 (needs ffmpeg)
```

### Data model (DynamoDB, one table, `pk`/`sk`)

- `pk = SPACE#main` is her pantry; `SPACE#sb-<unixExpiry>-<hex>` is a demo sandbox (every row
  carries `ttl` = the expiry, so the whole sandbox disappears together).
- `sk`: `SETTINGS` · `CAT#<id>` · `ITEM#<id>` · `LIST#<id>`. Counters live under
  `pk = COUNTER#<name>#<window>` (rate limits, with TTL).
- **Item** = a product: name, categoryId, `mode` (`level` = how full, `count` = how many),
  per-item `buyWhenLevel`/`buyWhenCount` overrides, optional `photoKey`, and 1–20
  **packages** (each with its own `level` 0/25/50/75/100 or `count`, plus `expiresOn`).
  "Low" uses the **total** across packages. Quick taps change the open (least full) or
  first-to-expire package. Finished packages are dropped while others remain. Old rows from
  before packages existed are upgraded on read.
- Photos in S3: `<space>/<id>.img` plus `<space>/<id>-thumb.img`. Guests can read her photos
  (their demo is a copy) but only write and delete in their own space.

### API (all under `/api`; everything except `/health` and `/session` needs a session)

| Area | Endpoints |
|---|---|
| Session | `GET /session` · `POST /session/guest` · `POST /session/guest/reset[?sample=true]` · `POST /session/owner {passcode}` · `DELETE /session` |
| Items | `GET/POST /items` · `GET/PATCH/DELETE /items/{id}` (PATCH `packages` replaces the list) |
| Categories | `GET/POST /categories` · `PATCH/DELETE /categories/{id}` |
| List | `GET/POST /list` · `POST /list/generate` · `POST /list/{id}/restock` · `PATCH/DELETE /list/{id}` |
| Settings | `GET/PUT /settings` (default thresholds: ¼ and 1) |
| Photos | `POST /photos` (multipart photo+thumb) · `GET /photos/{key}[?size=thumb]` · `DELETE /photos/{key}` (unused only) |
| Recognition | `POST /recognize {photoKey}` → `{isProduct, name, categoryId, newCategoryName, mode, count, expiresOn}` |

Limits: demos start at most 20/hour per IP (configurable `SANDBOX_LIMIT_PER_IP`; 1000 locally)
and 500/hour total. Login: 5 wrong per IP per 15 min, 20 wrong per hour globally. Photos: 40
uploads per demo per day. Recognition: 20/demo, 300/owner, 1000 total per day.

## 5. Run, test, preview

```sh
docker compose up -d --build          # app at http://localhost:5173 (API docs :8080/api/docs)
ngrok http 5173                       # phone URL; Sergio's static domain is
                                      # https://thrower-diary-savanna.ngrok-free.dev
cd backend && uv run pytest -q        # ~102 tests, moto, never calls real models
cd frontend && npm test               # ~47 vitest tests
cd frontend && npm run build          # typecheck + build
cd frontend && npm run record-tutorials   # re-record welcome clips (stack running, ffmpeg)
```

- The stack runs with hot reload (file polling, because Docker on Windows doesn't forward
  file events). Rebuild the API image after changing backend dependencies
  (`docker compose up -d --build api`) and restart `web` after frontend dependency changes.
- If ngrok says the endpoint is already online, an old tunnel is still running; the same URL
  still works.

## 6. Secrets and safety rules (important)

- `backend/.env` (git-ignored) holds `PASSCODE_HASH`, `SESSION_SECRET`, `GROQ_API_KEY` (and
  optionally `OPENAI_API_KEY` / `GEMINI_API_KEY`, `GROQ_MODEL`, ...). **Never print, cat or
  paste secrets.** To verify a key is loaded, check only its length/prefix inside the
  container. Never ask Sergio to paste a key or passcode into chat; he edits `.env` himself.
- The passcode is only stored as a scrypt hash. On AWS, the hash and keys go to SSM Parameter
  Store (SecureString), entered by Sergio.
- `git add -A` once picked up `.codex/config.toml` (another tool's settings). It's now in
  `.gitignore`. Always check `git status` before committing, and never commit files you
  didn't create.
- **The local DynamoDB holds Sergio's real data** (his wife's pantry while testing). **Run
  browser tests in a demo sandbox** (`POST /api/session/guest/reset?sample=true` in a fresh
  browser context), never on the owner session, and avoid bulk actions on real data. (A
  "Put away all" once touched his items; it was reverted.)
- Model providers: **Groq** is active (pay-as-you-go, `qwen/qwen3.8-27b`, about 1s per photo,
  tested on labels). OpenAI (`gpt-6-luna`) and Gemini (`gemini-3.8-flash`) are implemented;
  the order is Groq > OpenAI > Gemini, picked by which key is set. Gemini's project was on
  prepaid billing with $0 (HTTP 402); OpenAI is prepaid too. Model IDs and prices change: check
  official docs before changing them.

## 7. UI conventions and gotchas

- **Mobile first**, 390×844 is the reference viewport. On touch screens all inputs use 16px
  text (unlayered CSS in `index.css`) so iOS doesn't auto-zoom. Don't autofocus fields in
  sheets that open the camera (the keyboard popped up after returning from it).
- **Dark mode** mirrors the Tailwind palette with CSS variables in `index.css` (generated from
  `node_modules/tailwindcss/theme.css`; grays from `neutral`; `white` → neutral-800 surfaces;
  stone-200 borders → neutral-700). It applies before first paint (inline script in
  `index.html`), and `lib/theme.ts` follows the phone on "Automatic". New UI built with the
  usual stone/emerald/amber/sky/red classes gets dark mode for free; check new screens in both.
- Bottom sheets and viewers render through portals. InfoTip positions itself against the
  viewport. Filters, sort and folded sections are remembered in localStorage.
- Sorts: By category / Expires soonest / Lowest stock / Recently updated each show foldable
  sections; Name is a flat list.
- **Playwright MCP gotchas:** `confirm()` dialogs abort scripts (avoid them or use rename-style
  actions); dismiss tooltips with Escape (clicking can hit cards); accessible names exclude
  aria-hidden icons; scope locators to a dialog when names repeat ("Add to pantry" exists
  twice; the camera button is "Add products").
- **Shell gotchas (Windows, Git Bash):** `sed` breaks when the replacement contains `#` (the
  delimiter); Python heredoc scripts turn `\n` into real newlines inside strings. Use the edit
  tool for those cases. With `MSYS_NO_PATHCONV=1` (needed for AWS CLI paths like `/pantry/`),
  native Windows tools (curl, terraform, docker) need `C:/...` paths, not `/c/...`.

## 8. AWS deployment (stage 6)

AWS profile **`pantry`** (IAM user `pantry-deployer`), region **us-east-1**. Terraform state is
in `pantry-tfstate-<account>` (S3, native lockfile). The agent may run `terraform plan`, but
**applies need Sergio's OK** (the permission system blocks blind `-auto-approve` applies).

**First deploy (Sergio runs these from Git Bash in the repo root):**
```sh
terraform -chdir=infra/bootstrap init && terraform -chdir=infra/bootstrap apply   # state bucket
(cd backend && uv run python ../scripts/set_aws_secrets.py)                        # secrets -> SSM
scripts/deploy.sh                                           # asks to approve two applies
```
**Every later deploy:** `scripts/deploy.sh` (append `-auto-approve` to skip the prompt).

**How it works:**
- Lambda runs the Dockerfile's `lambda` stage (x86_64, 1 GB, 30s). `deploy.sh` pushes
  `pantry-api:latest`; Terraform pins its digest, so a new image updates the function. Images
  must be built with `--provenance=false --sbom=false` (Lambda rejects attestation manifests).
- **Secrets** (`PASSCODE_HASH`, `SESSION_SECRET`, `GROQ_API_KEY`) are SecureStrings under
  `/pantry/`, loaded by `app/ssm.py` at cold start. Terraform never sees them. On Lambda the
  API refuses to start without `SESSION_SECRET`. `set_aws_secrets.py` restarts the function
  after changing them. Other settings are Lambda env vars in `infra/api.tf`.
- **CloudFront** serves `/*` from the private web bucket (OAC) and `/api/*` from the HTTP API
  with caching off and the `AllViewerExceptHostHeader` policy, which forwards cookies and
  `CloudFront-Viewer-Address` (used by `ratelimit.client_ip`). It adds an `X-Origin-Verify`
  header (random, generated by Terraform); the API returns 403 without it, so nobody can call
  API Gateway directly and fake their IP.
- API Gateway throttles at 20 req/s (burst 50) overall; app limits are in §4.
- DynamoDB and the photos bucket have `prevent_destroy` (and the table deletion protection plus
  point-in-time recovery). Demo photos (`sb-*`) expire after 2 days by lifecycle rule.
- Her real pantry starts **empty** on AWS (local data isn't migrated unless Sergio asks), so
  demos show the sample pantry until she adds items.

**Gate:** open the CloudFront URL in a private window, try a demo, log in as owner elsewhere,
confirm her data is untouched, check the TTL on sandbox rows, check the per-IP counter uses the
real viewer IP, and try photo reading end to end.

After stage 6: see [docs/BACKLOG.md](docs/BACKLOG.md).
