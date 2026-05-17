import { NextResponse } from "next/server";
import { buildYmdRange, fetchRentsByMonth } from "@/lib/molit/client";
import { findRegionByCode } from "@/lib/region-codes";
import type { RawAptRent } from "@/types/molit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lawdCd = searchParams.get("lawdCd")?.trim();
  const months = Math.max(1, Math.min(12, Number(searchParams.get("months") ?? "3")));

  if (!lawdCd || !/^\d{5}$/.test(lawdCd)) {
    return NextResponse.json({ error: "lawdCd 가 잘못되었습니다 (5자리 숫자)." }, { status: 400 });
  }

  const region = findRegionByCode(lawdCd);
  const sidoSigungu = region ? `${region.sido} ${region.sigungu.name}` : "";

  const ymdList = buildYmdRange(months);

  try {
    const settled = await Promise.allSettled(ymdList.map((ymd) => fetchRentsByMonth(lawdCd, ymd)));
    const allRents: RawAptRent[] = [];
    const errors: string[] = [];
    settled.forEach((s, i) => {
      if (s.status === "fulfilled") {
        allRents.push(...s.value);
      } else {
        errors.push(`${ymdList[i]}: ${s.reason instanceof Error ? s.reason.message : "unknown"}`);
      }
    });

    return NextResponse.json({
      sidoSigungu,
      months,
      rawCount: allRents.length,
      items: allRents,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
