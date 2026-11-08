const PLACEHOLDER_RE =
  /^(https?:\/\/)?(your[-_]?project|example|changeme|todo|xxx+|placeholder|<anon[^>]*>|\.\.\.|…)$/i;

/** Trim, drop BOM/CR, unwrap matching quotes — common Windows/.env paste artifacts. */
export function sanitizeEnvValue(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  let value = String(raw);
  if (value.charCodeAt(0) === 0xfeff) value = value.slice(1);
  value = value.replace(/^\uFEFF/, "").replace(/\r/g, "").trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).replace(/\r/g, "").trim();
  }
  if (!value) return null;
  if (PLACEHOLDER_RE.test(value)) return null;
  return value;
}

function parseEnvText(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  for (const line of text.split(/\r?\n/)) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("export ")) trimmed = trimmed.slice(7).trim();
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim().replace(/^\uFEFF/, "");
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
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

function decodeEnvBuffer(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.slice(2).toString("utf16le");
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.alloc(buf.length - 2);
    for (let i = 2; i + 1 < buf.length; i += 2) {
      swapped[i - 2] = buf[i + 1]!;
      swapped[i - 1] = buf[i]!;
    }
    return swapped.toString("utf16le");
  }
  return buf.toString("utf8");
}

let fileEnvCache: Record<string, string> | null = null;

/**
 * Read `.env.local` / `.env` when Next left process.env empty (BOM, UTF-16, cwd).
 * Uses dynamic require so Edge/proxy bundles stay free of `node:fs`.
 */
function readFileEnv(): Record<string, string> {
  if (fileEnvCache) return fileEnvCache;
  const merged: Record<string, string> = {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("node:path") as typeof import("node:path");
    const roots = [process.cwd(), path.join(process.cwd(), "..")];
    for (const root of roots) {
      for (const name of [".env.local", ".env"]) {
        const filePath = path.join(root, name);
        if (!fs.existsSync(filePath)) continue;
        const parsed = parseEnvText(decodeEnvBuffer(fs.readFileSync(filePath)));
        for (const [key, value] of Object.entries(parsed)) {
          if (!(key in merged)) merged[key] = value;
        }
      }
      if (Object.keys(merged).length > 0) break;
    }
  } catch {
    // Edge / restricted FS — process.env only.
  }
  fileEnvCache = merged;
  return merged;
}

function pickRaw(names: string[]): string | undefined {
  for (const name of names) {
    const fromProcess = process.env[name];
    if (fromProcess !== undefined && String(fromProcess).trim().length > 0) {
      return fromProcess;
    }
  }
  const files = readFileEnv();
  for (const name of names) {
    if (files[name]) return files[name];
  }
  return undefined;
}

export type SupabaseEnvStatus = {
  url: boolean;
  anonKey: boolean;
  ready: boolean;
};

/** Safe diagnostics for the setup screen — never includes secret values. */
export function getSupabaseEnvStatus(): SupabaseEnvStatus {
  const url = sanitizeEnvValue(pickRaw(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]));
  const anonKey = sanitizeEnvValue(
    pickRaw([
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_ANON_KEY",
      "SUPABASE_PUBLISHABLE_KEY",
    ]),
  );
  return { url: Boolean(url), anonKey: Boolean(anonKey), ready: Boolean(url && anonKey) };
}

export function getSupabaseEnv(): { url: string; anonKey: string } | null {
  const url = sanitizeEnvValue(pickRaw(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]));
  const anonKey = sanitizeEnvValue(
    pickRaw([
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_ANON_KEY",
      "SUPABASE_PUBLISHABLE_KEY",
    ]),
  );
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function requireSupabaseEnv(): { url: string; anonKey: string } {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart `npm run dev`.",
    );
  }
  return env;
}
