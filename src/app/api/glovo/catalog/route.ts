import { NextResponse } from "next/server";
import { getUser } from "@/lib/data/context";
import { loadLocalGlovoCatalog } from "@/lib/glovo/local-catalog";

export const runtime = "nodejs";

/** Compact Glovo catalog for client-side browse (auth required). Cached in memory + browser. */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const catalog = loadLocalGlovoCatalog();
  if (!catalog || catalog.products.length === 0) {
    return NextResponse.json(
      { markets: [], products: [], categories: [], empty: true },
      {
        headers: {
          "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
        },
      },
    );
  }

  return NextResponse.json(
    {
      markets: catalog.markets,
      products: catalog.products,
      categories: catalog.categories,
      empty: false,
    },
    {
      headers: {
        // Browser keeps it warm between navigations; server already memoizes by mtime.
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
