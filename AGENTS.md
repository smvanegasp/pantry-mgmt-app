# AGENTS.md: Pantry app

Read this first. It is the full context for continuing work in a new chat: what the app is, how
we work, what's done, how to run and test it, the rules that matter, and what's next. The
open work list lives in **[docs/BACKLOG.md](docs/BACKLOG.md)**; keep both files up to date.
**[README.md](README.md)** is the public explanation (architecture, the ngrok → PR → CI →
deploy flow, CI/CD, AWS, security, cost). Update it in the same PR whenever any of those change.

**Coming back with feedback from Sergio's wife?** Read §1, §2 and §6, then follow §9 (feedback
playbook and a feature map of where everything lives).

---

## 1. What this is

A mobile-first web app for managing a home pantry: log what you have, auto-generate a grocery
list from what's running low, check things off in the store, and put groceries away in a few
taps when you get home. Photos of products are read by an AI model to fill items in.

- **Owner:** Sergio (GitHub `smvanegasp`). It's a personal project for his website.
- **Real user:** Sergio's wife, the only account, **in daily use since 2026-10-19** at
  <https://pantry.sergiovanegas.com>. She logs in with a **6-digit passcode** via the
  "I'm Sergio's wife" button (home-screen app on her phone). Sergio uses the same account.
  **The next work is driven by her feedback**, relayed by Sergio: see §9.
- **Everyone else** gets a **private demo sandbox**: a copy of her pantry (or the sample pantry
  if hers is empty) that expires after 24h and can never change her data. Sergio likes that
  demos show her real pantry (it shows the app is in use). Visitors get the full experience,
  photo AI included.
- Repo: <https://github.com/smvanegasp/pantry-mgmt-app> (**public** since 2026-10-19).
  Sergio develops on Windows 11 (Git Bash, VS Code, Node 24, uv, Docker Desktop, Terraform).

## 2. How we work (follow this)

- **Small stages, each ending at a gate:** tests pass, the agent checks the UI with Playwright
  in a phone-sized browser (light and dark, in a **sample** demo), Sergio tests on his phone
  through ngrok, then a PR. **Don't start the next stage until Sergio is happy.** Merging deploys
  to production, so nothing reaches his wife before that gate.
- **Plan first, then build:** for each new request, read the relevant code (§9 feature map),
  propose the approach with a recommendation (ask with options only for real product choices),
  put it in `docs/BACKLOG.md`, then build. Keep docs (this file, backlog, README) updated in the
  same PR.
- **Branch per stage**, PR into `main`, body ends with the Claude Code attribution line.
  **Sergio merges PRs himself**: the permission system blocks the agent from merging. Small
  follow-ups go on the same PR branch while it's open.
- **Sergio's preferences:** concise explanations, recommendations over option lists, honest
  status (say what wasn't tested). He gives UI feedback in rounds; small, safe fixes can be done
  right away, bigger ideas go in the backlog.
- **UI style:** no emojis anywhere. Use Phosphor icons (`@phosphor-icons/react`,
  `weight="fill"`) with purpose and solid colors. Add an `InfoTip` (i) popover wherever a
  feature isn't obvious. Black/charcoal dark mode (not warm brown).
- **Python:** managed with **uv** (`uv sync`, `uv run pytest`, `uv add`). **Node.js 22+** on the
  laptop (Vite 8 needs it; `frontend/package.json` engines); CI and the web container use 22.
- **Dependabot:** minor/patch updates come grouped (merge when CI is green); major versions come
  as separate PRs to test locally first; Python version jumps of the Docker image are ignored.

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
| 6 | AWS with Terraform: CloudFront, Lambda (image), HTTP API, DynamoDB, S3, SSM secrets; deploy script | #11 |
| 6b | Deploy from GitHub Actions after CI passes on `main` (OIDC role, no AWS keys in GitHub) | #12, #13 |
| 7a | Search behind an icon; Low / Normal / Plenty stock sections; "how many" items split by expiration date; "Track by" locked on saved items | #15 |
| 7b | No duplicate items: photo reading knows the pantry's names; similar-item check when adding or stocking up | #16 |
| 7c | Desktop QR popup, personal welcome note, app icon / PWA, re-recorded tutorial clips | #17 |
| 7d | Hardening: 6-digit passcode with 3-try pause that hides the login button, email alerts, no API docs on AWS, ngrok password, Dependabot | #18 |
| 7e | Custom domain pantry.sergiovanegas.com (ACM + CloudFront alias, DNS at Hostinger) | #23 |
| 8a | Amounts (¼ ½ ¾ Full, or how many) per photo in "Stock your pantry"; real product photos on the sample pantry; clips re-recorded | #26 |

**Live at <https://pantry.sergiovanegas.com>** (also <https://d3bg4vze5d4ttm.cloudfront.net>).
Everything above is merged and deployed; there are no open PRs and no work in progress
(2026-10-20). Local (Docker + ngrok) is the place to test changes before they're merged; she
only uses the live site.

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
- **Frontend:** React 19 + TypeScript 7 + Vite 8, Tailwind v4, TanStack Query, Phosphor icons.
  `frontend/src/`. Same-origin `/api`, so there's no CORS and auth uses an httpOnly cookie.
- **One Docker image** for local and Lambda: `backend/Dockerfile` has an `app` stage (compose
  and CI) and a final `lambda` stage that adds the AWS Lambda Web Adapter (built at deploy time
  only, because public ECR rate-limits CI runners).

### Repo map

```
AGENTS.md, CLAUDE.md, docs/BACKLOG.md
docker-compose.yml          api, dynamodb (DynamoDB Local), s3 (adobe/s3mock), web (node:22 Vite)
.github/workflows/ci.yml    pytest, vitest + build, docker build --target app, terraform validate
.github/workflows/deploy.yml  after CI passes on main: image -> ECR, Lambda, frontend -> S3
.mcp.json                   Playwright, AWS docs, Terraform MCP servers
scripts/set_passcode.py     owner sets the passcode (hidden prompt) -> backend/.env
scripts/set_aws_secrets.py  passcode hash, Groq key, session secret -> SSM (never printed)
scripts/deploy.sh           manual deploy: image -> ECR, terraform apply, frontend upload
scripts/upload_frontend.sh  frontend/dist -> S3 + CloudFront invalidation (both deploy paths)
infra/bootstrap/            Terraform state bucket (local state, applied once)
infra/                      versions (S3 backend), data (DynamoDB, photos), api (ECR, Lambda,
                            HTTP API, IAM), web (frontend bucket, CloudFront), github (OIDC
                            deploy role), monitoring (SNS email alarms), outputs
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
  app/sample_photos/        16 real product photos (+ thumbs, CREDITS.md) for the sample pantry
  app/passcode.py           scrypt hash/verify; ratelimit.py DynamoDB fixed-window counters
  app/storage.py            S3 photos; recognize.py model providers (Groq / OpenAI / Gemini)
  app/routers/              categories, items, grocery_list, settings, session, photos, recognition
  tests/                    pytest with moto (in-memory AWS); fixtures client/guest/anon
frontend/
  src/App.tsx               session gate (Welcome vs app), tabs Pantry / List / Settings
  src/api.ts, hooks.ts      API client and TanStack Query hooks
  src/pages/                PantryPage, ListPage, SettingsPage, WelcomePage
  src/components/           ItemCard, ItemForm, PackageCarousel, Photo, StockUpSheet, SwipeDeck,
                            DesktopQr, QrCode, PasscodeSheet, LevelPicker, CountStepper,
                            CameraCapture, RestockSheet, AddMenu, InfoTip, BottomSheet, ...
  src/lib/                  pure logic + tests: items (filter/sort/sections), packages, search
                            (fuzzy), dates, stockup, theme, images (resize), useShotQueue
  scripts/record-tutorials.mjs   records public/tutorials/*.mp4 (needs ffmpeg, Node 22+)
  scripts/tutorial-photos/  real product photos used by the clips (+ CREDITS.md)
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
- **Sample photos:** the sample pantry's 16 items show real product photos (Open Food Facts,
  CC BY-SA, `backend/app/sample_photos/` + `CREDITS.md`). They're uploaded once to
  `sample/<name>` (`ensure_sample_photos`), readable by every session, owned by none (never
  deleted), and outside the `sb-` expiry rule. Photo keys may be `sample/<name>`.

### API (all under `/api`; everything except `/health` and `/session` needs a session)

| Area | Endpoints |
|---|---|
| Session | `GET /session` · `POST /session/guest` · `POST /session/guest/reset[?sample=true]` · `POST /session/owner {passcode}` · `DELETE /session` |
| Items | `GET/POST /items` · `GET/PATCH/DELETE /items/{id}` (PATCH `packages` replaces the list) |
| Categories | `GET/POST /categories` · `PATCH/DELETE /categories/{id}` |
| List | `GET/POST /list` · `POST /list/generate` · `POST /list/{id}/restock` · `PATCH/DELETE /list/{id}` |
| Settings | `GET/PUT /settings` (default thresholds: ¼ and 1) |
| Photos | `POST /photos` (multipart photo+thumb) · `GET /photos/{key}[?size=thumb]` · `DELETE /photos/{key}` (unused only) |
| Recognition | `POST /recognize {photoKey}` → `{isProduct, name, categoryId, newCategoryName, existingItemId, mode, count, expiresOn}` (the prompt lists the pantry's item names so the same product reuses its name) |

Limits: demos start at most 20/hour per IP (configurable `SANDBOX_LIMIT_PER_IP`; 1000 locally)
and 500/hour total. Login: 3 wrong per IP pause owner login there for up to an hour (`GET /session` then
reports `ownerLoginEnabled: false`, hiding the button), 10 wrong per hour globally. Photos: 40
uploads per demo per day. Recognition: 20/demo, 300/owner, 1000 total per day.

## 5. Run, test, preview

```sh
docker compose up -d --build          # app at http://localhost:5173 (API docs :8080/api/docs)
ngrok http 5173 --traffic-policy-file ngrok-policy.yml   # phone URL (Sergio's static
                                      # ngrok domain; password from ngrok-policy.yml)
cd backend && uv run pytest -q        # ~110 tests, moto, never calls real models
cd frontend && npm test               # ~57 vitest tests
cd frontend && npm run build          # typecheck + build
cd frontend && npm run record-tutorials   # re-record welcome clips (stack running, ffmpeg)
```

- **Tutorial clips** (`frontend/scripts/record-tutorials.mjs`): 5 clips (track, stock, list,
  shop, home), each in a fresh **sample** demo at 390×844. A fake webcam films
  `scripts/tutorial-photos/olive-oil.jpg`; honey, almond milk and ketchup come from the library;
  4 real photo reads per run (fractions of a cent). `open()` trims each clip to start on a fully
  drawn screen. Re-record after any visible UI change, then check every clip frame by frame
  (ffmpeg contact sheets), and update captions in `WelcomePage.tsx` if steps change. A failed
  clip leaves `public/tutorials/<id>-failed.png` (git-ignored).

- The stack runs with hot reload (file polling, because Docker on Windows doesn't forward
  file events). Rebuild the API image after changing backend dependencies
  (`docker compose up -d --build api`) and restart `web` after frontend dependency changes.
- If ngrok says the endpoint is already online, an old tunnel is still running; the same URL
  still works.
- The tunnel is password-protected: `ngrok-policy.yml` (git-ignored, copied from
  `ngrok-policy.example.yml`) holds Sergio's user and password. Locally every request reaches
  the API from the Vite container's IP, so login lockouts there apply to every device at
  once; clear `COUNTER#login-fail*` rows in DynamoDB Local after testing them.

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
- **Her real pantry lives on AWS** (DynamoDB `pantry`, `SPACE#main`; photos `main/` in the
  photos bucket). **Never read, change or delete it** without Sergio's explicit OK, and never
  log in as owner on the live site. The local DynamoDB holds an older test copy; treat it as
  real data too.
- **Run browser tests in a sample demo** (`POST /api/session/guest/reset?sample=true` in the
  test browser). A plain demo (`/session/guest` or `reset` without `sample`) is a **copy of her
  real pantry**: fine for visitors, but don't use it for tests or screenshots. Avoid bulk
  actions on real data (a "Put away all" once touched his items; it was reverted).
- Live smoke tests: a sample demo on <https://pantry.sergiovanegas.com> through the API or
  Playwright. Each counts toward the per-IP demo limit (20/hour), and wrong passcodes toward
  the login pause (3 per network) and email Sergio an alert.
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

## 8. AWS deployment

AWS profile **`pantry`** (IAM user `pantry-deployer`), region **us-east-1**. Terraform state is
in `pantry-tfstate-<account>` (S3, native lockfile). The agent may run `terraform plan`, but
**applies need Sergio's OK** (the permission system blocks blind `-auto-approve` applies).

**First deploy (Sergio runs these from Git Bash in the repo root):**
```sh
terraform -chdir=infra/bootstrap init && terraform -chdir=infra/bootstrap apply   # state bucket
(cd backend && uv run python ../scripts/set_aws_secrets.py)                        # secrets -> SSM
scripts/deploy.sh                                           # asks to approve two applies
```
**Code deploys are automatic:** merging into `main` runs CI, and when it passes
`.github/workflows/deploy.yml` builds and pushes the image, rolls Lambda to its digest, uploads
the frontend and checks `/api/health` through CloudFront. It assumes `pantry-github-deploy`
(`infra/github.tf`) through GitHub OIDC; only workflows on `main` can, and the role can only
deploy code (no Terraform, IAM, data or secrets). Run it again from the Actions tab ("Run
workflow") to redeploy.

**Infrastructure changes stay manual:** anything under `infra/` needs `terraform plan`, Sergio's
OK, then `terraform -chdir=infra apply` (or `scripts/deploy.sh`) **before** merging code that
depends on it; the workflow never applies Terraform. Because both paths deploy the image tagged
`:latest` by digest, Terraform stays in sync with code deployed by the workflow.

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
- **Domain** (`infra/domain.tf`): `pantry.sergiovanegas.com`. DNS is at **Hostinger**
  (sergiovanegas.com, nameservers `dns-parking.com`); two CNAMEs there, added by Sergio: the
  ACM validation record (`terraform output certificate_validation_record`) and
  `pantry` -> the CloudFront domain (`terraform output dns_target`). Keep both, or the
  certificate stops renewing / the site stops resolving.
- **Alerts** (`infra/monitoring.tf`) email `var.alert_email`, set in `infra/terraform.tfvars`
  (git-ignored; `alert_email = "..."`), through SNS: Lambda errors, API 5xx (5+ in 5 min),
  photo reading failing (3+ in 15 min, from the "Photo reading failed" log line) and any
  wrong owner passcode (the "Wrong owner passcode" log line). Keep those log lines stable.
- To change the passcode: `cd backend && uv run python ../scripts/set_passcode.py` (local),
  then `uv run python ../scripts/set_aws_secrets.py` (copies the hash to SSM and restarts
  the API).
- DynamoDB and the photos bucket have `prevent_destroy` (and the table deletion protection plus
  point-in-time recovery, 35 days: a restore is possible if her data is ever damaged). Demo
  photos (`sb-*`) expire after 2 days by lifecycle rule; `sample/` photos are permanent.
- **Debugging production** (read-only, profile `pantry`): `aws logs tail /aws/lambda/pantry-api
  --since 1h` (the API logs "Photo reading failed: ..." with the error type and status, and
  "Wrong owner passcode"); `aws cloudwatch describe-alarms --alarm-name-prefix pantry-`; the
  Deploy runs in GitHub Actions. Never print secrets; check SSM values only by length/prefix.
- Costs: well under $1/month on AWS (budgets "Monthly Check" and "Zero-Spend-Check" email
  Sergio); Groq is pay-as-you-go with a $5/month limit set in its console.

## 9. Handling her feedback (start here when Sergio comes back)

1. **Collect:** write each point from Sergio into `docs/BACKLOG.md` under "Her feedback", in
   her words, with your reading of it (bug / confusing / missing / wish). Ask Sergio only what
   you can't infer (which screen, what she expected).
2. **Triage:** small, safe fixes (copy, a default, a spacing or color issue) can go straight into
   a stage; anything that changes how data is stored or how a flow works gets a short proposal
   with a recommendation first. Group related points into one stage (`stage-8b-...`, ...).
3. **Reproduce in a sample demo** locally, never on her data. For photo-reading complaints, ask
   Sergio for the photo (or a similar one) and test it locally; production logs show only
   failures, not her images.
4. **Build, gate, PR** as in §2. Re-record the tutorial clips if a visible flow changed.
5. **Close the loop:** move the item to "Done" with its PR, and tell Sergio what changed in
   words he can pass on to her.

### Feature map (where things live)

| Feature | Frontend | Backend |
|---|---|---|
| Welcome page, personal note (Sergio's photo `public/sergio.jpg`), clips, demo/owner buttons | `pages/WelcomePage.tsx`, `components/TutorialStrip.tsx` | `routers/session.py`, `sandbox.py` |
| Desktop "Made for your phone" QR popup | `components/DesktopQr.tsx`, `QrCode.tsx`, `lib/useMediaQuery.ts` | |
| Owner login, 6 digits, tries left, pause after 3 | `components/PasscodeSheet.tsx`, `DemoBanner.tsx` | `routers/session.py`, `passcode.py`, `ratelimit.py` |
| Pantry list: filters, search icon, sorts and sections (Low / Normal / Plenty) | `pages/PantryPage.tsx`, `components/PantryControls.tsx`, `lib/items.ts`, `lib/search.ts` | `routers/items.py`, `stock.py` |
| Item card quick taps (level chips, count stepper), photo thumbnail | `components/ItemCard.tsx`, `LevelPicker.tsx`, `CountStepper.tsx`, `lib/packages.ts` | `stock.py` |
| Add / edit item form: photo + reading, "Track by" (locked on saved items), packages or expiration dates, "Add to …" duplicate check | `components/ItemForm.tsx`, `PackageCarousel.tsx`, `ExpiryPicker.tsx`, `Photo.tsx`, `lib/stockup.ts` (`findMatch`) | `routers/items.py`, `routers/photos.py`, `routers/recognition.py` |
| Stock your pantry: camera, background reading, swipe review, amount per photo, "Same product?", fix list | `components/StockUpSheet.tsx`, `CameraCapture.tsx`, `SwipeDeck.tsx`, `lib/useShotQueue.ts`, `lib/stockup.ts` | `routers/recognition.py`, `recognize.py` (prompt), `routers/photos.py` |
| Grocery list: generate, add box with suggestions, check-off, "I'm home" put-away | `pages/ListPage.tsx`, `components/AddToList.tsx`, `RestockSheet.tsx` | `routers/grocery_list.py` |
| Settings: default "add to list" points, theme | `pages/SettingsPage.tsx`, `lib/theme.ts` | `routers/settings.py` |
| Sample pantry (16 items with real photos) | | `sample_data.py`, `sample_photos/` |
| App icon, manifest, dark mode, 16px inputs | `index.html`, `public/`, `index.css` | |
