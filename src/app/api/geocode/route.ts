import { NextResponse } from "next/server";
import { geocodeApt } from "@/lib/kakao/geocode";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { aptNm?: string; address?: string } | null;
  if (!body?.aptNm || !body.address) {
    return NextResponse.json({ error: "aptNm 과 address 가 필요합니다." }, { status: 400 });
  }
  try {
    const result = await geocodeApt(body.aptNm, body.address);
    if (!result) {
      return NextResponse.json({ result: null });
    }
    return NextResponse.json({ result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const aptNm = searchParams.get("aptNm") ?? "";
  const address = searchParams.get("address") ?? "";
  if (!aptNm || !address) {
    return NextResponse.json({ error: "aptNm, address 쿼리가 필요합니다." }, { status: 400 });
  }
  const result = await geocodeApt(aptNm, address);
  return NextResponse.json({ result });
}
