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

## 2026-10-18 · feat(layout): fill wide screens, fix phone overflow
- did: root size grows 17→20px from 1600 to 2560px; note page side columns fluid, no max width, prose centred at --measure (now 39rem, not ch) with visuals widening to --mid/--wide; ArchDiagram/MaskGrid SVGs sized in rem so they grow with type; map stretches node positions sideways on wide canvases (stretch kept in its snapshot); home paths/recent, compare and sources use the width; home path tracks wrap on phones; render-clean now also runs at 2560px
- files: src/styles/global.css src/pages/{index,compare,sources}.astro src/pages/notes/[slug].astro src/components/{GlobalGraph,viz/ArchDiagram,viz/MaskGrid,viz/ModelOverview}.astro src/layouts/Base.astro scripts/test-visual.mjs AGENTS.md docs/guardrails.md
- open: StableHand and other non-LLM papers don't fit the LLM-shaped model data (no tokenizer, no next token); proposal given to owner, not built

## 2026-10-18 · feat(models): draw non-LM papers as pipelines; StableHand data
- did: model data gains kind: lm|pipeline and a sourced stages: list; new fields for input/output (input, output, seq_unit, seq_length, tokens_per_step, output_dim), causal, and sampling/conditioning (objective, sampler, sampling_steps, modulation, modulation_from, cross_inputs); X (cross-attention) sublayer; ModelOverview draws a pipeline's stages, one backbone block in sublayer order (AdaLN norms), non-causal self-attention (no cache) and cross-attention, with weights; model-card asks for a tokenizer only for lm; StableHand note now uses ModelOverview/ModelSpec/ModelDiagram plus an error-to-quality Calc; diagram width now includes right-side edges and their labels (they were clipped)
- files: src/lib/models/{fields,data,overview,params}.mjs src/content.config.ts src/components/viz/ModelOverview.astro src/lib/diagram/geometry.mjs scripts/checks/models.mjs src/content/models/stablehand.yaml src/content/notes/systems/stablehand.mdx docs/workflow.md AGENTS.md
- open: StableHand param sum is a lower bound (AdaLN, cross-attn K/V, input/output projections and the QN not sized in data); no reading path for vision/generative notes yet

## 2026-10-18 · docs(readme): add contribution rules for pull requests
- did: README Contributing section: when to open an issue first, setup, content and code rules, commit format, PR checklist (check, ci, screenshots) and what the description must say
- files: README.md
- open: PRs get no CI run (deploy.yml only runs on push to main); no PR template yet

## 2026-10-18 · content(generative-hand-motion): add vision/generative reading path
- did: new path note from the transformer block through flow matching, AdaLN, DiT and MANO to StableHand, with a Timeline; first path that ends at a non-LM pipeline
- files: src/content/notes/paths/generative-hand-motion.mdx
- open: only one system on it so far

## 2026-10-18 · build(ci): run the check on pull requests; add a PR template
- did: check.yml runs the deploy build job (frozen install, pnpm run check) on every PR to main without deploying; pull_request_template.md with the README checklist; README and guardrails mention both
- files: .github/workflows/check.yml .github/pull_request_template.md README.md docs/guardrails.md
- open: branch protection requiring the Check job is a repo setting, not set

## 2026-10-18 · docs(workflow): push to main after every task once CI passes
- did: owner asked: finishing a task now ends with git push origin main and a watched deploy run, only after pnpm run check and pnpm run ci pass; rebase and rerun ci if main moved, never force; AGENTS.md rule 13 and lifecycle, finish-task skill, session-start hook, rule title, workflow diagram, README
- files: AGENTS.md .agents/skills/finish-task/SKILL.md scripts/agent-hooks/session-start.mjs scripts/rules.mjs docs/workflow.md README.md
- open: the stop hook does not check for unpushed commits

## 2026-10-18 · content(flashmoe): add FlashMoE offloading and ML cache note
- did: wrote concept note for FlashMoE (arXiv:2601.17063v1) with SSD expert-offloading diagram, VRAM cache budget and feature-normalization calculator, 4-step Belady FFN policy stepper, sourced spec tables, fact sheet, and 6 source files; linked from moe
- files: src/content/notes/concepts/{flashmoe,moe}.mdx src/content/sources/{flashmoe-paper,belady-1966-paper,fiddler-paper,daop-paper,olmoe-paper,qwen3-report}.yaml research/flashmoe-facts.md
- open: none

## 2026-10-18 · content(vla-cpp): write vla.cpp runtime note
- did: wrote the system note for the vla.cpp runtime (arXiv:2606.08094): adapters/backends architecture, iterative vs regression heads, observation reuse, BitVLA ternary kernels, LIBERO and device latency tables, quantization costs, UR10e and horizon sweeps; 2 sources, fact sheet, stubs vla, action-chunking, observation-reuse
- files: src/content/notes/systems/vla-cpp.mdx src/content/notes/concepts/{vla,action-chunking,observation-reuse}.mdx src/content/sources/vla-cpp-{paper,repo}.yaml research/vla-cpp-facts.md
- open: repo README is ahead of the paper (extra policies, Hexagon backend); GR00T-N1.6 success gap left unexplained by the paper

## 2026-10-18 · content(vla-cpp): rewrite as an explanation, not a results dump
- did: owner found the note hard to read; rewrote around four ideas (adapter split, observation reuse, ternary kernels, precision flipping a discrete choice) with plain prose that keeps because/so; two new diagrams (ternary matmul, SmolVLA position-embedding index), a robot-loop Calc; tables now use Spec columns; fixed [[vla]] rendering as 'policy policy'; Spec gained columns/values/note; AGENTS.md Writing rules updated
- files: src/content/notes/systems/vla-cpp.mdx src/components/viz/Spec.astro AGENTS.md .agents/skills/write-article/SKILL.md
- open: other notes still pack numbers into one Spec value and could move to columns; dropped from the note: four-suite LIBERO, SimplerEnv, ALOHA runs, roofline numbers (still in research/vla-cpp-facts.md)

## 2026-10-19 · content(flowhoi): add pipeline model data, system note and sources
- did: Added FlowHOI (arXiv:2602.13444, NeurIPS 2026) fact sheet, 6 primary sources, pipeline model YAML, system note with ModelOverview/ModelSpec/ModelDiagram/Compare/Calc/Stepper/ArchDiagrams, and linked it into generative-hand-motion and stablehand.
- files: research/flowhoi-facts.md, src/content/models/flowhoi.yaml, src/content/notes/systems/flowhoi.mdx, src/content/notes/paths/generative-hand-motion.mdx, src/content/notes/systems/stablehand.mdx, src/content/sources/{flowhoi-paper,flowhoi-repo,flowhoi-hot3d-config,flowhoi-grasp-config,grab-paper,diffh2o-paper}.yaml
- open: Total parameter count is not reported in the FlowHOI paper or released configs; paper vs. code differences (gated fusion vs. App. A cross-attention, num_frames 224 cropped to 200, max_scene_points 10000 vs. 25000) are documented in the note and fact sheet.
