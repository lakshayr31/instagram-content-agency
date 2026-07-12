import { approveAndExport } from "./hackathon/approval.js";

const [runPath, outputDirectory, approvalFlag] = process.argv.slice(2);
if (!runPath || !outputDirectory || approvalFlag !== "--approve") {
  throw new Error("Usage: npm run hackathon:approve -- <run.json path> <phone-sync output directory> --approve");
}

const run = await approveAndExport(runPath, outputDirectory, true);
process.stdout.write(`${JSON.stringify({
  runId: run.id,
  status: run.status,
  approvedAt: run.approvedAt,
  exportedPaths: run.exportedPaths,
}, null, 2)}\n`);
