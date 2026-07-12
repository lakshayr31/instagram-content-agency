export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_VOICE_ID?: string;
  LINKUP_API_KEY?: string;
}

type RunRow = {
  id: string;
  brief: string;
  stage: string;
  manager_json: string | null;
  ideas_json: string | null;
  scripts_json: string | null;
  final_json: string | null;
  created_at: string;
  updated_at: string;
};

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(value: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(value), { status, headers: { ...JSON_HEADERS, ...headers } });
}

function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

function now(): string { return new Date().toISOString(); }

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

function cookie(request: Request, name: string): string | undefined {
  const raw = request.headers.get("cookie") ?? "";
  return raw.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1);
}

async function requestJson(request: Request): Promise<Record<string, unknown>> {
  const payload = await request.json();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Expected a JSON object.");
  return payload as Record<string, unknown>;
}

function asString(value: unknown, name: string, max = 12000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${name} must be a non-empty string.`);
  return value.trim();
}

async function userForRequest(request: Request, env: Env): Promise<{ id: string; email: string } | null> {
  const token = cookie(request, "agency_session");
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(`SELECT users.id, users.email FROM sessions JOIN users ON sessions.user_id = users.id WHERE sessions.token_hash = ? AND sessions.expires_at > ?`)
    .bind(tokenHash, now()).first<{ id: string; email: string }>();
  return row ?? null;
}

async function requireUser(request: Request, env: Env): Promise<{ id: string; email: string } | Response> {
  const user = await userForRequest(request, env);
  return user ?? fail("Sign in required.", 401);
}

async function openAiJson(env: Env, system: string, input: unknown): Promise<Record<string, unknown>> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "authorization": `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: env.OPENAI_MODEL ?? "gpt-4.1-mini",
      response_format: { type: "json_object" },
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(input) },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error(JSON.stringify({ event: "openai_error", status: response.status, detail: detail.slice(0, 500) }));
    throw new Error("The Manager provider did not return a usable response.");
  }
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("The Manager provider returned an empty response.");
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    Object.defineProperty(parsed, "_usage", { value: payload.usage ?? {}, enumerable: false });
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("The Manager provider returned invalid structured output.");
  }
}

async function feedbackForRun(env: Env, runId: string): Promise<Array<{ stage: string; feedback: string; createdAt: string }>> {
  const rows = await env.DB.prepare("SELECT stage, feedback, created_at FROM feedback_memory WHERE run_id = ? ORDER BY created_at ASC").bind(runId).all<{ stage: string; feedback: string; created_at: string }>();
  return (rows.results ?? []).map((row) => ({ stage: row.stage, feedback: row.feedback, createdAt: row.created_at }));
}

type RunEvent = { role: string; event_type: string; status: string; detail: string; latency_ms: number; input_tokens: number; output_tokens: number; estimated_cost_usd: number; created_at: string };

async function recordEvent(env: Env, runId: string, event: Omit<RunEvent, "created_at">): Promise<void> {
  await env.DB.prepare("INSERT INTO run_events (id, run_id, role, event_type, status, detail, latency_ms, input_tokens, output_tokens, estimated_cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), runId, event.role, event.event_type, event.status, event.detail, event.latency_ms, event.input_tokens, event.output_tokens, event.estimated_cost_usd, now()).run();
}

async function markRoleSucceeded(env: Env, runId: string, role: string): Promise<void> {
  await env.DB.prepare("UPDATE run_events SET status = ? WHERE run_id = ? AND role = ? AND status = ?")
    .bind("succeeded", runId, role, "waiting_for_human").run();
}

function modelMetrics(value: Record<string, unknown>): Pick<RunEvent, "input_tokens" | "output_tokens" | "estimated_cost_usd"> {
  const usage = value._usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
  const input_tokens = usage?.prompt_tokens ?? 0;
  const output_tokens = usage?.completion_tokens ?? 0;
  return { input_tokens, output_tokens, estimated_cost_usd: Number((input_tokens * 0.0000004 + output_tokens * 0.0000016).toFixed(6)) };
}

async function eventsForRun(env: Env, runId: string): Promise<RunEvent[]> {
  const rows = await env.DB.prepare("SELECT role, event_type, status, detail, latency_ms, input_tokens, output_tokens, estimated_cost_usd, created_at FROM run_events WHERE run_id = ? ORDER BY created_at ASC").bind(runId).all<RunEvent>();
  return rows.results ?? [];
}

function decodeRun(row: RunRow, memory: Array<{ stage: string; feedback: string; createdAt: string }>, events: RunEvent[] = []) {
  return {
    id: row.id,
    brief: row.brief,
    stage: row.stage,
    manager: row.manager_json ? JSON.parse(row.manager_json) : null,
    ideas: row.ideas_json ? JSON.parse(row.ideas_json) : null,
    scripts: row.scripts_json ? JSON.parse(row.scripts_json) : null,
    final: row.final_json ? JSON.parse(row.final_json) : null,
    memory,
    events,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getRun(env: Env, userId: string, runId: string): Promise<RunRow | null> {
  return env.DB.prepare("SELECT * FROM runs WHERE id = ? AND user_id = ?").bind(runId, userId).first<RunRow>();
}

async function researchSources(env: Env, brief: string): Promise<Array<{ title: string; url: string; excerpt: string }>> {
  if (!env.LINKUP_API_KEY) return [];
  const response = await fetch("https://api.linkup.so/v1/search", {
    method: "POST",
    headers: { "authorization": `Bearer ${env.LINKUP_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ q: `${brief}\nReturn current, credible source-backed reporting and official sources only.`, depth: "standard", outputType: "searchResults" }),
  });
  if (!response.ok) throw new Error("Source research failed; do not continue without cited material.");
  const payload = await response.json() as { results?: Array<{ name?: string; url?: string; content?: string }> };
  return (payload.results ?? []).flatMap((item) => {
    try {
      const url = new URL(item.url ?? "");
      if (url.protocol !== "https:" && url.protocol !== "http:") return [];
      return [{ title: item.name?.trim() || url.hostname, url: url.toString(), excerpt: (item.content ?? "").trim().slice(0, 1800) }];
    } catch { return []; }
  }).slice(0, 8);
}

function validateIdeas(value: Record<string, unknown>, sources: Array<{ url: string }>): Record<string, unknown> {
  const ideas = value.ideas;
  if (!Array.isArray(ideas) || ideas.length !== 3) throw new Error("Strategist must return exactly three ideas.");
  const allowed = new Set(sources.map((source) => source.url));
  const formats = new Set<string>();
  for (const idea of ideas) {
    if (!idea || typeof idea !== "object" || Array.isArray(idea)) throw new Error("Strategist returned an invalid idea.");
    const item = idea as Record<string, unknown>;
    if (typeof item.format !== "string" || !["post", "carousel", "reel"].includes(item.format)) throw new Error("Strategist returned an invalid format.");
    if (typeof item.sourceUrl !== "string" || !allowed.has(item.sourceUrl)) throw new Error("Strategist must preserve a source URL from the research packet.");
    formats.add(item.format);
  }
  if (formats.size !== 3) throw new Error("Strategist must return one post, one carousel, and one reel.");
  return value;
}

const MANAGER_SYSTEM = `You are the user-facing Manager for an Instagram content agency. Be concise, practical, and do not begin specialist work until the user explicitly confirms. Return JSON only with summary, deliverables, assumptions, and question.`;
const IDEA_SYSTEM = `You are the Strategist inside an Instagram content agency. Return JSON only: {"ideas":[{"format":"post|carousel|reel","title":"string","angle":"string","why":"string","sourceUrl":"must be copied from supplied sources"}]}. Return exactly one post, one carousel, and one reel. Use only supplied source excerpts; do not invent current facts or URLs.`;
const SCRIPT_SYSTEM = `You are the Producer/Scripter inside an Instagram content agency. Return JSON only with keys post, carousel, reel. post has headline, body, caption, cta, sourceUrl. carousel has coverHook, caption, cta, sourceUrl, slides array of 5-8 {role:"hook|content", headline, body} objects. The first carousel page MUST be role "hook": a high-curiosity cover headline, not an instructional step, never start with "Step 1", "Slide 1", or a numbered list. Slides 2 onward contain the teaching sequence. reel has title, hook, voiceover, caption, cta, sourceUrl, beats array of 5-8 {seconds, text, visual}. Preserve user feedback. Every factual claim must be supported by a supplied source excerpt; if support is missing, use a non-factual framing rather than inventing a claim.`;
const FINAL_SYSTEM = `You are the Agency Manager performing the final creative check. Return JSON only with managerSummary, notes, and readyForDownload true. Do not claim content has been published.`;

async function createRun(request: Request, env: Env, user: { id: string }): Promise<Response> {
  const body = await requestJson(request);
  const brief = asString(body.brief, "brief");
  const manager = await openAiJson(env, MANAGER_SYSTEM, { brief });
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO runs (id, user_id, brief, stage, manager_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, user.id, brief, "awaiting_brief_confirmation", JSON.stringify(manager), now(), now()).run();
  await recordEvent(env, id, { role: "manager", event_type: "brief_restatement", status: "waiting_for_human", detail: "Manager summarized the brief and paused for explicit confirmation.", latency_ms: 0, ...modelMetrics(manager) });
  return json({ id, stage: "awaiting_brief_confirmation", manager });
}

async function updateRun(request: Request, env: Env, userId: string, run: RunRow): Promise<Response> {
  if (run.stage !== "awaiting_brief_confirmation") return fail("Only an unconfirmed brief can be edited. Start a new session for an approved run.", 409);
  const body = await requestJson(request);
  const brief = asString(body.brief, "brief");
  const manager = await openAiJson(env, MANAGER_SYSTEM, { brief });
  await env.DB.prepare("UPDATE runs SET brief = ?, manager_json = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .bind(brief, JSON.stringify(manager), now(), run.id, userId).run();
  await recordEvent(env, run.id, { role: "manager", event_type: "brief_edited", status: "waiting_for_human", detail: "The original brief was edited and the Manager restated the new scope.", latency_ms: 0, ...modelMetrics(manager) });
  return json({ id: run.id, stage: run.stage, manager });
}

async function confirmBrief(env: Env, userId: string, run: RunRow): Promise<Response> {
  if (run.stage !== "awaiting_brief_confirmation") return fail("This brief is not awaiting confirmation.", 409);
  await markRoleSucceeded(env, run.id, "manager");
  const sources = await researchSources(env, run.brief);
  if (sources.length === 0) return fail("No cited source material was available. Add source context to the brief or configure server-side Linkup research.", 422);
  const ideaResult = await openAiJson(env, IDEA_SYSTEM, { brief: run.brief, manager: JSON.parse(run.manager_json ?? "{}"), sources });
  const ideas = validateIdeas(ideaResult, sources);
  const strategy = { ...ideas, sources };
  await env.DB.prepare("UPDATE runs SET stage = ?, ideas_json = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .bind("ideas_review", JSON.stringify(strategy), now(), run.id, userId).run();
  await recordEvent(env, run.id, { role: "sourcer", event_type: "research", status: "succeeded", detail: `Collected ${sources.length} cited sources through Linkup.`, latency_ms: 0, input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 });
  await recordEvent(env, run.id, { role: "strategist", event_type: "idea_slate", status: "waiting_for_human", detail: "Generated one post, carousel, and reel; paused at ideas review.", latency_ms: 0, ...modelMetrics(ideas) });
  return json({ stage: "ideas_review", ideas: strategy });
}

async function approveIdeas(env: Env, userId: string, run: RunRow): Promise<Response> {
  if (run.stage !== "ideas_review") return fail("Ideas are not awaiting approval.", 409);
  await markRoleSucceeded(env, run.id, "strategist");
  const memory = await feedbackForRun(env, run.id);
  const scripts = await openAiJson(env, SCRIPT_SYSTEM, { brief: run.brief, ideas: JSON.parse(run.ideas_json ?? "{}"), feedbackMemory: memory });
  await env.DB.prepare("UPDATE runs SET stage = ?, scripts_json = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .bind("scripts_review", JSON.stringify(scripts), now(), run.id, userId).run();
  await recordEvent(env, run.id, { role: "producer", event_type: "scripts", status: "waiting_for_human", detail: "Produced post copy, carousel slide sequence, and reel script; paused at script review.", latency_ms: 0, ...modelMetrics(scripts) });
  return json({ stage: "scripts_review", scripts });
}

async function approveScripts(env: Env, userId: string, run: RunRow): Promise<Response> {
  if (run.stage !== "scripts_review") return fail("Scripts are not awaiting approval.", 409);
  await markRoleSucceeded(env, run.id, "producer");
  const memory = await feedbackForRun(env, run.id);
  const final = await openAiJson(env, FINAL_SYSTEM, { brief: run.brief, scripts: JSON.parse(run.scripts_json ?? "{}"), feedbackMemory: memory });
  await env.DB.prepare("UPDATE runs SET stage = ?, final_json = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .bind("final", JSON.stringify(final), now(), run.id, userId).run();
  await recordEvent(env, run.id, { role: "designer", event_type: "static_assets", status: "succeeded", detail: "Post and carousel render plans are ready for one-click download.", latency_ms: 0, input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 });
  await recordEvent(env, run.id, { role: "video_audio_manager", event_type: "reel", status: "succeeded", detail: "Reel storyboard and the one-click narration-plus-video renderer are ready.", latency_ms: 0, input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 });
  await recordEvent(env, run.id, { role: "poster", event_type: "package", status: "succeeded", detail: "Publishing package finalized; no external publishing was performed.", latency_ms: 0, input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 });
  return json({ stage: "final", final });
}

async function saveFeedback(request: Request, env: Env, userId: string, run: RunRow): Promise<Response> {
  const body = await requestJson(request);
  const feedback = asString(body.feedback, "feedback", 4000);
  if (run.stage !== "ideas_review" && run.stage !== "scripts_review") return fail("Feedback is only accepted during ideas or scripts review.", 409);
  await env.DB.prepare("INSERT INTO feedback_memory (id, run_id, stage, feedback, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), run.id, run.stage, feedback, now()).run();
  const memory = await feedbackForRun(env, run.id);
  if (run.stage === "ideas_review") {
    const existing = JSON.parse(run.ideas_json ?? "{}") as { sources?: Array<{ url: string }> };
    const ideaResult = await openAiJson(env, IDEA_SYSTEM, { brief: run.brief, existingIdeas: existing, feedbackMemory: memory, sources: existing.sources ?? [] });
    const ideas = { ...validateIdeas(ideaResult, existing.sources ?? []), sources: existing.sources ?? [] };
    await env.DB.prepare("UPDATE runs SET ideas_json = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(JSON.stringify(ideas), now(), run.id, userId).run();
    return json({ stage: run.stage, ideas, memory });
  }
  const scripts = await openAiJson(env, SCRIPT_SYSTEM, { brief: run.brief, ideas: JSON.parse(run.ideas_json ?? "{}"), existingScripts: JSON.parse(run.scripts_json ?? "{}"), feedbackMemory: memory });
  await env.DB.prepare("UPDATE runs SET scripts_json = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(JSON.stringify(scripts), now(), run.id, userId).run();
  return json({ stage: run.stage, scripts, memory });
}

async function narration(env: Env, run: RunRow): Promise<Response> {
  if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_VOICE_ID) return fail("ElevenLabs is not configured for this deployment.", 409);
  const scripts = JSON.parse(run.scripts_json ?? "{}");
  const text = scripts?.reel?.voiceover;
  if (typeof text !== "string" || !text) return fail("A reviewed reel voiceover is required.", 409);
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(env.ELEVENLABS_VOICE_ID)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
  });
  if (!response.ok) return fail("ElevenLabs narration failed.", 502);
  return new Response(response.body, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
}

async function api(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/signup" && request.method === "POST") {
    const body = await requestJson(request);
    const email = asString(body.email, "email", 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address.");
    let user = await env.DB.prepare("SELECT id, email FROM users WHERE email = ?").bind(email).first<{ id: string; email: string }>();
    if (!user) {
      user = { id: crypto.randomUUID(), email };
      await env.DB.prepare("INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)").bind(user.id, user.email, now()).run();
    }
    const token = crypto.randomUUID() + crypto.randomUUID();
    const expiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    await env.DB.prepare("INSERT OR REPLACE INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(await sha256(token), user.id, expiry, now()).run();
    return json({ user }, 200, { "set-cookie": `agency_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000` });
  }
  const user = await requireUser(request, env);
  if (user instanceof Response) return user;
  if (url.pathname === "/api/me" && request.method === "GET") return json({ user });
  if (url.pathname === "/api/runs" && request.method === "GET") {
    const rows = await env.DB.prepare("SELECT id, brief, stage, created_at, updated_at FROM runs WHERE user_id = ? ORDER BY updated_at DESC").bind(user.id).all<{ id: string; brief: string; stage: string; created_at: string; updated_at: string }>();
    return json({ runs: rows.results ?? [] });
  }
  if (url.pathname === "/api/pm" && request.method === "GET") {
    const rows = await env.DB.prepare("SELECT * FROM runs WHERE user_id = ? ORDER BY updated_at DESC").bind(user.id).all<RunRow>();
    const runs = await Promise.all((rows.results ?? []).map(async (row) => decodeRun(row, await feedbackForRun(env, row.id), await eventsForRun(env, row.id))));
    return json({ runs });
  }
  if (url.pathname === "/api/runs" && request.method === "POST") return createRun(request, env, user);
  const match = /^\/api\/runs\/([^/]+)(?:\/(confirm|approve-ideas|approve-scripts|feedback|narration))?$/.exec(url.pathname);
  if (!match) return fail("Not found.", 404);
  const run = await getRun(env, user.id, match[1] ?? "");
  if (!run) return fail("Run not found.", 404);
  const action = match[2];
  if (!action && request.method === "GET") return json(decodeRun(run, await feedbackForRun(env, run.id), await eventsForRun(env, run.id)));
  if (!action && request.method === "PATCH") return updateRun(request, env, user.id, run);
  if (!action && request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM runs WHERE id = ? AND user_id = ?").bind(run.id, user.id).run();
    return json({ deleted: run.id });
  }
  if (action === "confirm" && request.method === "POST") return confirmBrief(env, user.id, run);
  if (action === "approve-ideas" && request.method === "POST") return approveIdeas(env, user.id, run);
  if (action === "approve-scripts" && request.method === "POST") return approveScripts(env, user.id, run);
  if (action === "feedback" && request.method === "POST") return saveFeedback(request, env, user.id, run);
  if (action === "narration" && request.method === "GET") return narration(env, run);
  return fail("Unsupported action.", 405);
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    try {
      if (new URL(request.url).pathname.startsWith("/api/")) return await api(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(JSON.stringify({ event: "request_error", message: error instanceof Error ? error.message : "unknown" }));
      return fail("The request could not be completed.", 500);
    }
  },
} satisfies ExportedHandler<Env>;
