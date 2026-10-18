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

## 2026-10-17 · feat(models): real numbers in model diagrams, style guide for agents
- did: generated model views draw the model's own sizes (T × 7,168, 128 × (128 + 64), √192) with the symbol table mapping numbers back to symbols and sources; concept diagrams use symbols with a shape on every tensor box (mla, gqa, gated-short-conv, hybrid-conv-attention); MLA notation aligned to the paper (c^KV, k^R, d_h^R); AGENTS.md gains a Style section (writing, diagram style, shared symbol table); new no-shape warning for concept diagrams; PRINCIPLES visual-first thresholds now match the check
- files: src/lib/models/overview.mjs src/components/viz/ModelOverview.astro AGENTS.md PRINCIPLES.md docs/workflow.md scripts/checks/diagram.mjs templates/notes/concept.mdx .agents/skills/write-article/SKILL.md src/content/notes/concepts/{mla,gqa,gated-short-conv,hybrid-conv-attention}.mdx
- open: other agent's staged notes (latent-moe, Nemotron) should follow AGENTS.md#diagram-style when they land

## 2026-10-17 · content(nemotron): land the staged Nemotron and StableHand drafts
- did: committed the previous session's staged work: Nemotron 3 Nano/Super/3.5-Super-VL and StableHand notes, the Nemotron lineage path, their sources and fact sheets
- files: src/content/notes/{systems,concepts,paths}/ research/nemotron-facts.md research/stablehand-facts.md src/content/sources/
- open: their warnings stay: numbers in hand-drawn diagrams, missing model data for the Nemotron family, baselined prose runs

## 2026-10-17 · content(attention): write the rope, mqa and transformer-block drafts
- did: completed all 22 remaining stubs (17 concepts, 5 systems) with sourced prose and visual-first diagrams; added model data for DeepSeek-V3.2, V4 and V4.1-Flash; commits: 14279cf attention, 12b69a8 moe, edcaf3d deepseek concepts, c55d49d deepseek-v2, e9899d3 deepseek-v3-2, + v4, generative, vision, mamba-2
- files: src/content/notes/concepts/*.mdx src/content/notes/systems/deepseek-*.mdx src/content/notes/systems/nemotron-3-nano.mdx src/content/models/deepseek-*.yaml
- open: MANO vertex count and shape-vector length unverified (left out); V4/V4.1 tokenizer identical to V3's not documented, only its size; nemotron-3-nano shared-expert count differs between report and config; overview.mjs renders expert_groups 0 as "within 0 of 0 groups"

## 2026-10-17 · build(ci): replay the deploy job locally with pnpm run ci
- did: pnpm run ci checks out HEAD into a temp dir, installs with --frozen-lockfile and runs pnpm run check like deploy.yml; AGENTS.md lifecycle and finish-task skill now require it after every commit (plus gh run watch when pushing)
- files: scripts/ci-local.mjs package.json AGENTS.md .agents/skills/finish-task/SKILL.md
- open: none

## 2026-10-17 · content(lfm2): use the FFN width the model builds; V4.1-Flash total
- did: LFM2.5-350M and 1.2B set block_auto_adjust_ff_dim, so Lfm2MLP builds int(2·ff/3) rounded to 256: 4608 and 8192, not config intermediate_size 6656/12288 (now matches report Table 1 and the cards' 350M/1.17B); V4.1-Flash no longer inherits V4's 1.6T total (552B backbone + 196B Engram, report abstract)
- files: src/content/models/{lfm2-5-350m,lfm2-5-1-2b-instruct,lfm2-5-1-2b-thinking,deepseek-v4-1-flash}.yaml src/content/sources/lfm2-modeling.yaml src/content/notes/systems/lfm2-5-{350m,230m,1-2b-instruct}.mdx
- open: none

## 2026-10-17 · feat(models): parameter breakdown, weight tables, zoomable views
- did: ModelOverview gains a Parameters tab (bars per part, total vs active per token, summed from the data beside the reported totals), a weights table under each mixer/FFN tab (every matrix: shape, copies, parameters; per layer and whole stack), + badges that zoom from the stack to one layer to each sublayer, cache bytes per token on the whole-model view; ArchDiagram open prop; params-mismatch/params-inherited warnings (they found the LFM2 widths and the V4.1-Flash total); fixes 'within 0 of 0 groups'
- files: src/lib/models/params.mjs src/lib/models/overview.mjs src/components/viz/{ModelOverview,ArchDiagram}.astro scripts/checks/models.mjs AGENTS.md
- open: DSA (V4, V4.1-Flash) and the V3.2 lightning indexer projections are not counted (shapes not in data, shown as lower bound); no Mamba-2 detail view yet (no model data uses it)

## 2026-10-18 · content(minicpm-v-4-7): MiniCPM-V 4.7 (35B-A3B), tokenizer, and Gated DeltaNet model views
- did: wrote system notes and data for MiniCPM-V-4.7-35B-A3B and its 248K tokenizer (with generated samples), 9 sources, fact sheet, and gated-deltanet stub; added Gated DeltaNet (sublayer G) detail diagram, parameter counting (including gated GQA q_proj 2× output), and DeltaNet symbols to ModelOverview
- files: src/content/notes/systems/{minicpm-v-4-7-35b-a3b,minicpm-v-4-7-tokenizer}.mdx src/content/notes/concepts/gated-deltanet.mdx src/content/models/minicpm-v-4-7-35b-a3b.yaml src/content/tokenizers/minicpm-v-4-7.yaml src/content/sources/{minicpm-v-4-7-*,qwen3-5-moe-modeling,llava-uhd-v4-paper}.yaml src/lib/models/{fields,overview,params}.mjs src/components/viz/ModelOverview.astro scripts/tokenizer-samples.py src/data/tokenizer-samples.json research/minicpm-facts.md AGENTS.md
- open: stub gated-deltanet
