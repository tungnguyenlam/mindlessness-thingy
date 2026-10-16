#!/usr/bin/env node
// Stop: when the agent tries to finish, block once if its work isn't done by the definition in
// AGENTS.md#task-lifecycle (checks pass, no status promotion, full check run after the last edit,
// own files committed). The same problem set is only raised once, so an agent that is deliberately
// stopping (e.g. to ask a question) can stop on its second try.
import { fingerprint, formatProblem, hook, list, promotions, runCheck, saveState, sessionFiles } from './lib.mjs';

const NEEDS_FULL_CHECK = /^(src|scripts|templates)\/|^(astro\.config\.mjs|package\.json|AGENTS\.md|PRINCIPLES\.md)$/;

await hook('stop', async (input) => {
  if (input.terminationReason && input.terminationReason !== 'NO_TOOL_CALL') return { decision: 'allow' };
  if (input.fullyIdle === false) return { decision: 'allow' };

  const { files, state, transcript } = sessionFiles(input);
  if (!files.length) return { decision: 'allow' };

  const items = [];
  const errors = runCheck(files).errors ?? [];
  if (errors.length) items.push(`Checks fail in your files:\n${errors.slice(0, 8).map(formatProblem).join('\n')}`);

  const promoted = promotions(files);
  if (promoted.length) items.push(`[agent-status] You promoted ${promoted.map((p) => `${p.file} (${p.from} -> ${p.to})`).join(', ')}. Set them back to draft.`);

  if (files.some((f) => NEEDS_FULL_CHECK.test(f)) && transcript.lastWrite > transcript.lastCheck) {
    items.push('`pnpm run check` has not run since your last edit. Run it (graph checks + build + keep-place browser test) and fix what it reports.');
  }

  items.push(`[commit-when-done] Uncommitted files you changed: ${list(files, 12)}. Stage them by path and commit with a conventional message (.agents/skills/finish-task/SKILL.md).`);

  const fp = fingerprint(items);
  if (state.lastStop === fp) return { decision: 'allow' };
  saveState(input.conversationId, { ...state, lastStop: fp });

  return {
    decision: 'continue',
    reason: [
      'Before you finish (AGENTS.md#task-lifecycle):',
      ...items.map((t, i) => `${i + 1}. ${t}`),
      'If some of these files belong to another agent working in parallel, leave them and say so. If you are deliberately stopping (for example to ask the owner a question), say that in one line and end your turn again; this reminder will not repeat for the same state.',
    ].join('\n'),
  };
}, { decision: 'allow' });
