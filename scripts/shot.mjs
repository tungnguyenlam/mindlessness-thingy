#!/usr/bin/env node
// Screenshot a page so you can look at what you built (PRINCIPLES.md#visual-first).
//
//   pnpm run shot /notes/mla/                      viewport shot -> .scratch/shots/notes-mla.png
//   pnpm run shot /notes/mla/ --full               whole page
//   pnpm run shot /notes/mla/ --click "x-stepper button[data-dir='1']" --click "..."   interact first
//   pnpm run shot / --width 390 --out .scratch/shots/home-mobile.png
//   pnpm run shot /notes/mla/ --select figure.arch      every match, cropped: notes-mla-figure-arch-1.png ...
//                                                        (cheaper to look at than a full page)
//   pnpm run shot /notes/mla/ --motion              run the animations (default: reduced motion, the settled page)
//
// Rebuilds dist/ first when anything under src/ is newer than the last build.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DIST, withPage } from './lib/browser.mjs';

const args = process.argv.slice(2).filter((a) => a !== '--');
const page = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) ?? '/';
const opt = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : d;
};
const all = (f) => args.flatMap((a, i) => (a === f ? [args[i + 1]] : []));
const width = Number(opt('--width', 1280));
const height = Number(opt('--height', 900));
const name = page.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'home';
const out = opt('--out', `.scratch/shots/${name}${width < 600 ? '-mobile' : ''}.png`);

function newest(dir) {
  let t = 0;
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    t = Math.max(t, d.isDirectory() ? newest(p) : fs.statSync(p).mtimeMs);
  }
  return t;
}
const built = fs.existsSync(path.join(DIST, 'index.html')) ? fs.statSync(path.join(DIST, 'index.html')).mtimeMs : 0;
if (newest('src') > built) {
  console.log('dist/ is older than src/, building first...');
  execFileSync('pnpm', ['exec', 'astro', 'build', '--silent'], { stdio: 'inherit' });
}

await withPage({ width, height, motion: args.includes('--motion') }, async ({ goto, click, wait, shot, evaluate }) => {
  await goto(page);
  await wait(Number(opt('--wait', 400)));
  for (const sel of all('--click')) await click(sel);
  const select = opt('--select');
  if (select) {
    const n = await evaluate(`document.querySelectorAll(${JSON.stringify(select)}).length`);
    if (!n) throw new Error(`no element matches ${select}`);
    const stem = out.replace(/\.png$/, `-${select.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`);
    for (let i = 0; i < n; i++) console.log(`saved ${await shot(`${stem}-${i + 1}.png`, { select, index: i })}`);
    return;
  }
  await shot(out, { full: args.includes('--full') });
  console.log(`saved ${out}`);
});
