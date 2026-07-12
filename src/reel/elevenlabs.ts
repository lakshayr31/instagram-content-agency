export interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
}

export interface ElevenLabsSpeechRequest {
  url: string;
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  };
}

export function loadElevenLabsConfig(environment: Record<string, string | undefined> = process.env): ElevenLabsConfig {
  const apiKey = environment.ELEVENLABS_API_KEY?.trim();
  const voiceId = environment.ELEVENLABS_VOICE_ID?.trim();
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is required for narration generation.");
  if (!voiceId) throw new Error("ELEVENLABS_VOICE_ID is required for narration generation.");
  return { apiKey, voiceId };
}

export function buildElevenLabsSpeechRequest(config: ElevenLabsConfig, text: string): ElevenLabsSpeechRequest {
  if (!text.trim()) throw new Error("Narration text cannot be empty.");
  return {
    url: `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.voiceId)}?output_format=mp3_44100_128`,
    init: {
      method: "POST",
      headers: { "content-type": "application/json", "xi-api-key": config.apiKey },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.25, use_speaker_boost: true },
      }),
    },
  };
}

export async function synthesizeElevenLabsSpeech(
  config: ElevenLabsConfig,
  text: string,
  fetchFn: typeof fetch = fetch,
): Promise<Uint8Array> {
  const request = buildElevenLabsSpeechRequest(config, text);
  const response = await fetchFn(request.url, request.init);
  if (!response.ok) {
    throw new Error(`ElevenLabs narration failed: HTTP ${response.status} ${await response.text()}`);
  }
  const audio = new Uint8Array(await response.arrayBuffer());
  if (audio.byteLength === 0) throw new Error("ElevenLabs narration returned an empty audio file.");
  return audio;
}
