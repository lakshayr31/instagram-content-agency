import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import type { CampaignBrief } from "./pipeline.js";

const execFileAsync = promisify(execFile);
const personaPath = fileURLToPath(new URL("../agency-manager/AGENCY_MANAGER_PERSONA.md", import.meta.url));

export interface ManagerTask {
  role: string;
  required: boolean;
  dependsOn: string[];
  objective: string;
  successCriteria: string[];
}

export interface ManagerResponse {
  status: "ready" | "blocked";
  campaignGoal: string;
  tasks: ManagerTask[];
  skippedRoles: Array<{ role: string; reason: string }>;
  approvalGate: { required: boolean; conditions: string[] };
  risks: string[];
  blockedReason: string | null;
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value;
}

export function parseManagerResponse(raw: string): ManagerResponse {
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    throw new Error("Manager returned invalid JSON.");
  }
  const value = requireObject(candidate, "Manager response");
  const status = requireString(value.status, "status");
  if (status !== "ready" && status !== "blocked") throw new Error("status must be ready or blocked.");
  if (!Array.isArray(value.tasks)) throw new Error("tasks must be an array.");
  const tasks = value.tasks.map((item, index) => {
    const task = requireObject(item, `tasks[${index}]`);
    if (!Array.isArray(task.dependsOn) || !Array.isArray(task.successCriteria)) throw new Error(`tasks[${index}] must include arrays.`);
    return {
      role: requireString(task.role, `tasks[${index}].role`),
      required: task.required === true,
      dependsOn: task.dependsOn.map((dependency) => requireString(dependency, `tasks[${index}].dependsOn`)),
      objective: requireString(task.objective, `tasks[${index}].objective`),
      successCriteria: task.successCriteria.map((criterion) => requireString(criterion, `tasks[${index}].successCriteria`)),
    };
  });
  const approvalGate = requireObject(value.approvalGate, "approvalGate");
  const skippedRoles = Array.isArray(value.skippedRoles) ? value.skippedRoles.map((item, index) => {
    const skipped = requireObject(item, `skippedRoles[${index}]`);
    return { role: requireString(skipped.role, `skippedRoles[${index}].role`), reason: requireString(skipped.reason, `skippedRoles[${index}].reason`) };
  }) : [];
  return {
    status,
    campaignGoal: requireString(value.campaignGoal, "campaignGoal"),
    tasks,
    skippedRoles,
    approvalGate: {
      required: approvalGate.required === true,
      conditions: Array.isArray(approvalGate.conditions) ? approvalGate.conditions.map((condition) => requireString(condition, "approvalGate.conditions")) : [],
    },
    risks: Array.isArray(value.risks) ? value.risks.map((risk) => requireString(risk, "risks")) : [],
    blockedReason: value.blockedReason === null ? null : requireString(value.blockedReason, "blockedReason"),
  };
}

export async function runManager(brief: CampaignBrief): Promise<ManagerResponse> {
  const persona = await readFile(personaPath, "utf8");
  const prompt = `${persona}\n\nCreate the campaign plan for this brief. Return JSON only.\n${JSON.stringify({
    clientBrief: brief,
    availableCapabilities: { sourcer: true, strategist: true, producer: true, designer: true, videoAudioManager: true, poster: true, delivery: true },
  }, null, 2)}`;
  const { stdout } = await execFileAsync("hermes", ["chat", "-Q", "--toolsets", "safe", "-q", prompt], { maxBuffer: 2_000_000 });
  return parseManagerResponse(stdout);
}
