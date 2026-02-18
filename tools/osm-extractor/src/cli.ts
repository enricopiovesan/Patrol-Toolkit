#!/usr/bin/env node
import { readPack, summarizePack, validatePack } from "./pack-validate.js";

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command !== "validate-pack" && command !== "summarize-pack") {
    throw new Error(`Unknown command '${command}'.`);
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

function printHelp(): void {
  console.log(`ptk-extractor commands:\n\n  validate-pack --input <path>\n  summarize-pack --input <path>`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
