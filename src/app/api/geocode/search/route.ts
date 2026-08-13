import { NextResponse } from "next/server";
import { forwardGeocode } from "@/lib/geocode";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query || query.length < 3) {
    return NextResponse.json({ matches: [] });
  }

  const matches = await forwardGeocode(query);
  return NextResponse.json({ matches });
}
