#!/usr/bin/env python3
"""Run the Creative Producer persona once for every approved-content input."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
project = root.parent
persona = (project / "src" / "creative-producer" / "CREATIVE_PRODUCER_PERSONA.md").read_text()
inputs = json.loads((root / "demo-inputs.json").read_text())
results = []

for item in inputs:
    prompt = f"{persona}\n\nCreate an execution for this approved item now:\n{json.dumps({k: v for k, v in item.items() if k != 'id'}, ensure_ascii=False)}"
    completed = subprocess.run(
        ["hermes", "chat", "-Q", "--toolsets", "safe", "-q", prompt],
        text=True,
        capture_output=True,
        check=False,
    )
    raw = completed.stdout.strip()
    payload_start = raw.find("{")
    if completed.returncode != 0 or payload_start < 0:
        raise RuntimeError(f"Persona run failed for {item['id']}: {completed.stderr or raw}")
    try:
        output = json.loads(raw[payload_start:])
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Persona output was not valid JSON for {item['id']}: {raw}") from exc
    results.append({"id": item["id"], "output": output})

output_path = root / "creative-producer-agent-output.json"
output_path.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")
print(f"Wrote {len(results)} verified persona outputs to {output_path}")
