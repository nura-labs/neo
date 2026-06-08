import { NextResponse } from "next/server";
import { getUserByUsername } from "@/lib/db/queries";
import { isReservedName, isValidUsernameFormat } from "@/lib/utils/username";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const u = (url.searchParams.get("u") ?? "").toLowerCase();

  if (!isValidUsernameFormat(u)) {
    return NextResponse.json({ available: false, reason: "invalid_format" });
  }
  if (isReservedName(u)) {
    return NextResponse.json({ available: false, reason: "reserved" });
  }
  const taken = await getUserByUsername(u);
  return NextResponse.json({ available: !taken, reason: taken ? "taken" : null });
}
