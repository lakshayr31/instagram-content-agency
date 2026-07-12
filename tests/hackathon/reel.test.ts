import assert from "node:assert/strict";
import test from "node:test";

import { createSrt, buildElevenLabsRequest } from "../../src/hackathon/reel.js";

test("turns ordered reel beats into a valid subtitle file", () => {
  const srt = createSrt([
    { time: "0:00–0:03", spokenOrOnScreenCopy: "A hook", visual: "Frame one" },
    { time: "0:03–0:07", spokenOrOnScreenCopy: "A fact", visual: "Frame two" },
  ]);

  assert.match(srt, /1\n00:00:00,000 --> 00:00:03,000\nA hook/);
  assert.match(srt, /2\n00:00:03,000 --> 00:00:07,000\nA fact/);
});

test("rejects malformed reel beat timing", () => {
  assert.throws(() => createSrt([{ time: "soon", spokenOrOnScreenCopy: "No", visual: "No" }]), /time/i);
});

test("builds the documented ElevenLabs MP3 request without exposing the key in the body", () => {
  const request = buildElevenLabsRequest("voice_123", "Explain this rule.");

  assert.equal(request.url, "https://api.elevenlabs.io/v1/text-to-speech/voice_123?output_format=mp3_44100_128");
  assert.deepEqual(request.body, { text: "Explain this rule.", model_id: "eleven_multilingual_v2" });
});
