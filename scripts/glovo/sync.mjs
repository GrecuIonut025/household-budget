#!/usr/bin/env node
/**
 * Local Glovo Brașov sync — one command, Node only (Windows OK).
 *
 * Default: run scripts/glovo/crawl.mjs → glovo_data/all_products.json
 * Comparare prețuri reads that file (no service role / no Python).
 *
 * Opt out: GLOVO_CRAWL=false or --import-only
 * Optional DB upsert if SUPABASE_SERVICE_ROLE_KEY is set.
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
const CRAWL_JS = resolve(ROOT, "scripts/glovo/crawl.mjs");

loadGlovoEnv(ROOT);

function log(msg) {
  const line = `[glovo:sync ${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // ignore
  }
}

function isTruthy(value) {
  if (value == null) return false;
  const v = String(value).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function isFalsy(value) {
  if (value == null) return false;
  const v = String(value).trim().toLowerCase();
  return v === "0" || v === "false" || v === "no" || v === "off";
}

/** Crawl by default. Disable with GLOVO_CRAWL=false. Always crawl if --crawl. */
function shouldCrawl(argv) {
  if (argv.includes("--crawl")) return true;
  if (argv.includes("--no-crawl")) return false;
  if (isFalsy(process.env.GLOVO_CRAWL)) return false;
  if (isTruthy(process.env.GLOVO_CRAWL)) return true;
  // Unset → crawl (zero-config local path).
  return true;
}

function parseArgs(argv) {
  return {
    crawl: shouldCrawl(argv),
    background:
      argv.includes("--background") || process.env.GLOVO_SYNC_BACKGROUND === "1",
    skip: argv.includes("--skip") || process.env.GLOVO_SYNC_ON_DEV === "0",
    importOnly: argv.includes("--import-only"),
    debugEnv: argv.includes("--debug-env"),
  };
}

function runNode(scriptPath) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
      shell: false,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`node ${scriptPath} exited ${code}`));
    });
  });
}

function localCatalogHint() {
  if (existsSync(LOCAL_CATALOG)) {
    return `Comparare prețuri reads glovo_data/all_products.json`;
  }
  if (existsSync(FIXTURE_CATALOG)) {
    return `No crawl output yet — UI can use fixtures/glovo/all_products.json`;
  }
  return "After crawl, open Comparare prețuri (reads glovo_data/all_products.json).";
}

async function syncForeground(opts) {
  if (opts.debugEnv) {
    for (const line of describeEnvStatus()) log(line);
    log(`GLOVO_CRAWL effective: ${opts.crawl && !opts.importOnly}`);
  }

  if (opts.crawl && !opts.importOnly) {
    log("Starting Node crawl (scripts/glovo/crawl.mjs) — can take a while…");
    try {
      await runNode(CRAWL_JS);
      log(`Crawl finished. ${localCatalogHint()}`);
    } catch (err) {
      log(`Crawl failed (${err.message}). ${localCatalogHint()}`);
    }
  } else if (!opts.importOnly) {
    log(`Skipping crawl (GLOVO_CRAWL=false). ${localCatalogHint()}`);
  }

  const url = supabaseUrlFromEnv();
  const key = supabaseServiceRoleFromEnv();
  if (url && key) {
    log("Optional: importing into Supabase…");
    try {
      await runNode(resolve(ROOT, "scripts/glovo/import.mjs"));
      log("DB import finished.");
    } catch (err) {
      log(`DB import failed (${err.message}). UI still uses local JSON.`);
    }
  } else {
    log("Skipping DB import (optional). UI uses glovo_data/ without service role.");
  }

  log(`Done. ${localCatalogHint()}`);
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
    if (opts.importOnly) args.push("--import-only");
    else if (!opts.crawl) args.push("--no-crawl");
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
