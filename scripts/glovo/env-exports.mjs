#!/usr/bin/env node
/**
 * Print bash `export KEY='...'` lines for keys found in `.env.local` / `.env`.
 * Used by crawl-brasov.sh so session headers load without manual `export`.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT, parseEnvText } from "./load-env.mjs";

function bashSingleQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

const merged = {};
for (const name of [".env.local", ".env"]) {
  const path = resolve(REPO_ROOT, name);
  if (!existsSync(path)) continue;
  Object.assign(merged, parseEnvText(readFileSync(path, "utf8")));
}

for (const [key, value] of Object.entries(merged)) {
  // Do not clobber non-empty shell values (same rule as loadGlovoEnv).
  const current = process.env[key];
  if (current !== undefined && current !== "") continue;
  process.stdout.write(`export ${key}=${bashSingleQuote(value)}\n`);
}
