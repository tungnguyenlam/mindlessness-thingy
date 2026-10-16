// Shared helpers for the agent hooks wired up in .agents/hooks.json.
// Hooks read a JSON payload on stdin and print a JSON reply on stdout. They must never take the
// agent down: any internal error is logged to .agents/.state/hook-errors.log and the hook replies {}.
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const stateDir = path.join(root, '.agents/.state');

export async function readInput() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

export const reply = (obj = {}) => process.stdout.write(JSON.stringify(obj));

/** Run a hook body; on any failure log it and reply with `fallback` so the agent keeps working. */
export async function hook(name, body, fallback = {}) {
  try {
    reply(await body(await readInput()));
  } catch (e) {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.appendFileSync(path.join(stateDir, 'hook-errors.log'), `${new Date().toISOString()} ${name}: ${e.stack ?? e}\n`);
    reply(fallback);
  }
}

export const git = (args, input) => execFileSync('git', args, { cwd: root, encoding: 'utf8', input, maxBuffer: 64 << 20 });

/** Uncommitted files (tracked changes and untracked files) mapped to a content hash. */
export function dirtyFiles() {
  const tokens = git(['status', '--porcelain=v1', '-z', '-uall']).split('\0').filter(Boolean);
  const paths = [];
  for (let i = 0; i < tokens.length; i++) {
    const status = tokens[i].slice(0, 2);
    paths.push(tokens[i].slice(3));
    if (status[0] === 'R' || status[0] === 'C') i++; // -z puts the original path in the next token
  }
  const present = paths.filter((p) => fs.existsSync(path.join(root, p)) && fs.statSync(path.join(root, p)).isFile());
  const hashes = present.length ? git(['hash-object', '--stdin-paths'], present.join('\n')).trim().split('\n') : [];
  const map = new Map(paths.map((p) => [p, 'deleted']));
  present.forEach((p, i) => map.set(p, hashes[i]));
  return map;
}

const stateFile = (id) => path.join(stateDir, `${id || 'unknown'}.json`);
export function loadState(id) {
  try {
    return JSON.parse(fs.readFileSync(stateFile(id), 'utf8'));
  } catch {
    return {};
  }
}
export function saveState(id, state) {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(stateFile(id), JSON.stringify(state));
}

const WRITE_TOOLS = /write_to_file|replace_file_content|multi_replace|edit_file|create_file|apply_patch/;
const FULL_CHECK = /(?:^|&&|;|\|\||\n)\s*(?:timeout\s+\d+\s+)?pnpm\s+(?:run\s+)?check(?=\s|$|;|&|\|)/;
const unwrap = (v) => {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
};

/**
 * What the transcript says this agent did: files it wrote, and the step indexes of its last write
 * and its last full `pnpm run check`.
 */
export function readTranscript(transcriptPath) {
  const out = { files: new Set(), lastWrite: -1, lastCheck: -1 };
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return out;
  const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
  lines.forEach((line, idx) => {
    if (!line.includes('tool_calls')) return;
    let step;
    try {
      step = JSON.parse(line);
    } catch {
      return;
    }
    const at = step.step_index ?? idx;
    for (const call of step.tool_calls ?? []) {
      const args = Object.fromEntries(Object.entries(call.args ?? {}).map(([k, v]) => [k, unwrap(v)]));
      if (WRITE_TOOLS.test(call.name) && typeof args.TargetFile === 'string') {
        const rel = path.relative(root, args.TargetFile);
        if (!rel.startsWith('..')) out.files.add(rel);
        out.lastWrite = Math.max(out.lastWrite, at);
      }
      if (call.name === 'run_command' && typeof args.CommandLine === 'string') {
        const cmd = args.CommandLine;
        for (const m of cmd.matchAll(/pnpm\s+(?:run\s+)?new\s+(?:--\s+)?(concept|system|path)\s+([a-z0-9-]+)/g)) {
          out.files.add(`src/content/notes/${{ concept: 'concepts', system: 'systems', path: 'paths' }[m[1]]}/${m[2]}.mdx`);
          out.lastWrite = Math.max(out.lastWrite, at);
        }
        if (FULL_CHECK.test(cmd)) out.lastCheck = Math.max(out.lastCheck, at);
      }
    }
  });
  return out;
}

/**
 * Files this agent changed and hasn't committed: anything that differs from the snapshot taken at
 * session start, plus anything the transcript shows it writing. Files that were already dirty and
 * untouched are someone else's.
 */
export function sessionFiles(input) {
  const now = dirtyFiles();
  const state = loadState(input.conversationId);
  const transcript = readTranscript(input.transcriptPath);
  const files = new Set();
  if (state.start) for (const [p, h] of now) if (state.start.dirty[p] !== h) files.add(p);
  for (const p of transcript.files) if (now.has(p)) files.add(p);
  return { files: [...files].sort(), now, state, transcript };
}

/** `scripts/check.mjs --json`, scoped to `files` (errors elsewhere come back as outOfScope). */
export function runCheck(files) {
  const args = ['scripts/check.mjs', '--json'];
  if (files) args.push('--files', files.join(','));
  const r = spawnSync('node', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 });
  try {
    return JSON.parse(r.stdout);
  } catch {
    return { errors: [{ rule: 'catalog-sync', file: 'scripts/check.mjs', msg: `check crashed: ${(r.stderr || '').slice(0, 300)}` }], warnings: [], outOfScope: [] };
  }
}

/** Notes in `files` whose status became reviewed/verified compared with HEAD (rule agent-status). */
export function promotions(files) {
  const found = [];
  for (const f of files) {
    if (!/^src\/content\/notes\/.+\.mdx$/.test(f) || !fs.existsSync(path.join(root, f))) continue;
    const now = fs.readFileSync(path.join(root, f), 'utf8').match(/^status:\s*(\w+)/m)?.[1];
    if (now !== 'reviewed' && now !== 'verified') continue;
    let before = null;
    try {
      before = git(['show', `HEAD:${f}`]).match(/^status:\s*(\w+)/m)?.[1] ?? null;
    } catch {
      /* new file */
    }
    if (before !== now) found.push({ file: f, from: before ?? 'new', to: now });
  }
  return found;
}

export const fingerprint = (x) => crypto.createHash('sha1').update(JSON.stringify(x)).digest('hex');

export const formatProblem = (p) => `- [${p.rule}] ${p.file}: ${p.msg}${p.fix ? `\n  fix: ${p.fix}` : ''}`;
export const list = (items, n = 8) => (items.length > n ? [...items.slice(0, n), `… and ${items.length - n} more`] : items).join(', ');
