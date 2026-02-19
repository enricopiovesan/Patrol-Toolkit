#!/usr/bin/env node

import { cp, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const args = parseArgs(process.argv.slice(2));

const resortId = args["resort-id"];
const pmtilesSource = args.pmtiles;
const styleSource = args.style;

if (!resortId || !pmtilesSource || !styleSource) {
  printUsage();
  process.exit(1);
}

const repoRoot = process.cwd();
const destinationDir = path.resolve(repoRoot, "public", "packs", resortId);
const pmtilesDestination = path.join(destinationDir, "base.pmtiles");
const styleDestination = path.join(destinationDir, "style.json");

try {
  await assertFileExists(pmtilesSource);
  await assertFileExists(styleSource);
  await mkdir(destinationDir, { recursive: true });

  await cp(pmtilesSource, pmtilesDestination);
  await cp(styleSource, styleDestination);

  process.stdout.write(`Installed basemap assets for ${resortId}\n`);
  process.stdout.write(`PMTiles: ${pmtilesDestination}\n`);
  process.stdout.write(`Style: ${styleDestination}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`Failed to install basemap assets: ${message}\n`);
  process.exit(1);
}

async function assertFileExists(filePath) {
  const metadata = await stat(filePath);
  if (!metadata.isFile()) {
    throw new Error(`${filePath} is not a regular file.`);
  }
}

function parseArgs(tokens) {
  const parsed = {};

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = tokens[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "";
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function printUsage() {
  process.stdout.write("Usage:\n");
  process.stdout.write(
    "  npm run basemap:install -- --resort-id <resortId> --pmtiles <path/to/base.pmtiles> --style <path/to/style.json>\n"
  );
}
