#!/usr/bin/env node
// SessionStart: snapshot which files are already dirty (so later hooks know what is *not* this
// agent's work) and orient the agent with the current check status.
import { dirtyFiles, formatProblem, git, hook, list, runCheck, saveState } from './lib.mjs';

await hook('session-start', async (input) => {
  const dirty = dirtyFiles();
  saveState(input.conversationId, {
    start: { at: new Date().toISOString(), head: git(['rev-parse', 'HEAD']).trim(), dirty: Object.fromEntries(dirty) },
  });

  const check = runCheck();
  const errors = check.errors ?? [];
  const lines = [
    'Guardrails are active in this repo. Read AGENTS.md ("Start here" and "When the system corrects you") and PRINCIPLES.md before you change anything.',
    errors.length
      ? `Check status: ${errors.length} error(s) already present before you started:\n${errors.slice(0, 5).map(formatProblem).join('\n')}`
      : 'Check status: graph checks pass.',
  ];
  if (dirty.size) {
    lines.push(
      `Already changed before this session (${dirty.size} file(s), not yours: don't stage, stash or revert them): ${list([...dirty.keys()])}`,
    );
  }
  lines.push('Finish every task with: pnpm run check, look at visuals with pnpm run shot, then commit only your files, run pnpm run ci and push once it passes (skill finish-task).');
  return { injectSteps: [{ systemMessage: { systemMessage: lines.join('\n\n') } }] };
});
