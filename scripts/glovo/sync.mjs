#!/usr/bin/env node
/**
 * Local Glovo Brașov sync orchestration (simple path).
 *
 * 1. If GLOVO_CRAWL=true|1|yes (or --crawl): run the live crawler → glovo_data/
 * 2. If SUPABASE_SERVICE_ROLE_KEY is set: optional import into Supabase
 * 3. Otherwise: stop after crawl — Comparare prețuri reads glovo_data/ directly
 *
 * Loads `.env.local` / `.env` from the repo root (same idea as Next.js).
 * Background: --background / GLOVO_SYNC_BACKGROUND=1 (used by npm run predev).
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, appendFileSync } from "node:fs";
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
const LOCAL_CATALOG = resolve(ROOT, "glovo_data", "all_products.json");
const FIXTURE_CATALOG = resolve(ROOT, "fixtures", "glovo", "all_products.json");

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

/** true|1|yes (case-insensitive), or --crawl flag. */
function crawlEnabled(argv) {
  if (argv.includes("--crawl")) return true;
  const raw = (process.env.GLOVO_CRAWL || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function parseArgs(argv) {
  return {
    crawl: crawlEnabled(argv),
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
  const crawlFlag = (process.env.GLOVO_CRAWL || "").trim() || "(unset)";
  log(`GLOVO_CRAWL: ${crawlFlag}`);
}

function localCatalogHint() {
  if (existsSync(LOCAL_CATALOG)) {
    return `Comparare prețuri reads ${LOCAL_CATALOG.replace(ROOT + "/", "")} (no service role needed).`;
  }
  if (existsSync(FIXTURE_CATALOG)) {
    return `Comparare prețuri can use fixtures/glovo/all_products.json until you crawl.`;
  }
  return "After a successful crawl, open Comparare prețuri — it reads glovo_data/all_products.json.";
}

async function syncForeground(opts) {
  if (opts.debugEnv) logEnvDiagnostics();

  // --- 1) Crawl when requested ---
  if (opts.crawl && !opts.importOnly) {
    log("Starting live crawl (slow). Needs fresh Glovo session headers in .env.local.");
    try {
      await run("bash", [resolve(ROOT, "scripts/glovo/crawl-brasov.sh")]);
      log(`Crawl finished. ${localCatalogHint()}`);
    } catch (err) {
      log(`Crawl failed (${err.message}).`);
      if (existsSync(LOCAL_CATALOG) || existsSync(FIXTURE_CATALOG)) {
        log(`Keeping existing catalog. ${localCatalogHint()}`);
      } else {
        log("No local catalog yet. Fix session headers and re-run with GLOVO_CRAWL=true.");
      }
    }
  } else if (!opts.importOnly) {
    log(`Skipping live crawl (set GLOVO_CRAWL=true in .env.local to enable). ${localCatalogHint()}`);
  }

  // --- 2) Optional Supabase import (service role) ---
  const url = supabaseUrlFromEnv();
  const key = supabaseServiceRoleFromEnv();

  if (!url || !key) {
    if (!opts.debugEnv) logEnvDiagnostics();
    if (!url) {
      log("Skipping DB import — NEXT_PUBLIC_SUPABASE_URL missing (optional for local JSON UI).");
    } else {
      log(
        "Skipping DB import — SUPABASE_SERVICE_ROLE_KEY missing (optional). Comparare prețuri still reads glovo_data/.",
      );
    }
    log(localCatalogHint());
    return;
  }

  try {
    await run(process.execPath, [resolve(ROOT, "scripts/glovo/import.mjs")]);
    log("DB import finished.");
  } catch (err) {
    log(`Import failed (${err.message}). UI can still use glovo_data/ / fixtures.`);
  }

  log(`Sync finished. ${localCatalogHint()}`);
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
