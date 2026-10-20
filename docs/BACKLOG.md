# Backlog

Open work for the pantry app. Context, conventions and status are in [AGENTS.md](../AGENTS.md).
Move an item to "Done" (with its PR) when it ships, and add new requests here as they come up.
Each stage ends at the usual gate: tests, a Playwright check at 390×844 in a sample demo
(light and dark), Sergio's phone test through ngrok, then a PR. Merging deploys.

## In review: stage 8a, amounts in "Stock your pantry", real photos everywhere (PR #26)

Branch `stage-8a-stock-up-amounts`, passed Sergio's phone test ("works incredible").
- Each review card has "How full?" (1/4 1/2 3/4 Full) or "How many?" (stepper, prefilled with the
  model's count) below it; it follows the item the photo is added to. Defaults unchanged.
- The sample pantry's 16 items show real product photos (Open Food Facts, mostly Kirkland),
  shared under S3 `sample/` (see AGENTS §4).
- Clips re-recorded: "track" adds honey from a real photo (the model fills it in) and scrolls to
  it; "stock" sets olive oil to 1/2 and almond milk to 4 before accepting.
- Maybe later: let the photo reader guess the level when it can see it (a clear bottle).

## Later

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

- Move his wife's home-screen icon to https://pantry.sergiovanegas.com (log in once there).

## Done

- Stage 0–7e: see the status table in AGENTS.md §3 (PRs #1–#23). Real tutorial photos: #22.
- Groq monthly spend limit set to $5 (2026-10-19).
- **Decided:** live demos copy her real pantry (once it has items); Sergio likes that it shows
  the app is in real use. Visitors only ever change their private copy.
- Repo made public (2026-10-19) after a clean secrets scan of all files and history.
- First Dependabot round: #20 (Actions majors) and #21 (Vite 8, TypeScript 7, plugin-react 6;
  tested locally on Node 22: build, tests, dev server, main flows, a real photo read); #19
  (Python 3.14 image) closed, Python image jumps now ignored; laptop needs Node 22+ (#24;
  Nodist removed from the system PATH, Node 24 LTS installed).
- `.codex/config.toml` in history: checked, it only lists MCP servers; nothing to rotate.
