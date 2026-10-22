# Mindlessness

A visual notebook for learning how ML models are built, one linked idea at a time. Notes are written mostly by agents, checked by a script, and promoted by a human.

## Visits

![total views](https://mindlessness.goatcounter.com/counter/TOTAL.svg)

Counted by [GoatCounter](https://mindlessness.goatcounter.com) and refreshed daily by `.github/workflows/stats.yml`.

<!-- stats:start -->
No visits recorded yet.
<!-- stats:end -->

## Run it

```sh
pnpm install       # also installs the git hooks in .githooks/
pnpm run dev       # http://localhost:4321/mindlessness-thingy/
pnpm run check     # graph checks, full build, then the keep-place and render browser tests (needs Chrome)
pnpm run ci        # the GitHub Actions build, replayed on a clean checkout of HEAD
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`. In the repo settings, set Pages to deploy from GitHub Actions. Every pull request against `main` runs the same build without deploying (`.github/workflows/check.yml`).

## What reading it should feel like

`PRINCIPLES.md` is the short version. The two that shape the site most:

- **Never lose your place.** Click a link mid-paragraph and a ribbon in the corner shows where you came from, quoting the sentence. Click it, press `B` or use Back, and you land on the same sentence at the same height on screen, with steppers, sliders and the map as you left them.
- **Visual first.** Every idea gets a diagram, calculator or stepper before its paragraph.

## How the content is organised

- Each idea gets one note in `src/content/notes/`. Notes link with typed frontmatter (`prerequisites`, `builds_on`, `contrasts_with`, `related`) and inline `[[slug]]` links.
- The site builds a graph from those links. Each note gets a "Read first" list, backlinks and a local graph, and the home page shows a map laid out from foundations down.
- A model note covers what changed relative to the model it `builds_on`, so adding a new version means writing the difference, not repeating everything.
- Numbers come from sources in `src/content/sources/`. `<Spec>` rows won't build without one.
- Every note has a status: `stub`, `draft` (agent-written), `reviewed`, `verified`. Only you promote past `draft`.

## Adding content with an agent

Ask an agent something like "write the DeepSeek-V3 note" or "fill in the RoPE stub". The agent follows `AGENTS.md` and the skills in `.agents/skills/` (`write-article`, `site-feature`, and `finish-task`, which ends every task with a commit and, once every check passes, a push to `main` that deploys the site). If it drifts, checks and agent hooks tell it which rule it broke; `docs/guardrails.md` explains how that works and how to add rules.

To start a note by hand:

```sh
pnpm run new concept rope "Rotary position embedding"           # stub
pnpm run new concept rope "Rotary position embedding" --draft   # full scaffold from templates/notes/
```

## Contributing

Contributions come in as pull requests against `main`. The rules are the same for people and for agents: they live in `PRINCIPLES.md` (why) and `AGENTS.md` (the numbered rules the checks enforce). This section is the short version for a PR.

### Before you start

- **Small fixes** (a wrong number with its source, a typo, a broken diagram): open the PR directly.
- **Anything bigger** (a new site feature, a new rule or check, a change to how notes are structured): open an issue first so we can agree on the shape. Changing `PRINCIPLES.md` is the owner's call; propose it in an issue.
- **New notes:** check the map and `src/content/notes/` first. If a stub exists, fill it rather than starting a second note on the same idea.

### Setup

1. Fork the repo and create a branch from `main`, named after what it does: `content/rope`, `fix/trail-scroll`, `feat/compare-export`.
2. `pnpm install`. This also installs the git hooks in `.githooks/`; don't skip or disable them. You need Node 24 (what CI uses) and Chrome for the browser tests.
3. Read `PRINCIPLES.md`, then the skill for your kind of change in `.agents/skills/` (`write-article` for notes, `site-feature` for the site). They are written for agents but work as checklists for anyone.

### Rules for content

1. **One idea per note.** Explain an idea once, in its own note, and link to it with `[[slug]]` everywhere else. A model note covers what it combines and what is new.
2. **Every number has a source.** Architecture numbers come from a paper, technical report or `config.json`, never from memory. Add the source as `src/content/sources/<id>.yaml` and cite it with a location (section, table, config key). Model numbers go in `src/content/models/<slug>.yaml`, not typed into the note. If you can't find a primary source, leave the number out and say it's unverified.
3. **Status stays `stub` or `draft`.** Only the owner marks a note `reviewed` or `verified`, after reading it.
4. **No dangling links.** If you link to an idea without a note, create a stub with `pnpm run new concept <slug> "Title"` and a real one-sentence summary.
5. **Visual first.** Every concept and system note shows its idea in a diagram, calculator, stepper or table before the prose that explains it. Use the components in `src/components/viz/`; the style guide is `AGENTS.md#style`.
6. **Slugs don't change** once other notes link to them.
7. **Papers that aren't language models** (vision, motion, diffusion, robotics) use the same model data as a pipeline of stages. See `docs/workflow.md#papers-that-arent-language-models`.

### Rules for code

1. Every page renders inside `src/layouts/Base.astro`, and every interactive component is restorable (`data-restorable` with `snapshot()` and `restore()`), so the return trail keeps working. See `PRINCIPLES.md#keep-place`.
2. A new component for notes needs a row in the Components table in `AGENTS.md`.
3. Pages must render cleanly at phone (390 px), laptop (1280 px) and wide (2560 px) widths: no sideways page scroll, no clipped or overlapping labels.
4. Don't weaken a check to get past it (editing `scripts/checks/`, deleting a test, lowering a threshold, adding to `scripts/baseline.json`) unless changing that check is the point of the PR, and say so in the description.

### Commits

- Format: `type(scope): what changed`, at most 72 characters, no full stop. Types: `content`, `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `build`, `chore`. Example: `content(rope): add rotation stepper`.
- Stage files by path rather than `git add -A` or `git commit -a`, so only your change goes in. `pre-commit` re-runs the fast checks on what you staged and refuses a commit that would fail on a clean checkout; never bypass it with `--no-verify`.
- Append one entry to `worklog.md` for the task (format in `docs/workflow.md#the-worklog`). If it conflicts with another PR, keep both entries.
- Keep unrelated changes in separate commits, ideally separate PRs.

### Opening the pull request

Opening it fills in `.github/pull_request_template.md`, which has the checklist below. Before you open it:

- [ ] `pnpm run check` passes.
- [ ] `pnpm run ci` passes on your last commit. It replays the deploy build from a clean checkout, so it catches files you forgot to commit.
- [ ] For visual changes: screenshots from `pnpm run shot /notes/<slug>/` (add `--width 390` for a phone), attached to the PR.

In the description, write:

- **What and why**, in a few sentences.
- **Sources** you read, and anything you couldn't verify.
- **Check results**: the last lines of `pnpm run ci`. The Check workflow then runs the same build on the PR; it must be green before merge.
- **Agent-written?** Say so, and which agent. Agent PRs are welcome; they follow the same rules.

The owner reviews every PR and may ask for changes. After merging, the owner decides when a note moves past `draft`.

