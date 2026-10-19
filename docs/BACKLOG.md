# Backlog

Open work for the pantry app. Context, conventions and status are in [AGENTS.md](../AGENTS.md).
Move an item to "Done" (with its PR) when it ships, and add new requests here as they come up.
Each stage ends at the usual gate: tests, a Playwright check at 390×844 in a sample demo
(light and dark), Sergio's phone test through ngrok, then a PR. Merging deploys.

## In progress: stage 7d, hardening and making the repo public

Branch `stage-7d-hardening`. A read-only scan (2026-10-19) of every tracked file and the full
history found **no keys or secrets**. Built:
- **Owner login:** 6-digit passcode; 3 wrong tries per network pause owner login there for up
  to an hour and hide the "I'm Sergio's wife" button (Sergio's idea, enforced by the server);
  10 wrong per hour overall; the pad says how many tries are left.
- **No `/api/docs` on AWS.**
- **ngrok password** via a traffic policy file (`ngrok-policy.example.yml`, real file ignored).
- **AGENTS.md** no longer has the ngrok domain or the local path. Mentions of his wife stay:
  the live app already says "I'm Sergio's wife".
- **`.gitignore`:** `.claude/settings.local.json`, `ngrok-policy.yml`, `*.tfvars`.
- **Alerts** (`infra/monitoring.tf`): email on Lambda errors, API 5xx, photo reading failing
  and any wrong owner passcode.
- **Dependabot:** weekly grouped PRs for uv, npm, Docker, GitHub Actions and Terraform.
- **Decided (2026-10-19):** Sergio is fine with his Gmail showing in commit history.
- **Fine to publish as is:** AWS account ID, CloudFront ID and URL (identifiers, not secrets;
  the deploy role only trusts `main` of this repo; CI never gets secrets on pull requests).

Left: Sergio sets the 6-digit passcode (local + SSM), the alert email and the ngrok password;
applies `infra/monitoring.tf`; then a final secrets scan, and he makes the repo public.

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

- Stage 0–7c: see the status table in AGENTS.md §3 (PRs #1–#17).
- `.codex/config.toml` in history: checked, it only lists MCP servers; nothing to rotate.
