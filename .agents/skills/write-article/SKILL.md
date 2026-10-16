---
name: write-article
description: Write or expand a note in this visual learning notebook (concepts, model/system notes, learning paths). Use when asked to explain an ML idea, add a model architecture such as a new DeepSeek version, fill in a stub, or build a learning path.
---

# Write an article

Read `AGENTS.md` first for the rules, frontmatter fields and component catalog, and `PRINCIPLES.md` for why they exist. This notebook is **visual first**: plan the pictures before the prose.

## 1. Find what already exists

- List notes: `ls src/content/notes/*/` and run `pnpm run check:graph`. Its last lines list stubs waiting to be written.
- Search for the idea under other names: `rg -i "<term>" src/content/notes`.
- If a note for the idea exists, extend it instead of creating a second one. If it's a stub, fill it in place and keep the slug.
- Run `git status` and note files that were already changed. Those belong to someone else.

## 2. Decide the shape

- **Concept**: one idea that can be reused across models. Explain the problem it solves, how it works, a diagram or calculator, and its tradeoffs.
- **System**: one specific model. Write mostly about what is *new* relative to what it `builds_on`. Link to concepts for everything it reuses. Include a `<Spec>` table and an `<ArchDiagram>` of the overall block.
- **Path**: an ordered list of `steps` plus a short framing paragraph. Paths contain no explanations of their own.

Split it into several notes if you find yourself explaining two ideas, and link between them.

## 3. Gather sources before writing

- Check `research/` for an existing fact sheet first (e.g. `research/deepseek-facts.md`). Every value there already has a source and section.
- Otherwise find the primary source: arXiv paper, official tech report, model card, and the Hugging Face `config.json` for released models. For a large topic, save what you find as a new fact sheet in `research/` so later notes can reuse it.
- Create one YAML file per source in `src/content/sources/` (fields: `title`, `short`, `authors`, `year`, `url`, `type`). Reuse existing ones.
- Write down every number you plan to use, with the section, table or config key it comes from. If two sources disagree (paper vs config), say so in the note and prefer the config for released models.
- Never fill a gap from memory. Model versions are easy to confuse; leave the number out instead.

## 4. Create missing prerequisites as stubs

For every idea a reader needs first that has no note yet:

```sh
pnpm run new concept <slug> "Title"
```

Then edit the stub: give it a real one-sentence `summary` and its own `prerequisites`/`builds_on` so it lands in the right place on the map. Leave the body as the placeholder and `status: stub`. The check fails while a summary still says TODO.

## 5. Plan the visuals

Before writing paragraphs, list the note's main ideas (usually two to four) and pick one visual for each:

| The reader's question | Visual |
| --- | --- |
| What connects to what? What is stored? | `<ArchDiagram>` |
| How does this grow or compare? | `<Calc>` |
| What happens, in what order? | `<Stepper>` + `<Step>` |
| What are the numbers? | `<Spec>` (every row sourced) |

Use the fixed roles (activation, weight, cache, route, op) and link diagram blocks to their notes.

## 6. Write

For a new note, start from the template instead of a blank file:

```sh
pnpm run new concept <slug> "Title" --draft     # or system / path
```

It scaffolds the sections with `{/* TODO */}` prompts in the right order, picture before prose. Replace each prompt with the real thing and delete the comment; `pnpm run check` fails while any are left. For an existing stub, copy the section layout from `templates/notes/<kind>.mdx`.

- Open with the problem, in two or three sentences, linking back to whatever left that problem open.
- Put each idea's visual **before** its explanation. A reader skimming only the visuals should get the shape of the note.
- Give the intuition in plain words before the equation, then the equation, then what it implies.
- Use `<Callout type="pitfall">` for the specific mistake people make with this idea, if there is one.
- Use `[[slug]]` for every mention of another note's idea on first use in a section. `[[slug|custom text]]` changes the link text. Never link with a raw URL.
- Set `status: draft` and `updated:` to today.

Style: short paragraphs, plain verbs, no hype. Write for a reader who knows basic linear algebra and what a transformer is, but not this specific idea.

## 7. Check and look

```sh
pnpm run check
pnpm run shot /notes/<slug>/ --select figure.arch   # each diagram, cropped
pnpm run shot /notes/<slug>/ --full
```

Fix every error; each names the rule it breaks and how to fix it. Warnings about orphans or uncited sources are fine for stubs but should be resolved for drafts. Open the screenshot and look at every diagram: overlapping labels, blocks off the grid and wrong role colours are easy to see in the picture and invisible in the MDX.

## 8. Finish

Follow `.agents/skills/finish-task/SKILL.md`: commit only your files (`content(<slug>): ...`) and report which notes you created or changed, which stubs you added, and any numbers you could not verify or sources that disagreed.
