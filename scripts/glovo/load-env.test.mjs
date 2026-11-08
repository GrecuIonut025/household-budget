import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  describeEnvStatus,
  loadGlovoEnv,
  parseEnvText,
  supabaseServiceRoleFromEnv,
  supabaseUrlFromEnv,
} from "./load-env.mjs";

function testParse() {
  const parsed = parseEnvText(`
# comment
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi.service=="
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-only # trailing note
EMPTY=
`);
  assert.equal(parsed.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
  assert.equal(parsed.SUPABASE_SERVICE_ROLE_KEY, "eyJhbGciOi.service==");
  assert.equal(parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY, "anon-only");
  assert.equal(parsed.EMPTY, "");
}

function testLoadFromFiles() {
  const dir = mkdtempSync(join(tmpdir(), "glovo-env-"));
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const prevAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    // Empty shell placeholder should be filled from file.
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";

    writeFileSync(
      join(dir, ".env.local"),
      'NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"\nSUPABASE_SERVICE_ROLE_KEY=role-from-local\nNEXT_PUBLIC_SUPABASE_ANON_KEY=anon\n',
    );
    writeFileSync(join(dir, ".env"), "SUPABASE_SERVICE_ROLE_KEY=role-from-env\n");

    const info = loadGlovoEnv(dir);
    assert.ok(info.loadedFiles.some((p) => p.endsWith(".env.local")));
    assert.equal(supabaseUrlFromEnv(), "http://127.0.0.1:54321");
    assert.equal(supabaseServiceRoleFromEnv(), "role-from-local");
    const status = describeEnvStatus().join("\n");
    assert.match(status, /SUPABASE_SERVICE_ROLE_KEY: set/);
    assert.match(status, /ANON_KEY: set/);
  } finally {
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    if (prevService === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevService;
    if (prevAnon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevAnon;
    rmSync(dir, { recursive: true, force: true });
  }
}

testParse();
testLoadFromFiles();
console.log("load-env.test.mjs: ok");
