---
name: write-article
description: Write or expand a note in this visual learning notebook (concepts, model/system notes, learning paths). Use when asked to explain an ML idea, add a model architecture such as a new DeepSeek version, fill in a stub, or build a learning path.
---

# Write an article

Read `AGENTS.md` first for the rules, frontmatter fields and component catalog.

## 1. Find what already exists

- List notes: `ls src/content/notes/*/` and run `npm run check:graph`. Its last lines list stubs waiting to be written.
- Search for the idea under other names: `rg -i "<term>" src/content/notes`.
- If a note for the idea exists, extend it instead of creating a second one. If it's a stub, fill it in place and keep the slug.

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
npm run new -- concept <slug> "Title"
```

Then edit the stub: give it a real one-sentence `summary` and its own `prerequisites`/`builds_on` so it lands in the right place on the map. Leave the body as the placeholder and `status: stub`.

## 5. Write

- Open with the problem, in two or three sentences, linking back to whatever left that problem open.
- Prefer one good visual per main idea: `<ArchDiagram>` for structure, `<Calc>` for "how does this scale", `<Stepper>` for procedures.
- Give the intuition in plain words before the equation, then the equation, then what it implies.
- Use `<Callout type="pitfall">` for the specific mistake people make with this idea, if there is one.
- Use `[[slug]]` for every mention of another note's idea on first use in a section. `[[slug|custom text]]` changes the link text.
- Set `status: draft` and `updated:` to today.

Style: short paragraphs, plain verbs, no hype. Write for a reader who knows basic linear algebra and what a transformer is, but not this specific idea.

## 6. Check

```sh
npm run check
```

Fix every error. Warnings about orphans or uncited sources are fine for stubs but should be resolved for drafts. Then run `npm run dev` and open the note to look at the diagrams if you can.

## 7. Report back

Say which notes you created or changed, which stubs you added, and list any numbers you could not verify or sources that disagreed.
