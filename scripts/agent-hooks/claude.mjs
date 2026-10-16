#!/usr/bin/env node
// Claude Code adapter for the agent hooks. The hook logic lives in the sibling scripts, written for
// the payloads in .agents/hooks.json; this translates Claude Code's hook JSON (and its transcript
// format) into that shape, runs the hook, and translates the reply back. Wired up in
// .claude/settings.json:
//
//   claude.mjs session-start   SessionStart       snapshot dirty files, inject check status
//   claude.mjs guardrail       PostToolUse(edits), UserPromptSubmit
//                                                  problems in files changed this session
//   claude.mjs pre-tool-use    PreToolUse(Bash)   refuse git commands that sweep up others' work
//   claude.mjs stop            Stop               block once if the definition of done isn't met
//
// Like the hooks themselves, this fails open: any error is logged and Claude keeps working.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readInput, root } from './lib.mjs';

const event = process.argv[2];
const SCRIPT = { 'session-start': 'session-start.mjs', guardrail: 'pre-invocation.mjs', 'pre-tool-use': 'pre-tool-use.mjs', stop: 'stop.mjs' }[event];

// Bash commands that change files without a Write/Edit tool call (heredocs, sed -i, scripts).
const WRITES_FILES = /(^|[^<>&2])>{1,2}\s*[^&\s]|\bsed\s+-i|\btee\b|\bpython3?\b|\bnode\s+-e\b|\bmv\s|\bcp\s|\brm\s|\bln\s|\bpnpm\s+(run\s+)?new\b/;

/** Rewrite a Claude Code transcript into the step/tool_calls lines lib.mjs#readTranscript reads. */
function convertTranscript(file) {
  if (!file || !fs.existsSync(file)) return null;
  const out = [];
  fs.readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (!line.includes('tool_use')) return;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        return;
      }
      const calls = [];
      for (const c of entry.message?.content ?? []) {
        if (c.type !== 'tool_use') continue;
        const inp = c.input ?? {};
        if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(c.name) && (inp.file_path || inp.notebook_path)) {
          calls.push({ name: 'write_to_file', args: { TargetFile: inp.file_path ?? inp.notebook_path } });
        } else if (c.name === 'Bash' && typeof inp.command === 'string') {
          calls.push({ name: 'run_command', args: { CommandLine: inp.command } });
          // A shell write counts as a write, so "check ran after the last edit" stays honest.
          if (WRITES_FILES.test(inp.command) && !/pnpm\s+(run\s+)?check\b/.test(inp.command)) {
            calls.push({ name: 'write_to_file', args: { TargetFile: path.join(root, '.agents/.state/shell-write') } });
          }
        }
      }
      if (calls.length) out.push(JSON.stringify({ step_index: i, tool_calls: calls }));
    });
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hook-')), 'transcript.jsonl');
  fs.writeFileSync(tmp, out.join('\n'));
  return tmp;
}

function run(input) {
  const r = spawnSync('node', [path.join(root, 'scripts/agent-hooks', SCRIPT)], { cwd: root, input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 64 << 20 });
  try {
    return JSON.parse(r.stdout || '{}');
  } catch {
    return {};
  }
}

const say = (obj) => process.stdout.write(JSON.stringify(obj));

try {
  if (!SCRIPT) throw new Error(`unknown event ${event}`);
  const cc = await readInput();
  const base = { conversationId: cc.session_id, transcriptPath: convertTranscript(cc.transcript_path) };

  if (event === 'session-start') {
    const r = run(base);
    const text = r.injectSteps?.[0]?.systemMessage?.systemMessage;
    if (text) say({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: `${text}\n\nRead the end of the worklog first: tail -n 40 worklog.md` } });
  } else if (event === 'guardrail') {
    const r = run(base);
    const text = r.injectSteps?.[0]?.ephemeralMessage;
    const hookEventName = cc.hook_event_name === 'UserPromptSubmit' ? 'UserPromptSubmit' : 'PostToolUse';
    if (text) say({ hookSpecificOutput: { hookEventName, additionalContext: text } });
  } else if (event === 'pre-tool-use') {
    const r = run({ ...base, toolCall: { name: 'run_command', args: { CommandLine: cc.tool_input?.command ?? '' } } });
    if (r.decision === 'deny') say({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: r.reason } });
  } else if (event === 'stop') {
    // stop_hook_active: Claude is already continuing because of this hook; the hook's own
    // "raise each problem set once" memory decides whether to block again.
    const r = run(base);
    if (r.decision === 'continue') say({ decision: 'block', reason: r.reason });
  }
} catch (e) {
  fs.mkdirSync(path.join(root, '.agents/.state'), { recursive: true });
  fs.appendFileSync(path.join(root, '.agents/.state/hook-errors.log'), `${new Date().toISOString()} claude ${event}: ${e.stack ?? e}\n`);
}
