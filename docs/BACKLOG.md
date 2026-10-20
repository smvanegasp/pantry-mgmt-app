# Backlog

Open work for the pantry app. Context, conventions and status are in [AGENTS.md](../AGENTS.md).
Move an item to "Done" (with its PR) when it ships, and add new requests here as they come up.
Each stage ends at the usual gate: tests, a Playwright check at 390×844 in a sample demo
(light and dark), Sergio's phone test through ngrok, then a PR. Merging deploys.

## In progress: stage 7e, custom domain pantry.sergiovanegas.com

Branch `stage-7e-custom-domain`. DNS is at Hostinger (nameservers `dns-parking.com`).
- `infra/domain.tf`: ACM certificate (DNS validation) + CloudFront alias; outputs the two
  records Sergio adds at Hostinger. Two applies: the certificate first (`-target`), then the
  rest once the validation record is in.
- `SITE_URL` in the deploy workflow, README and AGENTS switched to the new address; merge only
  after the domain answers, or the deploy's health check fails.
- Cookies are host-only, so her owner login is needed once on the new domain; update her
  home-screen icon to the new address. The cloudfront.net URL keeps working.

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

- Stage 0–7d: see the status table in AGENTS.md §3 (PRs #1–#18). Real tutorial photos: #22.
- Repo made public (2026-10-19) after a clean secrets scan of all files and history.
- `.codex/config.toml` in history: checked, it only lists MCP servers; nothing to rotate.
