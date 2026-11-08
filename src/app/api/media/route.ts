import { NextResponse } from "next/server";
import { getUser } from "@/lib/data/context";
import { isMediaBucket } from "@/lib/media/url";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Same-origin media proxy for private Supabase storage.
 * Phones on LAN HTTP cannot load `http://127.0.0.1:54321/...` signed URLs;
 * streaming through the Next host keeps cookies + avoids mixed content / CSP gaps.
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const bucket = searchParams.get("bucket") ?? "household-media";
  const path = searchParams.get("path");

  if (!isMediaBucket(bucket) || !path || path.includes("..") || path.startsWith("/")) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const contentType = data.type || "application/octet-stream";
  const buffer = await data.arrayBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
