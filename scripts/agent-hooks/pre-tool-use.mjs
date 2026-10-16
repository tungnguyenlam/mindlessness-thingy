#!/usr/bin/env node
// PreToolUse (run_command): refuse git commands that sweep up other people's work, destroy it,
// or skip the checks. Everything else gets no opinion ({}), so normal permission prompts apply.
import { hook } from './lib.mjs';

const RULES = [
  {
    sub: 'add',
    bad: (a) => a.some((x) => ['-A', '--all', '.', './', '-u', '--update', ':/', '*'].includes(x)),
    why: 'stages everything, including other agents\' uncommitted work. Stage your files by path: git add path/one path/two',
  },
  {
    sub: 'commit',
    bad: (a) => a.some((x) => x === '--all' || /^-[a-zA-Z]*a[a-zA-Z]*$/.test(x)),
    why: 'commits every modified file. Stage your files by path first, then git commit -m "type(scope): subject"',
  },
  {
    sub: 'commit',
    bad: (a) => a.some((x) => x === '--no-verify' || x === '-n'),
    why: 'skips the pre-commit checks. Fix what the hook reports instead.',
  },
  { sub: 'stash', bad: () => true, why: 'hides other agents\' uncommitted work. Leave files you did not change alone.' },
  { sub: 'reset', bad: (a) => a.includes('--hard'), why: 'destroys uncommitted work, possibly someone else\'s.' },
  { sub: 'clean', bad: (a) => a.some((x) => /^-[a-zA-Z]*f/.test(x) || x === '--force'), why: 'deletes untracked files, possibly someone else\'s new notes.' },
  { sub: 'checkout', bad: (a) => a.includes('.') || (a.includes('--') && a.at(-1) === '.'), why: 'discards all uncommitted changes. Restore single files you changed by path, if you must.' },
  { sub: 'restore', bad: (a) => a.includes('.'), why: 'discards all uncommitted changes. Restore single files you changed by path, if you must.' },
  { sub: 'push', bad: (a) => a.some((x) => ['--force', '-f', '--force-with-lease'].includes(x) || x.startsWith('+')), why: 'rewrites shared history.' },
  { sub: 'config', bad: (a) => a.includes('--global') || a.includes('--system'), why: 'changes the owner\'s machine-wide settings. For a missing identity use git -c user.name=... -c user.email=... commit (see finish-task skill).' },
];

function gitCalls(cmd) {
  const calls = [];
  for (const seg of cmd.split(/&&|\|\||;|\||\n/)) {
    const t = seg.trim().split(/\s+/).map((x) => x.replace(/^['"]|['"]$/g, ''));
    let i = t.indexOf('git');
    if (i < 0) continue;
    const globals = [];
    i++;
    while (t[i]?.startsWith('-')) {
      globals.push(t[i]);
      if (t[i] === '-c' || t[i] === '-C') globals.push(t[++i]);
      i++;
    }
    calls.push({ sub: t[i], args: t.slice(i + 1), globals });
  }
  return calls;
}

await hook(
  'pre-tool-use',
  async (input) => {
    const call = input.toolCall ?? {};
    if (call.name !== 'run_command') return { decision: 'allow' };
    let cmd = call.args?.CommandLine ?? '';
    try {
      if (typeof cmd === 'string' && cmd.startsWith('"')) cmd = JSON.parse(cmd);
    } catch {
      /* plain string */
    }
    for (const g of gitCalls(String(cmd))) {
      if (g.globals.some((x) => /^core\.hooksPath=/.test(x))) {
        return { decision: 'deny', reason: 'Refused [commit-when-done]: overriding core.hooksPath skips the repo checks.' };
      }
      const rule = RULES.find((r) => r.sub === g.sub && r.bad(g.args));
      if (rule) return { decision: 'deny', reason: `Refused [commit-when-done]: \`git ${g.sub} ${g.args.join(' ')}\` ${rule.why}` };
    }
    return { decision: 'allow' };
  },
  { decision: 'allow' },
);
