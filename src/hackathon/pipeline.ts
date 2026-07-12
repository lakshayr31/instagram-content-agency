export type ContentFormat = "post" | "carousel" | "reel";

export interface CampaignBrief {
  clientName: string;
  audience: string;
  brandVoice: string;
  offer: string;
  objective: string;
  boundaries: string[];
  topic: string;
}

export type PipelineRole =
  | "intake"
  | "manager"
  | "sourcer"
  | "strategist"
  | "creative_producer"
  | "designer"
  | "video_audio_manager"
  | "poster"
  | "reviewer"
  | "export";

export interface TraceEvent {
  role: PipelineRole;
  status: "queued" | "running" | "succeeded" | "failed" | "skipped";
  summary: string;
  startedAt?: string;
  finishedAt?: string;
  latencyMs?: number;
  inputRef?: string;
  outputRef?: string;
  costUsd?: number;
}

export interface Artifact {
  kind: "carousel_slide" | "carousel_zip" | "reel_video" | "reel_audio" | "manifest";
  path: string;
}

export interface Review {
  status: "pass" | "rework";
  checks: Array<{ name: string; passed: boolean; detail?: string }>;
}

export interface CampaignRun {
  id: string;
  brief: CampaignBrief;
  status: "intake_complete" | "running" | "awaiting_approval" | "approved" | "exported" | "failed";
  createdAt: string;
  updatedAt: string;
  trace: TraceEvent[];
  selectedFormat?: ContentFormat;
  review?: Review;
  approvedAt?: string;
  artifacts: Artifact[];
  exportedPaths?: string[];
}

export interface ManagerPlan {
  activeRoles: PipelineRole[];
  skippedRoles: Array<{ role: PipelineRole; reason: string }>;
}

export function createCampaignRun(brief: CampaignBrief, id = `run_${crypto.randomUUID()}`): CampaignRun {
  const now = new Date().toISOString();
  return {
    id,
    brief,
    status: "intake_complete",
    createdAt: now,
    updatedAt: now,
    artifacts: [],
    trace: [{
      role: "intake",
      status: "succeeded",
      summary: `Campaign brief recorded for ${brief.clientName}.`,
      startedAt: now,
      finishedAt: now,
      latencyMs: 0,
    }],
  };
}

export function buildManagerPlan(format: ContentFormat): ManagerPlan {
  const shared: PipelineRole[] = ["sourcer", "strategist", "creative_producer"];
  if (format === "reel") {
    return {
      activeRoles: [...shared, "video_audio_manager", "poster", "reviewer"],
      skippedRoles: [{ role: "designer", reason: "The strategist selected a reel; video/audio production owns the selected format." }],
    };
  }

  return {
    activeRoles: [...shared, "designer", "poster", "reviewer"],
    skippedRoles: [{ role: "video_audio_manager", reason: `The strategist selected a ${format}; video/audio production is not required.` }],
  };
}

export function canExport(run: CampaignRun): boolean {
  return Boolean(
    run.approvedAt
      && run.review?.status === "pass"
      && run.artifacts.some((artifact) => artifact.kind !== "manifest"),
  );
}

export function addTrace(run: CampaignRun, event: TraceEvent): CampaignRun {
  run.trace.push(event);
  run.updatedAt = new Date().toISOString();
  return run;
}
