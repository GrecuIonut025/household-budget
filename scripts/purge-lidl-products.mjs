#!/usr/bin/env node
/**
 * Delete Lidl catalogue imports from Supabase (HGI-35).
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 *   node scripts/purge-lidl-products.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { loadGlovoEnv, describeEnvStatus } from "./glovo/load-env.mjs";

loadGlovoEnv();
console.log(describeEnvStatus().join("\n"));

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!url || !key) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: lidl, error: lidlErr } = await supabase.from("retailers").select("id").eq("slug", "lidl").maybeSingle();
if (lidlErr) {
  console.error(lidlErr.message);
  process.exit(1);
}

let deleted = 0;
if (lidl?.id) {
  const { data: byPref, error } = await supabase
    .from("products")
    .delete()
    .eq("preferred_retailer_id", lidl.id)
    .select("id");
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  deleted += byPref?.length ?? 0;
}

const { data: bySource, error: srcErr } = await supabase
  .from("products")
  .delete()
  .eq("data_source", "lidl_xlsb")
  .select("id");
if (srcErr) {
  console.error(srcErr.message);
  process.exit(1);
}
deleted += bySource?.length ?? 0;

await supabase.from("retailers").update({ is_active: false }).eq("slug", "lidl");

console.log(`[purge-lidl] deleted ${deleted} product row(s); Lidl retailer set inactive.`);
