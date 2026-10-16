---
name: finish-task
description: The last step of every task in this repo. Run the checks, look at what you built, commit only your own files with a conventional message, and report. Use whenever you have finished writing a note, changing the site, or editing docs, before you tell the owner you are done.
---

# Finish a task

A task isn't done until it's committed (rule `commit-when-done`). Do these in order. The stop hook will remind you if you skip one.

## 1. Check

```sh
pnpm run check
```

This runs the graph checks, a full build, and the keep-place browser test. Every problem names a rule (`error [visual-first] ...`) and a `fix:`. Fix the cause and rerun until it passes. Errors listed as "outside this change" belong to other people's uncommitted files: leave them, but mention them in your report.

## 2. Look

For anything visual you touched (a note with diagrams, a component, styles):

```sh
pnpm run shot /notes/<slug>/ --select figure.arch   # each diagram, cropped
pnpm run shot /notes/<slug>/ --full
pnpm run shot /notes/<slug>/ --width 390     # mobile
```

Open the PNG from `.scratch/shots/` and actually look at it. Labels that overlap, a diagram wider than the column, colours used for the wrong role: fix them now.

## 3. Find your files

```sh
git status --short
```

Your files are the ones you created or edited in this task. Anything that was already modified when you started (the session-start message lists those) is someone else's. Don't stage it, revert it or stash it, even if it looks unfinished.

## 4. Log

Append one entry to `worklog.md` (append-only, newest at the bottom), then stage it with your files in the next step:

```sh
printf '\n## %s · %s\n- did: %s\n- files: %s\n- open: %s\n' \
  "$(date +%F)" "<the commit subject you are about to use>" \
  "what changed, one line" "main files or globs" "unverified numbers, follow-ups, or none" >> worklog.md
```

Don't read the whole file and don't edit old entries. See `docs/workflow.md#the-worklog`.

## 5. Commit

Stage by path, never with `-A`, `.` or `commit -a` (the hooks refuse those):

```sh
git add worklog.md src/content/notes/concepts/rope.mdx src/content/sources/roformer-paper.yaml
git commit -m "content(rope): write draft with rotation stepper"
```

Message format, enforced by `.githooks/commit-msg`: `type(scope): subject`, at most 72 characters, no trailing full stop.

| type | for |
| --- | --- |
| `content` | notes, sources, research fact sheets |
| `feat` | a new site feature or component |
| `fix` | a bug fix |
| `docs` | AGENTS.md, PRINCIPLES.md, skills, README |
| `style` | visual design and CSS only |
| `refactor` | code change with no behaviour change |
| `test` / `build` / `chore` | tests / tooling and dependencies / anything else |

Scope is the note slug or the area (`trail`, `checks`, `calc`). Split unrelated changes into separate commits.

If `pre-commit` fails, it re-ran the checks on your staged files: fix them and commit again. Never use `--no-verify`.

If git says "Author identity unknown", don't change global config. Reuse the repo's author for this commit only:

```sh
git -c user.name="$(git log -1 --format=%an)" -c user.email="$(git log -1 --format=%ae)" commit -m "..."
```

Don't push unless the owner asked you to.

## 6. Report

Tell the owner, briefly:

- what you changed and the commit hash(es);
- stubs you created;
- numbers you couldn't verify, or sources that disagreed;
- anything you noticed but left alone (other people's failing files, ideas for follow-ups).
