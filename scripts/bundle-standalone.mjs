/**
 * Bundles the production build into a single self-contained HTML page.
 *
 * The output inlines the CSS and JS from `dist/`, so the page makes no network
 * request at all and can be opened directly from disk, emailed, or published to
 * a host with a strict content-security policy.
 *
 * The page is emitted as body content only — no <html>, <head> or <body> tags —
 * because the intended host wraps it in a document skeleton. Opening the file
 * directly in a browser still works: browsers construct the implied document
 * structure around it.
 *
 * Usage:  npm run build && node scripts/bundle-standalone.mjs
 * Output: dist/tasmania-martial-arts-championship.html
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const ASSETS = join(DIST, 'assets');
const OUTPUT = join(DIST, 'tasmania-martial-arts-championship.html');

function findAsset(extension) {
  const match = readdirSync(ASSETS).find((name) => name.endsWith(extension));
  if (!match) {
    throw new Error(
      `No ${extension} file found in ${ASSETS}. Run "npm run build" before bundling.`,
    );
  }
  return readFileSync(join(ASSETS, match), 'utf8');
}

const css = findAsset('.css');
const js = findAsset('.js');

// A closing script tag inside a string literal would terminate the inline
// script element early; the escaped form is equivalent to the parser.
const safeJs = js.replaceAll('</script', '<\\/script');

const html = `<title>Tasmania Martial Arts Championship</title>

<style>
/*
 * The game commits to a single dark visual world — a training hall at night.
 * Declaring the scheme stops a light-themed host from forcing a white ground
 * underneath it, and the html/body rules below win over any host reset because
 * this style block is parsed after it.
 */
:root {
  color-scheme: dark;
}

html,
body {
  height: 100%;
  margin: 0;
  padding: 0;
  background: #080b11;
  color: #eef2f8;
  overflow-x: hidden;
}

/* The game mounts here and manages its own layout from this point down. */
#root {
  height: 100%;
  isolation: isolate;
}

.tmac-boot {
  display: grid;
  place-items: center;
  gap: 1rem;
  min-height: 100vh;
  padding: 2rem;
  text-align: center;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  color: #a4b1c4;
}

.tmac-boot__title {
  font-size: 1.25rem;
  color: #eef2f8;
}

@media (prefers-reduced-motion: no-preference) {
  .tmac-boot__spinner {
    animation: tmac-spin 900ms linear infinite;
  }
}

.tmac-boot__spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 3px solid #2a3648;
  border-top-color: #4d86e8;
  border-radius: 50%;
}

@keyframes tmac-spin {
  to {
    transform: rotate(360deg);
  }
}

${css}
</style>

<div id="root">
  <div class="tmac-boot">
    <div class="tmac-boot__spinner" role="presentation"></div>
    <p class="tmac-boot__title">Loading the dojo…</p>
    <p>If this message stays on screen, JavaScript is disabled or blocked in this browser.</p>
  </div>
</div>

<script type="module">
${safeJs}
</script>
`;

writeFileSync(OUTPUT, html, 'utf8');

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
console.log(`Wrote ${OUTPUT} (${kb} kB, fully self-contained — no external requests)`);
