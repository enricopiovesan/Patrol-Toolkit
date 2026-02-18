#!/usr/bin/env node
import { ingestOsmToFile } from "./osm-ingest.js";
import { readPack, summarizePack, validatePack } from "./pack-validate.js";

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command !== "validate-pack" && command !== "summarize-pack" && command !== "ingest-osm") {
    throw new Error(`Unknown command '${command}'.`);
  }

  if (command === "ingest-osm") {
    const input = readFlag(args, "--input");
    const output = readFlag(args, "--output");
    if (!input || !output) {
      throw new Error("Missing required --input <path> and --output <path> arguments.");
    }

    const resortId = readFlag(args, "--resort-id") ?? undefined;
    const resortName = readFlag(args, "--resort-name") ?? undefined;
    const boundaryRelationId = readIntegerFlag(args, "--boundary-relation-id");

    const result = await ingestOsmToFile({
      inputPath: input,
      outputPath: output,
      resortId,
      resortName,
      boundaryRelationId
    });

    console.log(
      `INGESTED resort=${result.resort.id} lifts=${result.lifts.length} runs=${result.runs.length} boundary=${
        result.boundary ? "yes" : "no"
      } warnings=${result.warnings.length}`
    );
    return;
  }

  const input = readFlag(args, "--input");
  if (!input) {
    throw new Error("Missing required --input <path> argument.");
  }

  const data = await readPack(input);
  const result = validatePack(data);

  if (!result.ok) {
    throw new Error(`Invalid Resort Pack:\n${result.errors.join("\n")}`);
  }

  if (command === "validate-pack") {
    console.log("VALID");
    return;
  }

  console.log(summarizePack(result.value));
}

function readFlag(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index < 0) {
    return null;
  }

  return args[index + 1] ?? null;
}

function readIntegerFlag(args: string[], flag: string): number | undefined {
  const value = readFlag(args, flag);
  if (value === null) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Flag ${flag} expects an integer value.`);
  }
  return parsed;
}

function printHelp(): void {
  console.log(
    `ptk-extractor commands:\n\n  validate-pack --input <path>\n  summarize-pack --input <path>\n  ingest-osm --input <path> --output <path> [--resort-id <id>] [--resort-name <name>] [--boundary-relation-id <id>]`
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
