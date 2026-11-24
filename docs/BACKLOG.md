# Backlog

Open work for the pantry app. Context, conventions and status are in [AGENTS.md](../AGENTS.md)
(§9 is the playbook for handling her feedback). Move an item to "Done" (with its PR) when it
ships, and add new requests here as they come up. Each stage ends at the usual gate: tests, a
Playwright check at 390×844 in a **sample** demo (light and dark), Sergio's phone test through
ngrok, then a PR. Merging deploys.

## Now: stage 9c, link to sergiovanegas.com + light by default (PR #36)

- **Link back** to <https://sergiovanegas.com/projects/> in a new tab (as in the fit app,
  `lib/site.ts`): "More of my projects" at the end of the welcome note, and "Site" in the demo
  banner. Not in the welcome page's top corner: on computers the QR button sits there.
- **Light theme by default** (Sergio, 2026-11-24), even when the phone is in dark mode.
  Automatic and Dark stay in Settings. The setting moved to a new key (`pantry.appearance`)
  because the old one saved "Automatic" whenever Settings was opened; only an explicit Dark
  carries over, so her phone opens light unless she had picked Dark. The browser bar colors
  now match the theme (cream / night-blue).

Then: waiting for her feedback (now also in-app); next stages come from it. Still possible
from the fit app: the sheet that goes full screen while the iPhone keyboard is open, if the
feedback sheet's keyboard covers things on her phone.

## Her feedback

Log each point here as Sergio relays it, in her words, with a reading and a status. Example:

| Date | What she said | Reading | Status |
|---|---|---|---|
| (yyyy-mm-dd) | "..." | bug / confusing / missing / wish; which screen | new / planned in 8b / done in #NN |

## Ideas and improvements

Candidates to weigh against her feedback; none is planned yet.

- **Photo reader guesses the level** when it can see it (a clear bottle) instead of defaulting to
  Full in "Stock your pantry". Decide after she's used the amount row for a while.
- **Barcode lookup** (Open Food Facts, free) as a precise first step when a barcode is
  visible; the AI model stays the fallback and reads the expiry date.
- **Tune the recognition prompt with real photos.** Collect the cases she sees going wrong
  (curved labels, glare, small dates) and adjust `backend/app/recognize.py`.
- **Petal shower** also plays when the "I'm home" sheet is closed without putting anything
  away. Harmless; only celebrate real put-aways if it feels off.
- **Dark mode spot checks** (night-blue since 9a) on rarely seen screens: restock sheet, passcode pad, fix-up form,
  photo viewer, error states.
- **Escape closes too much:** with the photo viewer open inside an item sheet, Escape closes
  both. Make it close only the top layer.
- **Smallest phones:** on 375×667 (iPhone SE) the welcome page scrolls about 100px since the
  personal note was added (the tutorial clip is already at its minimum size). Since the 9a
  redesign (bigger mascot header and buttons) 390×844 scrolls a little too, so "I'm Sergio's
  wife" sits just below the fold. She's normally logged in already; tighten if it bothers anyone.
- **Staging environment on AWS:** not now (one real user, point-in-time recovery covers
  mistakes). Revisit if a broken deploy would really hurt.
- Test warning: Starlette suggests `httpx2` for its TestClient. Harmless; update when convenient.

## For Sergio (outside the code)

- Make sure his wife's home-screen icon points to https://pantry.sergiovanegas.com (log in once
  there; the old cloudfront.net link has a separate login).
- Weekly Dependabot PRs: grouped minor/patch ones can be merged when CI is green; a major
  version arrives as its own PR, so ask the agent to test it first.

## Done

- 9b in-app feedback in Settings (send with screenshots; her inbox with edit and done / not
  done; visitors' notes only to Sergio by email + `scripts/feedback.py`) and no rubber-band
  scrolling, page pinned behind sheets; both from the fit app (#35, 2026-11-24). First
  Dependabot round after it: #32, #33, #28 merged.

- 9a "kawaii" redesign from Lovable: sakura/matcha theme, Nunito, onigiri mascot, desktop
  sidebar and grids, night-blue dark mode, new icons, clips re-recorded (#34, 2026-11-24).

- Stages 0–8a: see the status table in AGENTS.md §3 (PRs #1–#26). Highlights of the last
  stretch (2026-10-19/20):
  - AWS deploy with Terraform (#11), deploy from GitHub Actions on merge (#12, #13).
  - 7a search icon, Low / Normal / Plenty sections, "how many" items split by expiration date,
    "Track by" locked on saved items (#15).
  - 7b no duplicate items: the photo reader knows the pantry's names; "Add to …" or
    "add as a new item"; "Same product?" in stock-up (#16).
  - 7c desktop QR popup, personal welcome note with Sergio's photo, app icon / PWA, new clips
    (#17); real product photos in the clips (#22).
  - 7d hardening: 6-digit passcode, 3 wrong tries pause login and hide the button, email
    alerts, no API docs on AWS, ngrok password, Dependabot (#18); Dependabot policy (#24).
  - 7e custom domain pantry.sergiovanegas.com (#23).
  - 8a amount per photo in "Stock your pantry" (¼ ½ ¾ Full or how many); real photos on all 16
    sample items; clips re-recorded, starting on a drawn screen (#26).
- Repo made public (2026-10-19) after a clean secrets scan of all files and history. Sergio is
  fine with his Gmail showing in commit history.
- Groq monthly spend limit set to $5 (2026-10-19).
- **Decided:** live demos copy her real pantry (once it has items); Sergio likes that it shows
  the app is in real use. Visitors only ever change their private copy.
- First Dependabot round: #20 (Actions majors) and #21 (Vite 8, TypeScript 7, plugin-react 6);
  #19 (Python 3.14 image) closed, Python image jumps now ignored; laptop on Node 24 LTS (Nodist
  removed from the system PATH).
- `.codex/config.toml` in history: checked, it only lists MCP servers; nothing to rotate.
