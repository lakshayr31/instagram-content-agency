# Post Creator Persona (Legacy Prototype)

> **Status:** This folder remains a reference/demo prototype. The active hackathon runtime uses `src/creative-producer/` as the executable producer adapter and `src/run-latest-f1-slate.ts` for the Manager-reviewed post/carousel/reel workflow. Do not treat this README as the canonical runtime architecture.

This workspace owns the **post creator**: a copywriter and creative director that turns an already-approved Instagram content item into a concrete creative execution.

## Boundary

Upstream work selects and classifies the item (for example: evergreen, controversial, or growth). The post creator does **not** re-evaluate that decision. It receives the approved content, its usable facts, and the client brief.

## Responsibilities

1. Select the strongest execution format: carousel, static post, or reel.
2. Explain why that format is the best fit for the given message and audience.
3. Build a production-ready creative brief: hook, audience takeaway, concept, visual direction, CTA, and production notes.
4. Deliver a concrete example in the selected format:
   - carousel: slide-by-slide copy and visual direction;
   - post: on-visual copy, visual direction, and caption;
   - reel: time-coded beats, spoken/on-screen copy, visual direction, and caption.

The agent must commit to one format rather than returning a broad idea list. It must use only supplied facts in factual copy and flag any facts needing verification before publishing.

## Hermes prompt

Use `POST_CREATOR_PERSONA.md` as the direct prompt/context for a standalone Hermes post-creator agent. It specifies the input schema and the exact JSON handoff format.

## Manager-agent handoff

A manager supplies already-approved content plus a client brief in the persona input schema, then invokes the persona once per item. The runnable demonstration is intentionally auditable:

```bash
cd /Users/lakshayr/instagram-content-agency
python3 post-creator-persona/scripts/run-demo.py
python3 post-creator-persona/scripts/render-demo-html.py
```

- `demo-inputs.json` is the context passed to three dedicated Hermes persona runs.
- `demo-agent-output.json` is the validated raw output from those runs.
- `.claude-output/agent_output_post_creator_2026-07-12.html` is the commentable review of that exact output.

For live work, replace the approved items in `demo-inputs.json` (or adapt the runner to take another input file); do not ask the post creator to classify the item again.
