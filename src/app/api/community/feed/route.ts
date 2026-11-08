import { NextResponse } from "next/server";
import { getCommunityFeedPage, COMMUNITY_FEED_PAGE_SIZE } from "@/lib/data/community";
import { getUser } from "@/lib/data/context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cursorPublishedAt = searchParams.get("cursorPublishedAt");
    const cursorId = searchParams.get("cursorId");
    const limitRaw = Number(searchParams.get("limit") ?? COMMUNITY_FEED_PAGE_SIZE);
    const limit = Number.isFinite(limitRaw) ? limitRaw : COMMUNITY_FEED_PAGE_SIZE;

    const page = await getCommunityFeedPage({
      currentUserId: user.id,
      limit,
      cursorPublishedAt,
      cursorId,
    });

    return NextResponse.json(page);
  } catch {
    return NextResponse.json(
      { error: "failed", items: [], nextCursor: null },
      { status: 500 },
    );
  }
}
