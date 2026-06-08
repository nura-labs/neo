import { readFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import { apiHeaders } from "@/lib/api/v1/respond";

export async function GET() {
  const specPath = join(process.cwd(), "public/openapi/v1.json");
  const spec = readFileSync(specPath, "utf8");

  return new NextResponse(spec, {
    status: 200,
    headers: {
      ...apiHeaders(),
      "Content-Type": "application/json",
    },
  });
}
