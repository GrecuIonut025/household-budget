import { NextResponse } from "next/server";
import { getCommunityPostSocial } from "@/lib/data/community";
import { getUser } from "@/lib/data/context";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }

    const social = await getCommunityPostSocial(parsed.data, user.id);
    return NextResponse.json(social);
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
