// Capture real screenshots of the running app for the landing page.
// Requires the dev server on http://localhost:5173.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots');
mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:5173/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1380, height: 880 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

async function gotoApp() {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await sleep(600);
  // Fresh profile starts empty — load the sample songs once.
  const loadBtn = page.getByRole('button', { name: 'טען שירי דוגמה' });
  if (await loadBtn.count()) {
    await loadBtn.first().click();
  }
  await page.getByRole('button', { name: /אדון עולם/ }).first().waitFor({ timeout: 15000 });
  await sleep(400);
}

// 1) Editor with chords over Hebrew lyrics
await gotoApp();
await page.getByRole('button', { name: /אדון עולם/ }).first().click();
await page.locator('.line-block').first().waitFor({ timeout: 8000 });
await sleep(800);
await page.screenshot({ path: join(OUT, 'editor.png') });
console.log('shot: editor.png');

// 2) Performance / stage (scroll mode) — the money shot
await gotoApp();
await page.getByRole('button', { name: 'נגן', exact: true }).first().click();
await page.locator('.stage').waitFor({ timeout: 8000 });
// Let the count-in finish and a couple of lines settle.
await sleep(4200);
await page.screenshot({ path: join(OUT, 'perform.png') });
console.log('shot: perform.png');

// 3) 2-line big teleprompter mode
const twoLine = page.locator('.auto', { hasText: '2 שורות' });
if (await twoLine.count()) {
  await page.mouse.move(700, 700); // wake the transport bar
  await sleep(300);
  await twoLine.first().click();
  await sleep(1500);
  await page.screenshot({ path: join(OUT, 'twoline.png') });
  console.log('shot: twoline.png');
}

await browser.close();
console.log('done');
