#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const toolsDirectory = dirname(fileURLToPath(import.meta.url));
const messagePaths = process.argv.slice(2);

function run(script, arguments_ = []) {
  const result = spawnSync(process.execPath, [resolve(toolsDirectory, script), ...arguments_], {
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("editspace-conformance.mjs", messagePaths.length === 0 ? ["test"] : ["validate", ...messagePaths]);
run("editspace-network-conformance.mjs");
