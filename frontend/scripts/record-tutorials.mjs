// Records the short looping tutorial clips shown on the welcome screen.
//
//   docker compose up -d          # the app must be running
//   cd frontend && npm run record-tutorials [-- http://localhost:5173]
//
// Each clip runs in its own throwaway demo sandbox seeded with the sample pantry, so the
// owner's data is never touched. Needs ffmpeg on PATH. Writes public/tutorials/<id>.mp4 and
// a poster image <id>.jpg.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:5173";
const OUT = new URL("../public/tutorials/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const VIEWPORT = { width: 390, height: 844 };
// Pauses are written for a comfortable pace, then shortened by PACE; the encode then plays
// back at SPEED. Together they keep clips brisk without skipping any steps.
const PACE = 0.75;
const SPEED = 1.2;

// Shows a fading dot wherever the "finger" taps, and hides the demo banner.
const TAP_OVERLAY = () => {
  addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style");
    style.textContent = `
      [data-demo-banner] { display: none !important; }
      .tap-dot { position: fixed; z-index: 9999; width: 44px; height: 44px; margin: -22px 0 0 -22px;
        border-radius: 50%; background: rgba(5, 150, 105, .35); border: 2px solid rgba(5, 150, 105, .8);
        pointer-events: none; animation: tap .6s ease-out forwards; }
      @keyframes tap { from { transform: scale(.4); opacity: 1 } to { transform: scale(1.2); opacity: 0 } }`;
    document.head.append(style);
  });
  addEventListener(
    "pointerdown",
    (e) => {
      const dot = document.createElement("div");
      dot.className = "tap-dot";
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
      document.body.append(dot);
      setTimeout(() => dot.remove(), 700);
    },
    true,
  );
};

const pause = (page, ms = 700) => page.waitForTimeout(ms * PACE);
const tap = async (page, locator, ms = 700) => {
  await locator.click();
  await pause(page, ms);
};
const type = async (page, locator, text) => {
  await locator.click();
  await locator.pressSequentially(text, { delay: 70 });
  await pause(page, 400);
};
const api = (page, method, path, data) =>
  page.request.fetch(`${BASE}/api${path}`, { method, data }).then((r) => r.json());
const tab = (page, name) => page.getByRole("button", { name: new RegExp(`^${name}`) });

const CLIPS = [
  {
    id: "track",
    async run(page) {
      await page.goto(BASE);
      await page.getByRole("button", { name: /^Milk/ }).waitFor();
      await pause(page, 900);
      const milk = page.getByRole("radiogroup", { name: "Milk fill level" });
      await tap(page, milk.getByRole("radio", { name: "¼" }), 1100);
      const eggs = page.getByRole("listitem").filter({ hasText: "Eggs" });
      await tap(page, eggs.getByRole("button", { name: "Decrease" }), 500);
      await tap(page, eggs.getByRole("button", { name: "Decrease" }), 900);
      await tap(page, page.getByRole("button", { name: "Add item" }), 800);
      await type(page, page.getByLabel("Name"), "Honey");
      await page.getByRole("dialog").getByLabel("Category", { exact: true }).selectOption({ label: "Baking" });
      await pause(page, 600);
      await tap(page, page.getByRole("dialog").getByRole("button", { name: "+1y" }), 900);
      await tap(page, page.getByRole("button", { name: "Add to pantry" }), 1500);
    },
  },
  {
    id: "list",
    async run(page) {
      await page.goto(BASE);
      await tab(page, "List").waitFor();
      await pause(page, 600);
      await tap(page, tab(page, "List"), 900);
      await tap(page, page.getByRole("button", { name: "Generate list", exact: true }), 1800);
      await type(page, page.getByLabel("Add to list"), "oliv");
      await pause(page, 500);
      await tap(page, page.getByRole("list", { name: "Pantry suggestions" }).getByRole("button").first(), 1500);
    },
  },
  {
    id: "shop",
    async setup(page) {
      await api(page, "POST", "/list/generate");
    },
    async run(page) {
      await page.goto(BASE);
      await tab(page, "List").waitFor();
      await tap(page, tab(page, "List"), 900);
      for (const name of ["Rolled oats", "Diced tomatoes", "Sugar", "Greek yogurt"]) {
        await tap(page, page.getByRole("checkbox", { name: new RegExp(name) }), 650);
      }
      await pause(page, 1500);
    },
  },
  {
    id: "home",
    async setup(page) {
      const { list } = await api(page, "POST", "/list/generate");
      for (const entry of list.filter((e) => e.itemId).slice(0, 3)) {
        await api(page, "PATCH", `/list/${entry.id}`, { checked: true });
      }
    },
    async run(page) {
      await page.goto(BASE);
      await tab(page, "List").waitFor();
      await tap(page, tab(page, "List"), 900);
      await tap(page, page.getByRole("button", { name: /I'm home/ }), 1000);
      const sheet = page.getByRole("dialog");
      const first = sheet.getByRole("listitem").first();
      await tap(page, first.getByRole("button", { name: "+6m" }), 800);
      await tap(page, first.getByRole("button", { name: "Put away" }), 1100);
      await tap(page, sheet.getByRole("button", { name: /Put away all/ }), 1600);
      await tap(page, sheet.getByRole("button", { name: "Done" }), 800);
      await tap(page, tab(page, "Pantry"), 1800);
    },
  },
];

async function record(browser, clip, workDir) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    // Playwright records the viewport 1:1 (a larger size just adds gray padding).
    recordVideo: { dir: workDir, size: VIEWPORT },
  });
  const started = Date.now();
  await context.addInitScript(TAP_OVERLAY);
  const page = await context.newPage();
  await api(page, "POST", "/session/guest/reset?sample=true");
  await clip.setup?.(page);
  // Show a blank page while setting up, then trim that part off the video.
  const trimStart = (Date.now() - started) / 1000;
  try {
    await clip.run(page);
  } catch (err) {
    const shot = join(OUT, `${clip.id}-failed.png`);
    await page.screenshot({ path: shot });
    throw new Error(`Clip "${clip.id}" failed (screenshot: ${shot}): ${err.message}`);
  }
  const video = page.video();
  await context.close();
  const raw = join(workDir, `${clip.id}.webm`);
  renameSync(await video.path(), raw);
  return { raw, trimStart };
}

function encode(id, raw, trimStart) {
  const mp4 = join(OUT, `${id}.mp4`);
  const poster = join(OUT, `${id}.jpg`);
  const ffmpeg = (...args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
  ffmpeg("-ss", String(trimStart), "-i", raw, "-vf", `setpts=PTS/${SPEED},fps=30`, "-c:v", "libx264",
    // Short keyframe interval keeps looping and starting playback smooth on phones.
    "-preset", "slow", "-crf", "26", "-g", "30", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", mp4);
  ffmpeg("-ss", "0.8", "-i", mp4, "-frames:v", "1", "-q:v", "4", poster);
  return mp4;
}

mkdirSync(OUT, { recursive: true });
const workDir = mkdtempSync(join(tmpdir(), "pantry-tutorials-"));
const browser = await chromium.launch();
try {
  for (const clip of CLIPS) {
    process.stdout.write(`Recording ${clip.id}… `);
    const { raw, trimStart } = await record(browser, clip, workDir);
    console.log(`-> ${encode(clip.id, raw, trimStart)}`);
  }
} finally {
  await browser.close();
  if (process.env.KEEP_RAW) console.log(`Raw recordings kept in ${workDir}`);
  else rmSync(workDir, { recursive: true, force: true });
}
