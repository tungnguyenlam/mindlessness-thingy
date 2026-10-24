#!/usr/bin/env node
// Behaviour test for principle keep-place (PRINCIPLES.md): follow a link, come back, land on the
// exact spot with interactive state intact. Runs against dist/, so build first.
//
//   pnpm run test:place            # assertions only
//   pnpm run test:place --shots    # also save screenshots to .scratch/place/
//
// Exits 0 with a notice when no Chrome is installed, except in CI where Chrome is required.
import { withPage } from './lib/browser.mjs';

const SHOTS = process.argv.includes('--shots') ? '.scratch/place' : null;
const results = [];

// Browsers either keep the page alive (back/forward cache) or reload it. Both must land on the spot.
const MODES = [
  { name: 'bfcache', flags: [] },
  { name: 'reload', flags: ['--disable-features=BackForwardCache'] },
];

async function scenario(mode) {
  const check = (name, ok, detail = '') => {
    results.push({ name: `${name} [${mode.name}]`, ok });
    console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  };

  await withPage({ width: 1280, height: 860, flags: mode.flags, motion: true }, async ({ goto, evaluate, click, key, wait, shot }) => {
    const snap = async (n) => SHOTS && shot(`${SHOTS}/${mode.name}-${n}.png`);
    const waitFor = async (expr, ms = 5000) => {
      const t = Date.now();
      while (Date.now() - t < ms) {
        if (await evaluate(expr).catch(() => false)) return true;
        await wait(80);
      }
      return false;
    };
    const backAt = async (path) => {
      await waitFor(`location.pathname.endsWith(${JSON.stringify(path)}) && document.readyState === 'complete'`);
      await waitFor(`!!document.querySelector('.place-here')`, 3000);
      await wait(1700); // let the settle loop finish
    };
    const stackSize = `JSON.parse(sessionStorage.getItem('trail:v1') || '[]').length`;
    const markVisible = (sel, attr) =>
      evaluate(`(() => {
        const a = [...document.querySelectorAll(${JSON.stringify(sel)})].find((l) => l.checkVisibility() && l.getClientRects().length && !l.closest('#trail'));
        a.setAttribute(${JSON.stringify(attr)}, ''); return a.getAttribute('href'); })()`);

    // ---- 1. Note -> note and back, with stepper + calculator state ----
    await goto('/notes/mla/');
    const setup = await evaluate(`(async () => {
      const st = document.querySelector('x-stepper');
      st?.restore(1);
      const r = document.querySelector('x-calc input[type=range]');
      if (r) { r.value = String(Number(r.max)); r.dispatchEvent(new Event('input')); }
      const links = [...document.querySelectorAll('.prose a.wikilink')].filter((l) => l.checkVisibility());
      const a = links.find((l) => l.getBoundingClientRect().top + scrollY > innerHeight * 0.8) ?? links.at(-1);
      a.setAttribute('data-test-target', '');
      scrollBy(0, a.getBoundingClientRect().top - 420);
      await new Promise((r) => setTimeout(r, 100));
      return { offset: a.getBoundingClientRect().top, text: a.textContent.trim(), href: a.getAttribute('href'),
               step: st?.i ?? null, slider: r?.value ?? null };
    })()`);
    await click('[data-test-target]', { navigates: true });

    const ribbon = await evaluate(`(() => {
      const t = document.getElementById('trail');
      return { shown: !t.hidden, label: t.querySelector('.trail-label')?.textContent ?? '', quote: t.querySelector('.trail-quote mark')?.textContent ?? '' };
    })()`);
    check('ribbon appears after following a link', ribbon.shown);
    check('ribbon names the page you left', /latent attention/i.test(ribbon.label), ribbon.label);
    check('ribbon quotes the link you clicked', ribbon.quote === setup.text, `${ribbon.quote} vs ${setup.text}`);
    await snap('1-ribbon');

    await click('.trail-back');
    await backAt('/notes/mla/');
    const back = await evaluate(`(() => {
      const a = [...document.querySelectorAll('a[href]')].filter((l) => l.getAttribute('href') === ${JSON.stringify(setup.href)})
        .find((l) => l.classList.contains('place-here'));
      const st = document.querySelector('x-stepper');
      const r = document.querySelector('x-calc input[type=range]');
      return { found: !!a, offset: a?.getBoundingClientRect().top ?? null, step: st?.i ?? null, slider: r?.value ?? null,
               trailHidden: document.getElementById('trail').hidden, card: !document.getElementById('preview-card').hidden };
    })()`);
    check('the clicked link is marked on return', back.found);
    check('the link is back at the same height on screen', back.offset !== null && Math.abs(back.offset - setup.offset) <= 4, `${back.offset?.toFixed(1)} vs ${setup.offset.toFixed(1)}`);
    if (setup.step !== null) check('stepper reopens on the same step', back.step === setup.step, `${back.step} vs ${setup.step}`);
    if (setup.slider !== null) check('calculator keeps its slider value', back.slider === setup.slider, `${back.slider} vs ${setup.slider}`);
    check('trail is empty after returning', back.trailHidden);
    check('no stale hover card on return', !back.card);
    await snap('2-returned');

    // ---- 2. Two hops deep (prose, then side panel), unwind with the B key ----
    await markVisible('.prose a.wikilink', 'data-hop1');
    await click('[data-hop1]', { navigates: true });
    await markVisible('aside.left a[data-slug]:not([aria-current])', 'data-hop2');
    await click('[data-hop2]', { navigates: true });
    check('two hops leave two stops on the trail', (await evaluate(stackSize)) === 2);
    await evaluate(`document.querySelector('.trail-more')?.click()`);
    const quotes = await evaluate(`[...document.querySelectorAll('#trail mark')].map((m) => m.textContent)`);
    check('quotes contain only visible text', quotes.length > 0 && quotes.every((q) => !/written by an agent|not written yet/i.test(q)), quotes.join(' | '));
    await snap('3-trail-list');
    await key('b');
    await waitFor(`${stackSize} === 1`);
    await key('b');
    await backAt('/notes/mla/');
    check('B key unwinds the trail back to the start', await evaluate(`location.pathname.endsWith('/notes/mla/')`));

    // ---- 3. Map node -> note -> back marks the node ----
    await goto('/');
    await waitFor(`!!document.querySelector('x-graph a.node')`);
    await wait(1500);
    const slug = await evaluate(`(() => { const a = document.querySelector('x-graph a.node[data-slug="mla"]') ?? document.querySelector('x-graph a.node'); a.setAttribute('data-test-node', ''); return a.dataset.slug; })()`);
    await click('[data-test-node]', { navigates: true });
    await click('.trail-back');
    await backAt('/');
    const node = await evaluate(`document.querySelector('x-graph a.node.place-here')?.dataset.slug ?? null`);
    check('map node you clicked is marked on return', node === slug, `${node} vs ${slug}`);
    await snap('4-map-return');
  });
}

async function main() {
  for (const mode of MODES) {
    console.log(`\n# ${mode.name}`);
    await scenario(mode);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} keep-place checks passed`);
  if (failed.length) {
    console.error('error [keep-place] Returning to the exact spot is broken. Read PRINCIPLES.md#keep-place and src/scripts/trail.ts before changing navigation, layout or interactive components.');
    process.exit(1);
  }
}

main().catch((e) => {
  if (/No Chrome/.test(e.message) && !process.env.CI) {
    console.warn(`skip  keep-place browser test: ${e.message}`);
    process.exit(0);
  }
  console.error(e);
  process.exit(1);
});
