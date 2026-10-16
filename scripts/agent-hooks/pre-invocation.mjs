#!/usr/bin/env node
// PreInvocation: before each model turn, check the files this agent changed and, if something is
// wrong, tell it now (as a transient message) instead of at the end.
import { formatProblem, hook, promotions, runCheck, sessionFiles } from './lib.mjs';

await hook('pre-invocation', async (input) => {
  const { files } = sessionFiles(input);
  if (!files.length) return {};

  const problems = [...(runCheck(files).errors ?? [])];
  for (const p of promotions(files)) {
    problems.push({
      rule: 'agent-status',
      file: p.file,
      msg: `status changed ${p.from} -> ${p.to}`,
      fix: 'agents only write stub or draft; set it back to draft. Only the owner promotes notes.',
    });
  }
  if (!problems.length) return {};

  const text = [
    `Guardrail: ${problems.length} problem(s) in files you changed this session. Fix them before moving on; each names the rule it breaks (AGENTS.md#rules):`,
    ...problems.slice(0, 12).map(formatProblem),
    'Re-run `pnpm run check:graph` after fixing.',
  ].join('\n');
  return { injectSteps: [{ ephemeralMessage: text }] };
});
