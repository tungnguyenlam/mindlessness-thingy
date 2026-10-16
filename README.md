# Mindlessness

A visual notebook for learning how ML models are built, one linked idea at a time. Notes are written mostly by agents, checked by a script, and promoted by a human.

## Run it

```sh
pnpm install
pnpm run dev       # http://localhost:4321/mindlessness-thingy/
pnpm run check     # graph checks, then a full build
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`. In the repo settings, set Pages to deploy from GitHub Actions.

## How the content is organised

- Each idea gets one note in `src/content/notes/`. Notes link with typed frontmatter (`prerequisites`, `builds_on`, `contrasts_with`, `related`) and inline `[[slug]]` links.
- The site builds a graph from those links. Each note gets a "Read first" list, backlinks and a local graph, and the home page shows a map laid out from foundations down.
- A model note covers what changed relative to the model it `builds_on`, so adding a new version means writing the difference, not repeating everything.
- Numbers come from sources in `src/content/sources/`. `<Spec>` rows won't build without one.
- Every note has a status: `stub`, `draft` (agent-written), `reviewed`, `verified`. Only you promote past `draft`.

## Adding content with an agent

Ask an agent something like "write the DeepSeek-V3 note" or "fill in the RoPE stub". The agent should follow `AGENTS.md` and `.agents/skills/write-article/SKILL.md`. To start a note by hand:

```sh
pnpm run new concept rope "Rotary position embedding"
```
