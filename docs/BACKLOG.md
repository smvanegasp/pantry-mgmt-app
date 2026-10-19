# Backlog

Open work for the pantry app. Context, conventions and status are in [AGENTS.md](../AGENTS.md).
Move an item to "Done" (with its PR) when it ships, and add new requests here as they come up.

## Next

- **Stage 6, deploy to AWS with Terraform.** Code is on branch `stage-6-aws`; waiting on
  Sergio to apply the bootstrap, put secrets in SSM and run the first deploy (AGENTS.md §8),
  then the gate checks.

## Up next after the deploy

- **Re-record the welcome tutorial clips with the current UI.** The clips in
  `frontend/public/tutorials/` predate the newest UI: foldable sections, sectioned sorts, the
  camera menu's stock-up flow and dark mode. Re-run `npm run record-tutorials` in a sample
  demo and update the clip steps in `frontend/scripts/record-tutorials.mjs`. Consider a fifth
  clip for **"Stock your pantry"** (snap, swipe, done), since it's now the headline feature.
  Update the captions in `WelcomePage.tsx` to match.
- **Desktop heads-up with a QR code.** On wide screens with a mouse pointer, show a small,
  dismissible note: "Made for your phone: scan to open it there, and to snap product photos",
  with a QR code of the current URL. Keep the copy short.
- **App icon, favicon and "Add to Home Screen" (PWA).** There's currently no favicon (the
  console shows a 404). Add a manifest and icons so it installs like an app.
- **Custom domain** (Route 53 + ACM on CloudFront) once Sergio buys one.
- **Deploy from GitHub Actions** with OIDC (no long-lived AWS keys), after the manual deploy works.

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
- **Login lockout trade-off:** the global cap (20 wrong passcodes per hour) means someone
  hammering the login could lock the owner out for up to an hour. Acceptable, since her session
  lasts 90 days; revisit if it ever bites.
- Test warning: Starlette suggests `httpx2` for its TestClient. Harmless; update when convenient.

## Decisions waiting on Sergio

- **`.codex/config.toml` is in `main`'s history** (commit `610a356`, from PR #9's regular
  merge); it's untracked and ignored now. Sergio should check it for keys and rotate any. If
  it should be purged from history, that needs a history rewrite plus force-push to `main`.
  Only on his explicit OK.

## Done

- Stage 0–5c: see the status table in AGENTS.md §3 (PRs #1–#9).
