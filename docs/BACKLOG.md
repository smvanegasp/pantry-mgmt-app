# Backlog

Open work for the pantry app. Context, conventions and status are in [AGENTS.md](../AGENTS.md).
Move an item to "Done" (with its PR) when it ships, and add new requests here as they come up.
Each stage ends at the usual gate: tests, a Playwright check at 390×844 in a sample demo
(light and dark), Sergio's phone test through ngrok, then a PR. Merging deploys.

## In review: stage 7c, first impressions

Branch `stage-7c-first-impressions`, waiting on Sergio's phone test.
- **Desktop QR popup** (`DesktopQr.tsx`, `QrCode.tsx`): on a computer (min-width 900px, hover,
  fine pointer) a popup shows a QR code of the current URL; after closing, an "Open on your
  phone" button in the top right reopens it, and it doesn't pop up again on reload.
  Drawn in the browser with `qrcode-generator` (pinned), fixed black on white for dark mode.
- **Personal note** replaces the welcome tagline ("Hi, I'm Sergio. I built this app for my
  wife..."); the tutorial clip gives up a little height so common phones still don't scroll.
- **App icon:** white Phosphor basket on emerald; `favicon.svg`, `apple-touch-icon.png`,
  `icon-192/512.png`, `manifest.json` (standalone). The favicon error is gone.
- **Five tutorial clips**, re-recorded: search in "track"; new "stock" clip (fake webcam
  showing `scripts/tutorial-photos/barilla.jpg`, almond milk from the library, "Adds to
  Spaghetti" and "Same product?").

## Then: stage 7d, hardening and making the repo public

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
- **Decided (2026-10-19):** Sergio is fine with his Gmail showing in commit history once the
  repo is public. No history rewrite, no change to his git config.
- **Fine to publish as is:** AWS account ID, CloudFront ID and URL (identifiers, not secrets;
  the deploy role only trusts `main` of this repo; CI never gets secrets on pull requests).
- Last step: re-run the secrets scan, then Sergio makes the repo public.

## Then: stage 7e, custom domain (one of the last steps)

Sergio has a domain. Needs from him: the domain name and where its DNS lives (registrar or
Route 53).
- Terraform: an ACM certificate in us-east-1 (DNS validation), the domain as a CloudFront
  alias, and the DNS records (Route 53 alias, or CNAMEs he adds at his registrar).
- Swap the CloudFront URL for the domain everywhere it's hardcoded: `SITE_URL` in
  `.github/workflows/deploy.yml`, `README.md`, `AGENTS.md`. Keep the cloudfront.net URL
  working (it still points at the same distribution).
- Cookies are host-only, so sessions on the old URL don't carry over; her owner login is
  needed once on the new domain. Update her home-screen bookmark.

## Later

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
- **Smallest phones:** on 375×667 (iPhone SE) the welcome page scrolls about 100px since the
  personal note was added (the tutorial clip is already at its minimum size). Common phones
  (390×844 and up) fit; 360×780 scrolls 6px. Fine for now.
- Test warning: Starlette suggests `httpx2` for its TestClient. Harmless; update when convenient.

## For Sergio (outside the code)

- Set a monthly spend limit in the Groq console (AWS budgets don't see Groq).
- Add the AWS link to his wife's home screen; she should no longer use the ngrok link.

## Done

- Stage 0–7b: see the status table in AGENTS.md §3 (PRs #1–#16).
- `.codex/config.toml` in history: checked, it only lists MCP servers; nothing to rotate.
