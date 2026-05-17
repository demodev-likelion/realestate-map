import { NextResponse } from "next/server";
import { regionMap } from "@/lib/region-codes";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json({ regions: regionMap });
}
