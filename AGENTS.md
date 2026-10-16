# Agent guide

This repo is a visual notebook for learning how ML systems are built. It is an Astro site. Notes are MDX files that link to each other, and the site builds a graph from those links.

## Start here, every task

1. Read `PRINCIPLES.md`. It is short and it explains *why* the rules below exist. The two principles that shape most work are `keep-place` (a reader can always return to the exact spot a link was clicked) and `visual-first` (show the idea before explaining it).
2. Read the end of the worklog: `tail -n 40 worklog.md`. **Never open the whole file**; it grows forever. Newest entries are at the bottom, so read upward and stop once you have enough context.
3. Run `git status` and note which changes already exist. **Those aren't yours**: another agent or the owner may be mid-task. Don't edit, stage, stash or revert them.
4. Pick the workflow skill for the job and follow it step by step:
   - `.agents/skills/write-article/SKILL.md`: write or extend a note, stub or learning path.
   - `.agents/skills/site-feature/SKILL.md`: change the site itself (components, layout, scripts, styles).
   - `.agents/skills/finish-task/SKILL.md`: **always the last step.** Check, look, commit, report.

## Rules

Each rule has an id. When `pnpm run check`, a test, a git hook or an agent hook finds a problem, it prints the id (`error [visual-first] ...`) and a `fix:` line. Re-read the rule, fix the cause, run the check again.

1. `one-idea`: **One idea per note.** If an explanation already exists in another note, link to it with `[[slug]]` and don't re-explain it. A system note (a model) explains what it combines and what is new, not the ideas it reuses.
2. `sourced-numbers`: **No unsourced numbers.** Every architecture number (layers, hidden size, expert count, head dims, token counts, speedups) comes from a paper, tech report or `config.json`, never from memory. Put numbers in `<Spec>` rows with a `source`, or cite inline with `<Cite id="..." where="§x" />`. If you can't find a primary source, leave the number out and say it's unverified.
3. `agent-status`: **Never mark a note `reviewed` or `verified`.** Agents write `stub` or `draft`. Only the human owner promotes status.
4. `no-dangling`: **Create stubs, don't leave dangling links.** If you need to link to an idea that has no note, create a stub with `pnpm run new concept <slug> "Title"`, give it a real one-sentence `summary` and its typed links, and leave the body as a placeholder.
5. `reading-order`: **`prerequisites` and `builds_on` form a DAG.** Use `related` for anything that isn't a true dependency.
6. `wikilinks`: **Link notes with `[[slug]]`**, never with a raw `/notes/...` URL. Wikilinks are checked, get hover previews and join the return trail.
7. `visual-first`: **Every written concept or system note has a visual**, placed before the prose it illustrates. See `PRINCIPLES.md#visual-first`.
8. `keep-place`: **Never break the return trail.** Pages render inside `Base`, interactive components are restorable, navigation uses real links. See the contract in `PRINCIPLES.md#keep-place`.
9. `template-complete`: **No `{/* TODO */}` markers left in a written note.** Templates use them as fill-in prompts; the check fails until each one is replaced.
10. `commit-when-done`: **Finish every task with `pnpm run check` passing and a commit of only your own files.** See the task lifecycle below.

### When the system corrects you

- At session start, a hook tells you the current check status and which files were already changed before you began.
- Before each of your turns, a hook may add a **Guardrail** message listing problems in files you touched. Fix them before moving on.
- When you try to finish, a stop hook blocks once if checks fail in your files, a note was promoted past `draft`, `pnpm run check` hasn't run since your last edit, or your files aren't committed. If you're intentionally stopping (for example to ask the owner a question), say so and stop again; the same reminder isn't repeated.
- Some commands are refused outright: `git add -A`/`.`, `git commit -a`, `--no-verify`, `git stash`, `git reset --hard`, `git clean`, `git push --force`, `git config --global`. They either sweep up other people's work or skip the checks.
- Don't silence a check to get past it (editing `scripts/checks/`, deleting a test, lowering a threshold) unless changing that check *is* the task, and then say so in the commit message.

How all of this fits together, and how to add a new rule, is in `docs/guardrails.md`.

## Task lifecycle

1. **Orient.** `git status`; `tail -n 40 worklog.md`; read `PRINCIPLES.md` and the skill for the job.
2. **Build** with the skill, using the templates in `templates/notes/` for new notes.
3. **Check.** `pnpm run check` must pass: graph checks, full build, then the keep-place browser test.
4. **Look.** `pnpm run shot /notes/<slug>/` and open the PNG for anything visual you changed.
5. **Log.** Append one entry to `worklog.md` with the shell (format and command in `docs/workflow.md#the-worklog`) and stage it with your files.
6. **Commit.** Stage your files by path and commit with a conventional message (`content(mla): ...`, `feat(trail): ...`). The `commit-msg` hook enforces the format and `pre-commit` reruns the checks on staged files. Details in `.agents/skills/finish-task/SKILL.md`.
7. **Report** what changed, what you committed, and anything unverified.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm run check` | Everything: graph checks, `astro build`, keep-place browser test. Must pass before committing. |
| `pnpm run check:graph` | Fast content and contract checks only (well under a second). Add `--files a,b` to scope, `--json` for tools. |
| `pnpm run new <kind> <slug> "Title"` | New stub. Add `--draft` to scaffold a full note from `templates/notes/<kind>.mdx`. |
| `pnpm run shot <path>` | Screenshot a page to `.scratch/shots/`. Options: `--full`, `--width`, `--click <selector>`, `--out <file>`. |
| `pnpm run test:place` | Just the keep-place browser test (`--shots` saves screenshots). |
| `pnpm run dev` | Local site at http://localhost:4321/mindlessness-thingy/ |

## Layout

```
PRINCIPLES.md                 what reading here should feel like; ids cited by checks
CLAUDE.md                     symlink to this file, so Claude Code loads the same rules
worklog.md                    append-only task log, newest at the bottom; read with tail only
src/content/notes/concepts/   one idea each: mla.mdx, kv-cache.mdx
src/content/notes/systems/    a specific model or system: deepseek-v3.mdx
src/content/notes/paths/      ordered reading lists: deepseek-lineage.mdx
src/content/sources/          one YAML file per paper, report or config
research/                     sourced fact sheets gathered before writing (input, not published)
templates/notes/              scaffolds for concept, system and path notes
src/components/viz/           the only components notes may use
src/scripts/trail.ts          the return-to-place trail (keep-place)
scripts/check.mjs             check runner; one module per concern in scripts/checks/
scripts/rules.mjs             rule ids, titles and where each is documented
scripts/agent-hooks/          agent lifecycle hooks, wired up in .agents/hooks.json
.githooks/                    pre-commit and commit-msg (installed by pnpm install)
docs/guardrails.md            how rules, checks and hooks fit together
docs/workflow.md              the end-to-end workflow, cost habits, worklog format
docs/visual-system.md         proposal and roadmap for data-driven visuals and model comparison
```

The filename is the note's ID (slug). Slugs are kebab-case and never change once other notes link to them. Folders only reflect `kind`; moving a note between folders doesn't break links.

## Frontmatter

Checked by the `frontmatter` rule and the Zod schema in `src/content.config.ts`.

```yaml
title: Multi-head latent attention
kind: concept            # concept | system | path
summary: One sentence, under 220 characters, shown in hover previews and lists.
domains: [llm, attention]
prerequisites: [mha, kv-cache]   # must understand these first (drives "Read first")
builds_on: [gqa]                 # this is a modification of that (also counts as read-first)
contrasts_with: [mqa]            # alternative approaches worth comparing
related: []                      # loosely connected
sources: [deepseek-v2-report]    # ids from src/content/sources/
steps: []                        # path notes only: ordered slugs
status: draft                    # stub | draft | reviewed | verified
updated: 2026-10-16
```

`prerequisites` and `builds_on` must form a DAG; the check script rejects cycles. Use `related` for anything that isn't a true dependency.

## Components

Available in every note without imports. Full props are in each file under `src/components/viz/`. The `catalog-sync` check fails if a component exported in `src/components/viz/index.ts` is missing from this table, or if a rule id isn't documented.

| Component | Use it for |
| --- | --- |
| `<ArchDiagram>` | Block diagrams on a grid: data flow through a layer, what is cached. Blocks can link to notes. |
| `<Calc>` | Sliders plus formulas, e.g. cache size as context length grows. |
| `<Stepper>` + `<Step>` | Walking through an algorithm one step at a time. |
| `<Spec>` | Tables of numbers. Every row needs a `source`. |
| `<Cite>` | Inline citation of a source, with an optional location. |
| `<Callout>` | `note`, `intuition` or `pitfall` asides. Use sparingly. |
| `<Figure>` | A captioned wrapper for anything else. |

Block roles in `ArchDiagram` (and bar roles in `Calc`) have fixed meanings across the whole site. Use them only for what they mean:

- `activation`: values computed per token on the fly
- `weight`: learned parameters
- `cache`: what is stored between decoding steps
- `route`: routing and gating decisions (MoE)
- `op`: operations and everything else

Raspberry (`--place`) is reserved for the reader's place (the return trail) and is never a diagram role.

Math uses `$inline$` and `$$display$$` (KaTeX). Don't use `\(...\)`.

A new interactive component must be restorable (`data-restorable` + `snapshot()`/`restore()`); see `PRINCIPLES.md#keep-place`.
