import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

interface ExportableRun {
  id: string;
  status: string;
  review?: { status: string; checks: unknown[] };
  artifacts: Array<{ kind: string; path: string }>;
  trace: Array<Record<string, unknown>>;
  approvedAt?: string;
  exportedPaths?: string[];
  updatedAt?: string;
}

export async function approveAndExport(runPath: string, outputDirectory: string, explicitlyApproved: boolean): Promise<ExportableRun> {
  if (!explicitlyApproved) throw new Error("Explicit human approval is required before export.");
  const run = JSON.parse(await readFile(runPath, "utf8")) as ExportableRun;
  if (run.review?.status !== "pass") throw new Error("A passing review is required before export.");
  if (!run.artifacts.length) throw new Error("At least one rendered artifact is required before export.");

  const runDirectory = dirname(runPath);
  const destination = join(outputDirectory, run.id || basename(runDirectory));
  await mkdir(outputDirectory, { recursive: true });
  await cp(runDirectory, destination, { recursive: true, force: true });

  const now = new Date().toISOString();
  run.approvedAt = now;
  run.status = "exported";
  run.exportedPaths = [destination];
  run.updatedAt = now;
  run.trace.push({
    role: "export",
    status: "succeeded",
    summary: `Human approval recorded; assets copied to ${destination}.`,
    finishedAt: now,
    outputRef: destination,
  });
  await writeFile(runPath, `${JSON.stringify(run, null, 2)}\n`);
  await writeFile(join(destination, "run.json"), `${JSON.stringify(run, null, 2)}\n`);
  return run;
}
