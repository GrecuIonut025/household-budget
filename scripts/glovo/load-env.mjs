/**
 * Load repo-root `.env.local` then `.env` into `process.env` (Next.js-like).
 * Existing non-empty process.env values win. Empty shell placeholders are filled from files.
 * Does not print secret values.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const ENV_FILES = [".env.local", ".env"];

/**
 * @param {string} raw
 * @returns {Record<string, string>}
 */
export function parseEnvText(raw) {
  const out = {};
  // Strip UTF-8 BOM if present.
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  for (const line of text.split(/\r?\n/)) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("export ")) trimmed = trimmed.slice(7).trim();
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    // Drop unquoted inline comments: KEY=value # note
    if (
      !(
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      )
    ) {
      const hash = value.search(/\s+#/);
      if (hash >= 0) value = value.slice(0, hash).trim();
    }
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
      value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");
    }
    out[key] = value;
  }
  return out;
}

/**
 * @param {string} [root]
 * @returns {{ loadedFiles: string[], appliedKeys: string[] }}
 */
export function loadGlovoEnv(root = REPO_ROOT) {
  const loadedFiles = [];
  const appliedKeys = [];

  for (const name of ENV_FILES) {
    const path = resolve(root, name);
    if (!existsSync(path)) continue;
    loadedFiles.push(path);
    const parsed = parseEnvText(readFileSync(path, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      const current = process.env[key];
      // Fill missing or empty (npm sometimes leaves blank placeholders).
      if (current === undefined || current === "") {
        process.env[key] = value;
        appliedKeys.push(key);
      }
    }
  }

  return { loadedFiles, appliedKeys };
}

export function supabaseUrlFromEnv() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim() || null;
}

export function supabaseServiceRoleFromEnv() {
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ""
  ).trim();
  return key || null;
}

/** Diagnostic lines — never includes secret values. */
export function describeEnvStatus() {
  const url = supabaseUrlFromEnv();
  const service = supabaseServiceRoleFromEnv();
  const anon = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();
  const lines = [
    `NEXT_PUBLIC_SUPABASE_URL: ${url ? "set" : "MISSING"}`,
    `SUPABASE_SERVICE_ROLE_KEY: ${service ? "set" : "MISSING"}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${anon ? "set (browser only; not enough for glovo:import)" : "missing"}`,
  ];
  return lines;
}
