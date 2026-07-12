#!/usr/bin/env python3
"""Render live post-creator agent output into the installed Scholia HTML template."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

project = Path(__file__).resolve().parents[2]
persona_root = project / "post-creator-persona"
template_path = Path.home() / ".claude/plugins/marketplaces/scholia/plugins/scholia/templates/scholia-template.html"
output_path = project / ".claude-output/agent_output_creative_producer_2026-07-12.html"

items = json.loads((persona_root / "creative-producer-agent-output.json").read_text())

def esc(value: object) -> str:
    return html.escape(str(value), quote=True).replace("\n", "<br>\n")

def list_html(values: list[str]) -> str:
    return "<ul>" + "".join(f"<li>{esc(value)}</li>" for value in values) + "</ul>"

def asset_html(output: dict) -> str:
    asset = output["exampleExecution"]["asset"]
    if asset["carouselSlides"] is not None:
        rows = "".join(
            f"<tr><td>{slide['slide']}</td><td>{esc(slide['onScreenCopy'])}</td><td>{esc(slide['visual'])}</td></tr>"
            for slide in asset["carouselSlides"]
        )
        return "<table><thead><tr><th>Slide</th><th>On-screen copy</th><th>Visual direction</th></tr></thead><tbody>" + rows + "</tbody></table>"
    if asset["reelBeats"] is not None:
        rows = "".join(
            f"<tr><td>{esc(beat['time'])}</td><td>{esc(beat['spokenOrOnScreenCopy'])}</td><td>{esc(beat['visual'])}</td></tr>"
            for beat in asset["reelBeats"]
        )
        return "<table><thead><tr><th>Time</th><th>Spoken / on-screen copy</th><th>Visual direction</th></tr></thead><tbody>" + rows + "</tbody></table>"
    visual = asset["postVisual"]
    return f"<table><thead><tr><th>On-visual copy</th><th>Visual direction</th></tr></thead><tbody><tr><td>{esc(visual['onVisualCopy'])}</td><td>{esc(visual['visual'])}</td></tr></tbody></table>"

sections = []
for item in items:
    output = item["output"]
    brief = output["creativeBrief"]
    audio = output.get("audioDirection")
    audio_html = "" if audio is None else (
        f"<h3>Reel audio direction</h3><p><strong>{esc(audio['mode'])}</strong><br>{esc(audio['direction'])}</p>"
    )
    title = {
        "sainz-williams": "Carlos Sainz + Williams",
        "leclerc-journey": "Charles Leclerc journey",
        "aduo-explainer": "ADUO engine explainer",
    }[item["id"]]
    sections.append(f'''<section id="{item['id']}">
  <h2>{esc(title)}</h2>
  <p class="lead"><strong>Live Hermes output selected a {esc(output['format'])}.</strong> {esc(output['formatRationale'])}</p>
  <h3>Creative brief</h3>
  <table><tbody>
    <tr><th>Category</th><td>{esc(output['category'])}</td></tr>
    <tr><th>Audience takeaway</th><td>{esc(brief['audienceTakeaway'])}</td></tr>
    <tr><th>Creative concept</th><td>{esc(brief['creativeConcept'])}</td></tr>
    <tr><th>Hook</th><td>{esc(brief['hook'])}</td></tr>
    <tr><th>Visual direction</th><td>{esc(brief['visualDirection'])}</td></tr>
    <tr><th>CTA</th><td>{esc(brief['callToAction'])}</td></tr>
  </tbody></table>
  <h3>Publish-ready caption</h3>
  <blockquote>{esc(output['exampleExecution']['caption'])}</blockquote>
  <details><summary>Open the complete {esc(output['format'])} execution</summary>
    {asset_html(output)}
  </details>
  <details><summary>Open production notes, audio direction, and fact checks</summary>
    {audio_html}
    <h3>Production notes</h3>{list_html(output['productionNotes'])}
    <h3>Fact checks required before posting</h3>{list_html(output['factChecksRequired'])}
  </details>
</section>''')

rendered_sections = '<hr>\n'.join(sections)

content = f'''<h1>Live Creative Producer Output</h1>
<p class="summary">Three independently executed Hermes Creative Producer runs. Review or comment on the exact generated copy, scripts, and production directions below.</p>
<nav class="toc"><h2>Contents</h2><ol>
  <li><a href="#run-contract">What was run</a></li>
  <li><a href="#sainz-williams">Carlos Sainz + Williams</a></li>
  <li><a href="#leclerc-journey">Charles Leclerc journey</a></li>
  <li><a href="#aduo-explainer">ADUO engine explainer</a></li>
</ol></nav>
<section id="run-contract">
  <h2>What was run</h2>
  <p class="lead"><strong>This is actual output from three standalone Hermes Creative Producer runs, not a hand-written mock.</strong></p>
  <p>Each run received the Creative Producer persona brief, one pre-classified article context, verified facts, and an India-first client brief. The persona chose one format and generated the actual creative brief, caption, carousel/post/reel copy, production notes, and fact checks.</p>
  <details><summary>Manager-agent invocation contract</summary>
    <p>Inputs: <code>post-creator-persona/demo-inputs.json</code>. Persona: <code>src/creative-producer/CREATIVE_PRODUCER_PERSONA.md</code>. Runner: <code>python3 post-creator-persona/scripts/run-demo.py</code>.</p>
    <p>The runner calls <code>hermes chat -Q --toolsets safe -q</code> once per approved item and writes <code>post-creator-persona/creative-producer-agent-output.json</code>.</p>
  </details>
</section>
<hr>
{rendered_sections}
'''

template = template_path.read_text()
template = template.replace("__TITLE__", "Live Creative Producer Output")
template = template.replace("__SUMMARY__", "Three independently executed Hermes Creative Producer outputs.")
template = re.sub(r"  <!-- CONTENT START -->.*?  <!-- CONTENT END -->", "  <!-- CONTENT START -->\n" + content + "  <!-- CONTENT END -->", template, flags=re.S)
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(template)
print(output_path)
