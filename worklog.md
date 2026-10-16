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
