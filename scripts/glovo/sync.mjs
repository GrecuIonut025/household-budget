#!/usr/bin/env node
/**
 * Local Glovo Brașov sync orchestration.
 *
 * Default: import cached/fixture JSON into Supabase (fast).
 * Optional crawl: GLOVO_CRAWL=1 or --crawl (slow; needs valid session env).
 * Background: --background / GLOVO_SYNC_BACKGROUND=1 (used by npm run predev).
 *
 * Loads `.env.local` / `.env` from the repo root (same idea as Next.js).
 * Never blocks forever on a full crawl during `next dev` startup.
 */
import { spawn } from "node:child_process";
import { mkdirSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  REPO_ROOT,
  describeEnvStatus,
  loadGlovoEnv,
  supabaseServiceRoleFromEnv,
  supabaseUrlFromEnv,
} from "./load-env.mjs";

const ROOT = REPO_ROOT;
const LOG_DIR = resolve(ROOT, "glovo_data");
const LOG_FILE = resolve(LOG_DIR, "sync.log");

const envInfo = loadGlovoEnv(ROOT);

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
    debugEnv: argv.includes("--debug-env"),
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

function logEnvDiagnostics() {
  if (envInfo.loadedFiles.length === 0) {
    log("No .env.local / .env found at repo root.");
  } else {
    log(
      `Loaded env from: ${envInfo.loadedFiles.map((p) => p.replace(ROOT + "/", "")).join(", ")}`,
    );
  }
  for (const line of describeEnvStatus()) log(line);
}

async function syncForeground(opts) {
  const url = supabaseUrlFromEnv();
  const key = supabaseServiceRoleFromEnv();

  if (!url || !key) {
    logEnvDiagnostics();
    if (!url) {
      log(
        "Skipping import — NEXT_PUBLIC_SUPABASE_URL is missing in the environment and in .env.local / .env.",
      );
    } else if (!key) {
      log(
        "Skipping import — SUPABASE_SERVICE_ROLE_KEY is missing. NEXT_PUBLIC_SUPABASE_ANON_KEY alone is not enough (importer writes via service_role). Add the service_role key from `supabase status` / the Supabase dashboard to .env.local.",
      );
    }
    log("Migration seed still populates sample Glovo rows after db reset.");
    return;
  }

  if (opts.debugEnv) logEnvDiagnostics();

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
    if (opts.debugEnv) args.push("--debug-env");
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
