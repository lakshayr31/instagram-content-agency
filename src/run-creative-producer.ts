import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import {
  createCreativeProducer,
  type CreativeProducerInput,
} from "./creative-producer/index.js";

const execFileAsync = promisify(execFile);

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Usage: npm run creative:produce -- path/to/creative-producer-input.json");
  }

  const input = JSON.parse(await readFile(inputPath, "utf8")) as CreativeProducerInput;
  const producer = createCreativeProducer(async (prompt) => {
    const { stdout } = await execFileAsync("hermes", ["chat", "-Q", "--toolsets", "safe", "-q", prompt], {
      maxBuffer: 2_000_000,
    });
    return stdout;
  });

  const execution = await producer.create(input);
  process.stdout.write(`${JSON.stringify(execution, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Creative Producer failed: ${message}\n`);
  process.exitCode = 1;
});
