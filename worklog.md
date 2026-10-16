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
