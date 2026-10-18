#!/usr/bin/env node
// Browser test for rule render-clean (AGENTS.md): load every page at desktop and phone width and
// inspect what actually rendered, with real fonts. Catches what static checks can't see: text
// spilling out of diagram blocks, labels drawn over each other, sideways page scroll on a phone,
// KaTeX errors and script errors. Runs against dist/, so build first.
//
//   node scripts/test-visual.mjs                 all pages
//   node scripts/test-visual.mjs /notes/mla/     some pages
//   node scripts/test-visual.mjs --selftest      plant one fault of each kind and make sure it's caught
//
// Problems are reported against the file the author edits (the note's .mdx or the page's .astro),
// with a stable code, so scripts/baseline.json can grandfather existing ones like check.mjs does.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNotes } from '../src/lib/content-index.mjs';
import { withPage } from './lib/browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Laptop first (the page is opened at it), then a phone and a wide monitor, where type and diagrams grow.
const WIDTHS = [1280, 390, 2560];
const notes = loadNotes();
const only = process.argv.slice(2).filter((a) => a.startsWith('/'));
const pages = only.length
  ? only
  : ['/', '/compare/', '/sources/', ...notes.map((n) => `/notes/${n.slug}/`)];
const fileFor = (p) => {
  const m = p.match(/^\/notes\/([^/]+)\//);
  if (m) return notes.find((n) => n.slug === m[1])?.file ?? p;
  return `src/pages/${p === '/' ? 'index' : p.replace(/^\/|\/$/g, '')}.astro`;
};
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'scripts/baseline.json'), 'utf8')).entries ?? {};

// Runs in the page. Returns [{ code, msg }].
const INSPECT = `(() => {
  // Tabbed components mark their hidden panels data-test-reveal: show them all so every view is inspected.
  for (const el of document.querySelectorAll('[data-test-reveal]')) el.hidden = false;
  const out = [];
  const push = (code, msg) => out.push({ code, msg });
  const doc = document.documentElement;
  if (doc.scrollWidth > innerWidth + 1) {
    const wide = [...document.querySelectorAll('main *')].filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.right <= innerWidth + 1 || !r.width) return false;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === 'auto' || o === 'scroll' || o === 'hidden') return false;
      }
      return true;
    });
    const el = wide[0];
    const name = el ? el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') : 'something';
    push('page-overflow', 'page scrolls sideways (' + doc.scrollWidth + 'px > ' + innerWidth + 'px), widest: ' + name);
  }
  for (const fig of document.querySelectorAll('figure.arch')) {
    const title = fig.querySelector('svg title')?.textContent ?? 'diagram';
    for (const g of fig.querySelectorAll('.block')) {
      const rect = g.querySelector('rect').getBoundingClientRect();
      for (const t of g.querySelectorAll('text')) {
        const b = t.getBoundingClientRect();
        if (b.width > rect.width - 2) push('text-overflow', '"' + title + '": "' + t.textContent + '" is wider than its block');
      }
    }
    const texts = [...fig.querySelectorAll('svg text')].map((t) => ({ t, b: t.getBoundingClientRect() })).filter((x) => x.b.width);
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i].b, c = texts[j].b;
      const ix = Math.min(a.right, c.right) - Math.max(a.left, c.left);
      const iy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
      if (ix > 2 && iy > 2) push('text-collision', '"' + title + '": "' + texts[i].t.textContent + '" overlaps "' + texts[j].t.textContent + '"');
    }
    const svg = fig.querySelector('svg');
    const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
    if (scale * 13 < 8.5) push('text-tiny', '"' + title + '": labels render at ' + (scale * 13).toFixed(1) + 'px');
  }
  for (const e of document.querySelectorAll('.katex-error')) push('katex', 'KaTeX error: ' + (e.getAttribute('title') ?? e.textContent).slice(0, 120));
  for (const e of window.__renderErrors ?? []) push('script-error', e.slice(0, 200));
  return out;
})()`;

const CAPTURE = `window.__renderErrors = [];
addEventListener('error', (e) => window.__renderErrors.push(String(e.message || e.error)));
addEventListener('unhandledrejection', (e) => window.__renderErrors.push('unhandled rejection: ' + String(e.reason)));
const ce = console.error; console.error = (...a) => { window.__renderErrors.push(a.map(String).join(' ')); ce.apply(console, a); };`;

// Faults the inspector must find. Run with --selftest after changing INSPECT.
const PLANT = `(() => {
  const main = document.querySelector('main');
  const wide = document.createElement('div'); wide.style.width = '3000px'; wide.textContent = 'wide'; main.append(wide);
  const svg = document.querySelector('figure.arch svg');
  const t = svg.querySelector('.block text').cloneNode(true); t.setAttribute('class', 'planted'); svg.querySelector('.block').append(t);
  const big = svg.querySelector('.block text'); big.textContent = 'An absurdly long label that cannot possibly fit inside its block';
  const k = document.createElement('span'); k.className = 'katex-error'; k.title = 'planted'; main.append(k);
  console.error('planted error');
})()`;

async function selftest() {
  await withPage({ width: 390, height: 900 }, async ({ goto, evaluate, page }) => {
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: CAPTURE });
    await goto('/notes/hybrid-conv-attention/');
    await evaluate(PLANT);
    const found = new Set((await evaluate(INSPECT)).map((r) => r.code));
    const want = ['page-overflow', 'text-overflow', 'text-collision', 'katex', 'script-error'];
    const missed = want.filter((c) => !found.has(c));
    for (const c of want) console.log(`${missed.includes(c) ? 'MISS' : 'ok  '}  ${c}`);
    if (missed.length) process.exit(1);
  });
}

async function main() {
  if (process.argv.includes('--selftest')) return selftest();
  const problems = [];
  await withPage({ width: WIDTHS[0], height: 900 }, async ({ goto, evaluate, page }) => {
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: CAPTURE });
    for (const width of WIDTHS) {
      await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
      for (const p of pages) {
        await goto(p);
        const seen = new Set();
        for (const r of await evaluate(INSPECT)) {
          const key = `${r.code}|${r.msg}`;
          if (seen.has(key)) continue;
          seen.add(key);
          problems.push({ ...r, page: p, width, file: fileFor(p) });
        }
      }
    }
  });

  let errors = 0;
  for (const pr of problems) {
    const grandfathered = baseline[pr.file]?.includes(pr.code);
    const level = grandfathered ? 'warn ' : 'error';
    if (!grandfathered) errors++;
    console[grandfathered ? 'warn' : 'error'](`${level} [render-clean] ${pr.file} @${pr.width}px: ${pr.msg}${grandfathered ? ' (baselined)' : ''}`);
  }
  console.log(`\n${pages.length} pages × ${WIDTHS.length} widths inspected, ${errors} error(s)`);
  if (errors) {
    console.error('fix: look at it with pnpm run shot <page> --width <px> --select figure.arch; shorten labels, let wide content scroll inside its figure, fix the math. Rule: render-clean → AGENTS.md#rules');
    process.exit(1);
  }
}

main().catch((e) => {
  if (/No Chrome/.test(e.message) && !process.env.CI) {
    console.warn(`skip  render-clean browser test: ${e.message}`);
    process.exit(0);
  }
  console.error(e);
  process.exit(1);
});
