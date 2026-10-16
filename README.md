# Mindlessness

A visual notebook for learning how ML models are built, one linked idea at a time. Notes are written mostly by agents, checked by a script, and promoted by a human.

## Run it

```sh
pnpm install       # also installs the git hooks in .githooks/
pnpm run dev       # http://localhost:4321/mindlessness-thingy/
pnpm run check     # graph checks, full build, then the keep-place browser test (needs Chrome)
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`. In the repo settings, set Pages to deploy from GitHub Actions.

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

Ask an agent something like "write the DeepSeek-V3 note" or "fill in the RoPE stub". The agent follows `AGENTS.md` and the skills in `.agents/skills/` (`write-article`, `site-feature`, and `finish-task`, which ends every task with a commit). If it drifts, checks and agent hooks tell it which rule it broke; `docs/guardrails.md` explains how that works and how to add rules.

To start a note by hand:

```sh
pnpm run new concept rope "Rotary position embedding"           # stub
pnpm run new concept rope "Rotary position embedding" --draft   # full scaffold from templates/notes/
```
