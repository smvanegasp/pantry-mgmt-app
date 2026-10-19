# Backlog

Open work for the pantry app. Context, conventions and status are in [AGENTS.md](../AGENTS.md).
Move an item to "Done" (with its PR) when it ships, and add new requests here as they come up.
Each stage ends at the usual gate: tests, a Playwright check at 390×844 in a sample demo
(light and dark), Sergio's phone test through ngrok, then a PR. Merging deploys.

## Next: stage 7a, search icon and stock sections

- **Search behind an icon.** The always-visible search box takes the top spot, but filters are
  used more. In `frontend/src/components/PantryControls.tsx`:
  - Replace the box with a Phosphor `MagnifyingGlass` (fill) icon button at the end of the
    filter chips row, next to the InfoTip.
  - Tapping it swaps the chips row for the search field (focused, keyboard open) and an X that
    clears the search and closes the field.
  - The field stays open while there's search text. "Clear filters" closes it too.
  - Search text stays unsaved, as today (`PantryPage.tsx`).
- **Three stock sections in the "Lowest stock" sort.** Decided with Sergio: change only the
  sort sections (`BUCKETS.stock` in `frontend/src/lib/items.ts`). The Low filter, the Low
  badge and the thresholds stay as they are. The sections:
  - **Low:** the item's "buy when" rule (`isLow`, ¼ or 1 by default); includes empty items.
  - **Half:** a level total under full, or 2–3 units.
  - **Plenty:** full or more, or 4+ units.
  Update `items.test.ts`.

## Then: stage 7b, welcome story, app icon, new clips

- **A personal note on the welcome page**, above the clips: a small card with an "SV" initials
  avatar. Draft copy for Sergio to edit: "Hi, I'm Sergio. I built this app for my wife, so we
  always know what's in our pantry: what we bring home from Costco, and what to use before it
  goes bad. Take it for a spin with a sample pantry below." Warm and short.
- **App icon, favicon and "Add to Home Screen" (PWA).** There's no favicon (404 locally, 403 on
  AWS). Add a basket icon (SVG + PNG sizes), apple-touch-icon and a manifest in
  `frontend/index.html` / `frontend/public` so it installs like an app.
- **Re-record the tutorial clips, last,** so they show 7a's search and sections and the new
  welcome note. Update the steps in `frontend/scripts/record-tutorials.mjs`, add a fifth clip
  for **"Stock your pantry"** (snap, swipe, done), and update the captions in `WelcomePage.tsx`.

## Then: stage 7c, hardening and making the repo public

A read-only scan (2026-10-19) of every tracked file and the full history (all branches) found
**no keys or secrets**; only placeholders and test values. These are the items to finish
before Sergio flips the repo to public in GitHub's settings:

- **6-digit owner passcode.** With 4 digits and the global cap of 20 wrong tries per hour, a
  determined attacker could find it in about 10 days on average, and the same cap lets anyone
  lock the owner out. 6 digits makes guessing take years. Touches `scripts/set_passcode.py`,
  `scripts/set_aws_secrets.py`, the backend passcode check and the frontend passcode pad;
  Sergio sets the new passcode locally and in SSM.
- **Turn off `/api/docs` and `/api/openapi.json` on AWS** (`on_aws()` in `backend/app/config.py`).
- **Protect the ngrok tunnel** (basic auth or ngrok's OAuth) and document it. The static
  ngrok domain is in git history and reaches the laptop stack, which holds real data; consider
  asking ngrok for a new one.
- **Trim AGENTS.md** of personal details: the ngrok domain, the local Windows path, and details
  about Sergio's wife. Keep the working rules.
- **`.gitignore`:** add `.claude/settings.local.json` (only covered by Sergio's global ignore
  today).
- **Error alerts:** CloudWatch alarm on Lambda errors and API 5xx, emailing Sergio through SNS
  (Terraform; Sergio applies and confirms the subscription email). Free or pennies.
- **Dependabot** for pip, npm and GitHub Actions, one grouped PR a week.
- **Decision:** 34 commits carry Sergio's personal Gmail as author. Keep it (simplest) or
  rewrite history to the GitHub noreply address (force-push to `main`, only on his explicit OK).
- **Fine to publish as is:** AWS account ID, CloudFront ID and URL (identifiers, not secrets;
  the deploy role only trusts `main` of this repo; CI never gets secrets on pull requests).
- Last step: re-run the secrets scan, then Sergio makes the repo public.

## Later

- **Desktop heads-up with a QR code.** On wide screens with a mouse pointer, show a small,
  dismissible note: "Made for your phone: scan to open it there, and to snap product photos",
  with a QR code of the current URL. Keep the copy short.
- **Custom domain** (Route 53 + ACM on CloudFront) once Sergio buys one.
- **Copy her local pantry to AWS?** Only if Sergio asks; she starts empty on AWS.
- **Staging environment on AWS:** not now (one real user, point-in-time recovery covers
  mistakes). Revisit if a broken deploy would really hurt.

## Ideas and improvements

- **Barcode lookup** (Open Food Facts, free) as a precise first step when a barcode is
  visible; the AI model stays the fallback and reads the expiry date.
- **Tune the recognition prompt with real photos.** Collect the cases Sergio's wife sees going
  wrong (curved labels, glare, small dates) and adjust `backend/app/recognize.py`.
- **Dark mode spot checks** on rarely seen screens: restock sheet, passcode pad, fix-up form,
  photo viewer, error states.
- **Escape closes too much:** with the photo viewer open inside an item sheet, Escape closes
  both. Make it close only the top layer.
- **Smallest phones:** on 375×667 (iPhone SE) the welcome page scrolls about 19px; the tutorial
  clip has a minimum size. Fine for now.
- Test warning: Starlette suggests `httpx2` for its TestClient. Harmless; update when convenient.

## For Sergio (outside the code)

- Set a monthly spend limit in the Groq console (AWS budgets don't see Groq).
- Add the AWS link to his wife's home screen; she should no longer use the ngrok link.

## Done

- Stage 0–6b: see the status table in AGENTS.md §3 (PRs #1–#13).
- `.codex/config.toml` in history: checked, it only lists MCP servers; nothing to rotate.
