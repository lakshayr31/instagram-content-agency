import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

export interface ReelBeat {
  time: string;
  spokenOrOnScreenCopy: string;
  visual: string;
}

const execFileAsync = promisify(execFile);

export function buildElevenLabsRequest(voiceId: string, text: string): {
  url: string;
  body: { text: string; model_id: string };
} {
  return {
    url: `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    body: { text, model_id: "eleven_multilingual_v2" },
  };
}

function parseTimestamp(value: string): number {
  const match = /^(\d+):(\d{2})$/.exec(value.trim());
  if (!match) throw new Error(`Invalid reel beat time: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

function srtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")},000`;
}

export function createSrt(beats: ReelBeat[]): string {
  return beats.map((beat, index) => {
    const [startText, endText] = beat.time.split("–");
    if (!startText || !endText) throw new Error(`Invalid reel beat time: ${beat.time}`);
    const start = parseTimestamp(startText);
    const end = parseTimestamp(endText);
    if (end <= start) throw new Error(`Invalid reel beat time: ${beat.time}`);
    return `${index + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${beat.spokenOrOnScreenCopy}\n`;
  }).join("\n");
}

async function run(command: string, args: string[]): Promise<void> {
  await execFileAsync(command, args, { maxBuffer: 2_000_000 });
}

export interface ReelRenderResult {
  audioPath: string;
  captionsPath: string;
  videoPath: string;
  narrationProvider: "elevenlabs" | "macos_say";
}

async function synthesizeNarration(text: string, aiffPath: string, audioPath: string): Promise<"elevenlabs" | "macos_say"> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (apiKey && voiceId) {
    const request = buildElevenLabsRequest(voiceId, text);
    const response = await fetch(request.url, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(request.body),
    });
    if (!response.ok) throw new Error(`ElevenLabs narration failed with HTTP ${response.status}.`);
    await writeFile(audioPath, Buffer.from(await response.arrayBuffer()));
    return "elevenlabs";
  }
  await run("say", ["-r", "185", "-o", aiffPath, text]);
  await run("ffmpeg", ["-y", "-i", aiffPath, "-codec:a", "libmp3lame", "-q:a", "3", audioPath]);
  return "macos_say";
}

export async function renderLocalNarratedReel(
  beats: ReelBeat[],
  stillPaths: string[],
  outputDirectory: string,
): Promise<ReelRenderResult> {
  if (beats.length === 0) throw new Error("A reel needs at least one beat.");
  if (stillPaths.length === 0) throw new Error("A reel needs at least one still frame.");
  await mkdir(outputDirectory, { recursive: true });

  const captionsPath = join(outputDirectory, "captions.srt");
  const aiffPath = join(outputDirectory, "voice.aiff");
  const audioPath = join(outputDirectory, "voice.mp3");
  const concatPath = join(outputDirectory, "scenes.txt");
  const videoPath = join(outputDirectory, "reel.mp4");
  await writeFile(captionsPath, createSrt(beats), "utf8");

  const voiceover = beats.map((beat) => beat.spokenOrOnScreenCopy).join(" ");
  const narrationProvider = await synthesizeNarration(voiceover, aiffPath, audioPath);

  const scenePaths: string[] = [];
  for (const [index, beat] of beats.entries()) {
    const [startText, endText] = beat.time.split("–");
    if (!startText || !endText) throw new Error(`Invalid reel beat time: ${beat.time}`);
    const duration = parseTimestamp(endText) - parseTimestamp(startText);
    const scenePath = join(outputDirectory, `scene-${String(index + 1).padStart(2, "0")}.mp4`);
    const stillPath = stillPaths[index % stillPaths.length] as string;
    await run("ffmpeg", [
      "-y", "-loop", "1", "-i", stillPath, "-t", String(duration),
      "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0005,1.08)':d=1:s=1080x1920:fps=30",
      "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", scenePath,
    ]);
    scenePaths.push(scenePath);
  }

  await writeFile(concatPath, scenePaths.map((path) => `file '${path.replace(/'/g, "'\\''")}'`).join("\n"), "utf8");
  const stagedVideoPath = join(outputDirectory, "staged.mp4");
  await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", stagedVideoPath]);
  await run("ffmpeg", [
    "-y", "-i", stagedVideoPath, "-i", audioPath,
    "-vf", `subtitles=${captionsPath}`,
    "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", videoPath,
  ]);

  return { audioPath, captionsPath, videoPath, narrationProvider };
}
