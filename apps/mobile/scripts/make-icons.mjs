/**
 * Renders the Android app icon, adaptive-icon foreground, splash image and an in-app emblem from the
 * ACEE logo SVGs in apps/web/public. Re-run after a logo change:  node apps/mobile/scripts/make-icons.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const emblem = readFileSync(here('../../web/public/acee-emblem.svg'), 'utf8');
const logo = readFileSync(here('../../web/public/acee-logo.svg'), 'utf8');

const jobs = [
  // Legacy square icon: emblem on white.
  { out: 'icon.png', size: [1024, 1024], bg: '#FFFFFF', svg: emblem, box: 0.72 },
  // Adaptive icon foreground: Android masks to the centre ~66%, so keep the emblem inside it.
  { out: 'adaptive-icon.png', size: [1024, 1024], bg: 'transparent', svg: emblem, box: 0.5 },
  // Splash: full logo, shown on a white background (app.json).
  { out: 'splash-icon.png', size: [1200, 400], bg: 'transparent', svg: logo, box: 0.94 },
  // Small emblem used inside the app (welcome screen).
  { out: 'emblem.png', size: [256, 256], bg: 'transparent', svg: emblem, box: 1 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const j of jobs) {
  const [w, h] = j.size;
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;width:${w}px;height:${h}px;display:grid;place-items:center;background:${j.bg}">
    <div style="width:${w * j.box}px;height:${h * j.box}px">${j.svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`);
  await page.screenshot({ path: here(`../assets/${j.out}`), omitBackground: j.bg === 'transparent' });
  console.log('wrote', j.out);
}
await browser.close();
