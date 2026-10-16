# Agent guide

This repo is a visual notebook for learning how ML systems are built. It is an Astro site. Notes are MDX files that link to each other, and the site builds a graph from those links.

Before writing or editing a note, read `.agents/skills/write-article/SKILL.md`. It has the full workflow.

## Rules that matter most

1. **One idea per note.** If an explanation already exists in another note, link to it with `[[slug]]` and don't re-explain it. A system note (a model) explains what it combines and what is new, not the ideas it reuses.
2. **No unsourced numbers.** Every architecture number (layers, hidden size, expert count, head dims, token counts, speedups) comes from a paper, tech report or `config.json`, never from memory. Put numbers in `<Spec>` rows with a `source`, or cite inline with `<Cite id="..." where="§x" />`. If you can't find a primary source, leave the number out and say it's unverified.
3. **Never mark a note `reviewed` or `verified`.** Agents write `stub` or `draft`. Only the human owner promotes status.
4. **Create stubs, don't leave dangling links.** If you need to link to an idea that has no note, create a stub with `pnpm run new concept <slug> "Title"`, give it a real one-sentence `summary` and its typed links, and leave the body as a placeholder.
5. **`pnpm run check` must pass** before you finish. It validates frontmatter, links, sources, prerequisite cycles and component props, then builds the site.

## Layout

```
src/content/notes/concepts/   one idea each: mla.mdx, kv-cache.mdx
src/content/notes/systems/    a specific model or system: deepseek-v3.mdx
src/content/notes/paths/      ordered reading lists: deepseek-lineage.mdx
src/content/sources/          one YAML file per paper, report or config
research/                     sourced fact sheets gathered before writing (input, not published)
src/components/viz/           the only components notes may use
scripts/check.mjs             graph checks (run via pnpm run check)
```

The filename is the note's ID (slug). Slugs are kebab-case and never change once other notes link to them. Folders only reflect `kind`; moving a note between folders doesn't break links.

## Frontmatter

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

Available in every note without imports. Full props are in each file under `src/components/viz/`.

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

Math uses `$inline$` and `$$display$$` (KaTeX). Don't use `\(...\)`.
