#!/usr/bin/env node
/**
 * Local Glovo Brașov sync orchestration.
 *
 * Default: import cached/fixture JSON into Supabase (fast).
 * Optional crawl: GLOVO_CRAWL=1 or --crawl (slow; needs valid session env).
 * Background: --background / GLOVO_SYNC_BACKGROUND=1 (used by npm run predev).
 *
 * Never blocks forever on a full crawl during `next dev` startup.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const LOG_DIR = resolve(ROOT, "glovo_data");
const LOG_FILE = resolve(LOG_DIR, "sync.log");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(resolve(ROOT, ".env.local"));
loadEnvFile(resolve(ROOT, ".env"));

function log(msg) {
  const line = `[glovo:sync ${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // ignore log write failures
  }
}

function parseArgs(argv) {
  return {
    crawl: argv.includes("--crawl") || process.env.GLOVO_CRAWL === "1",
    background:
      argv.includes("--background") || process.env.GLOVO_SYNC_BACKGROUND === "1",
    skip: argv.includes("--skip") || process.env.GLOVO_SYNC_ON_DEV === "0",
    importOnly: argv.includes("--import-only"),
  };
}

function run(command, args, opts = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
      shell: false,
      ...opts,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

async function syncForeground(opts) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    log(
      "Skipping import — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example). Migration seed still populates sample rows after db reset.",
    );
    return;
  }

  if (opts.crawl && !opts.importOnly) {
    log("Starting live crawl (slow). Prefer cached JSON for day-to-day.");
    try {
      await run("bash", [resolve(ROOT, "scripts/glovo/crawl-brasov.sh")]);
    } catch (err) {
      log(`Crawl failed (${err.message}). Falling back to cached/fixture import.`);
    }
  } else {
    log("Skipping live crawl — importing from glovo_data/ or fixtures/glovo/");
  }

  try {
    await run(process.execPath, [resolve(ROOT, "scripts/glovo/import.mjs")]);
    log("Sync finished.");
  } catch (err) {
    log(`Import failed (${err.message}). UI can still use migration seed / prior rows.`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.skip) {
    log("Skipped (GLOVO_SYNC_ON_DEV=0).");
    return;
  }

  if (opts.background) {
    mkdirSync(LOG_DIR, { recursive: true });
    const args = [resolve(ROOT, "scripts/glovo/sync.mjs")];
    if (opts.crawl) args.push("--crawl");
    if (opts.importOnly) args.push("--import-only");
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      detached: true,
      stdio: ["ignore", "ignore", "ignore"],
      env: { ...process.env, GLOVO_SYNC_BACKGROUND: "0" },
    });
    child.unref();
    log(`Background sync started (pid ${child.pid}). Logs: ${LOG_FILE}`);
    return;
  }

  await syncForeground(opts);
}

main().catch((err) => {
  console.error("[glovo:sync]", err.message || err);
  process.exit(1);
});
