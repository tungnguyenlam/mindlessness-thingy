# Worklog

Append-only, one entry per finished task, newest at the bottom. Read with `tail -n 40 worklog.md`, never the whole file. Format: `docs/workflow.md#the-worklog`.

## 2026-10-17 · docs(workflow): add visual roadmap, workflow, worklog, CLAUDE.md
- did: proposed data-driven visuals and model comparison; documented workflow and cost habits; started this log; CLAUDE.md symlinks AGENTS.md
- files: docs/visual-system.md docs/workflow.md worklog.md CLAUDE.md AGENTS.md .agents/skills/finish-task/SKILL.md
- open: nothing in visual-system.md is built yet; phase 1 (diagram-geometry lint) is next; .agents/hooks.json is not wired into Claude Code

## 2026-10-17 · feat(diagram): lint geometry and route edges around blocks
- did: diagram-geometry rule; layout shared by ArchDiagram and check:graph; edges avoid blocks, residuals get lanes, columns fit labels; baseline ratchet; shot --select
- files: src/lib/diagram/* scripts/checks/diagram.mjs scripts/baseline.json scripts/check.mjs
- open: nemotron-3-5-super-vl edge label baselined (other agent's file); numbers in diagram labels are warnings until model data lands

## 2026-10-17 · content(stubs): add mamba-2 and hybrid-ssm-attention stubs
- did: CI failed: committed LFM notes link to notes that only existed as uncommitted drafts; committed stubs so a clean checkout passes
- files: src/content/notes/concepts/mamba-2.mdx src/content/notes/concepts/hybrid-ssm-attention.mdx
- open: the other agent's full drafts of both notes are still staged and will replace the stubs when committed

## 2026-10-17 · feat(models): sourced model data with ModelSpec and Compare
- did: models collection (every value {v, source, where}); field vocabulary; derived KV cache/head dim/active share; ModelSpec (+diff), Compare, /compare/ page, layer pattern strips; system notes migrated off retyped Spec; trail restores horizontal panel scroll
- files: src/content/models/*.yaml src/lib/models/* src/components/viz/{ModelSpec,Compare}.astro src/pages/compare.astro scripts/checks/models.mjs
- open: Nemotron and StableHand have no model data yet (their notes are another agent's uncommitted drafts); DeepSeek-V4 and V4.1-Flash not modelled; V3.2 KV cache not derived because the DSA indexer keys aren't in the formula

## 2026-10-17 · feat(viz): generate model diagrams and layer strips from data
- did: ModelDiagram builds a system's layer block from model data (lint-checked at build); LayerStrip shows layer order; groups can name blocks; DeepSeek-V3 diagram now auto-placed with symbols instead of numbers; four LFM2.5 notes use generated diagrams
- files: src/components/viz/{ModelDiagram,LayerStrip}.astro src/lib/diagram/geometry.mjs scripts/checks/visual.mjs
- open: thinking and 2.6B notes keep their hand diagrams (they show post-training, not the block)

## 2026-10-17 · test(render): browser test for clean rendering at two widths
- did: render-clean rule; test-visual loads every page at 1280/390 px and fails on sideways scroll, text overflow/collision, tiny labels, KaTeX and script errors; --selftest plants faults; wired into pnpm run check
- files: scripts/test-visual.mjs package.json
- open: none

## 2026-10-17 · feat(checks): enforce visual-first note structure
- did: first visual within 120 words, max 400-word prose runs, every 150+ word section has a visual (errors; existing violations baselined); prose measured with components masked; MHA gets a one-head diagram and a KV-per-token calculator; system template starts from the model card; layout ties lean to centre
- files: scripts/checks/visual.mjs scripts/baseline.json src/content/notes/concepts/mha.mdx templates/notes/system.mdx
- open: baseline still lists hybrid-ssm-attention, latent-moe, nemotron-3-super, stablehand (other agent's drafts)

## 2026-10-17 · feat(hooks): run guardrails in Claude Code, check commit tree
- did: claude.mjs adapts Claude Code hook payloads and transcripts to the existing agent hooks (session start, guardrail after edits, git safety, stop gate); pre-commit also checks the index in a clean temp checkout, which reproduces the earlier CI no-dangling failure locally
- files: .claude/settings.json scripts/agent-hooks/claude.mjs scripts/check-commit.mjs .githooks/pre-commit
- open: hooks take effect in new Claude Code sessions (or after /hooks reload)

## 2026-10-17 · feat(viz): add MaskGrid, ShapeFlow and Timeline
- did: MaskGrid (restorable; MHA causal vs full, conv window vs attention), ShapeFlow (MLA squeeze/cache/expand), Timeline (models on a path with what each adds, sourced stats, layer strips); props lint; all roadmap phases done
- files: src/components/viz/{MaskGrid,ShapeFlow,Timeline}.astro scripts/checks/viz-props.mjs
- open: content backlog: Nemotron/StableHand model data after their drafts land, DeepSeek-V4/V4.1 data, baselined notes in scripts/baseline.json; dsa stub would suit a topk MaskGrid

## 2026-10-17 · feat(models): whole-model overviews and shared tokenizer notes
- did: ModelOverview draws every model from its data (text to next token, then tabs for layer, MLA/GQA/conv, dense/MoE FFN, MTP, down to projections and shapes, with a sourced symbol table); tokenizers collection with generated samples (scripts/tokenizer-samples.py); Tokenizer card, TokenizerFlow, TokenizerCompare; byte-level-bpe concept and three tokenizer notes; model-card rule requires overview and tokenizer section; geometry lint now catches labels on edges and edges through group labels
- files: src/lib/models/overview.mjs src/components/viz/{ModelOverview,Tokenizer,TokenizerFlow,TokenizerCompare}.astro src/content/tokenizers/ src/data/tokenizer-samples.json scripts/checks/models.mjs
- open: Nemotron/StableHand still need model + tokenizer data (other agent's drafts); DeepSeek-V2 has tokenizer data but its note is a stub; Mamba-2 mixer has no detail view yet
