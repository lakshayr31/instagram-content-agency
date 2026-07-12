import assert from "node:assert/strict";
import test from "node:test";

import {
  buildElevenLabsSpeechRequest,
  loadElevenLabsConfig,
} from "../../src/reel/elevenlabs.js";

test("builds a server-side ElevenLabs multilingual narration request", () => {
  const request = buildElevenLabsSpeechRequest(
    { apiKey: "test-key", voiceId: "voice-123" },
    "ADUO is F1's engine catch-up rule.",
  );

  assert.equal(request.url, "https://api.elevenlabs.io/v1/text-to-speech/voice-123?output_format=mp3_44100_128");
  assert.equal(request.init.headers["xi-api-key"], "test-key");
  assert.match(request.init.body, /eleven_multilingual_v2/);
  assert.match(request.init.body, /ADUO/);
});

test("requires ElevenLabs credentials from server-side environment", () => {
  assert.throws(() => loadElevenLabsConfig({}), /ELEVENLABS_API_KEY/i);
  assert.deepEqual(loadElevenLabsConfig({ ELEVENLABS_API_KEY: "key", ELEVENLABS_VOICE_ID: "voice" }), {
    apiKey: "key",
    voiceId: "voice",
  });
});
