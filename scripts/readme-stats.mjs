// Rewrites the visits section of README.md from GoatCounter: total visits and the most visited pages
// over the last 30 days. Run daily by .github/workflows/stats.yml; needs GOATCOUNTER_TOKEN (read statistics).
//   GOATCOUNTER_TOKEN=... node scripts/readme-stats.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const API = 'https://mindlessness.goatcounter.com/api/v0';
const SITE = 'https://tungnguyenlam.github.io';
const DAYS = 30;
const TOP = 10;
const START = '<!-- stats:start -->';
const END = '<!-- stats:end -->';

const token = process.env.GOATCOUNTER_TOKEN;
if (!token) throw new Error('GOATCOUNTER_TOKEN is not set');

const day = (d) => d.toISOString().slice(0, 10);
const end = new Date();
const start = new Date(end.getTime() - DAYS * 864e5);
const range = `start=${day(start)}&end=${day(end)}`;

async function get(path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

const total = await get(`/stats/total?${range}`);
const hits = await get(`/stats/hits?${range}&limit=${TOP}`);

const count = (h) => h.count ?? h.count_unique ?? 0;
const cell = (s) => String(s).replace(/\|/g, '\\|');
const rows = (hits.hits ?? [])
  .filter((h) => !h.event)
  .map((h) => `| [${cell(h.title || h.path)}](${SITE}${h.path}) | ${count(h).toLocaleString('en')} |`);

const section = [
  START,
  `Visits in the last ${DAYS} days: **${(total.total ?? 0).toLocaleString('en')}** (updated ${day(end)}).`,
  '',
  ...(rows.length ? ['| Most visited pages | Visits |', '| --- | ---: |', ...rows] : ['No visits recorded yet.']),
  END,
].join('\n');

const readme = readFileSync('README.md', 'utf8');
const a = readme.indexOf(START);
const b = readme.indexOf(END);
if (a < 0 || b < a) throw new Error(`README.md needs ${START} and ${END} markers`);
writeFileSync('README.md', readme.slice(0, a) + section + readme.slice(b + END.length));
console.log(section);
