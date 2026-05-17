import { NextResponse } from "next/server";
import { aggregateTrades } from "@/lib/molit/aggregate";
import { buildYmdRange, fetchTradesByMonth } from "@/lib/molit/client";
import { findRegionByCode } from "@/lib/region-codes";
import type { RawAptTrade } from "@/types/molit";

export const dynamic = "force-dynamic";

const ALLOWED_MONTHS = new Set([1, 3, 6, 12]);

function parseMonths(raw: string | null): number | null {
  if (raw == null) return 3;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return ALLOWED_MONTHS.has(n) ? n : null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lawdCd = searchParams.get("lawdCd")?.trim();
  const months = parseMonths(searchParams.get("months"));

  if (!lawdCd || !/^\d{5}$/.test(lawdCd)) {
    return NextResponse.json({ error: "lawdCd 가 잘못되었습니다 (5자리 숫자)." }, { status: 400 });
  }
  if (months === null) {
    return NextResponse.json(
      { error: "months 는 1, 3, 6, 12 중 하나여야 합니다." },
      { status: 400 },
    );
  }

  const region = findRegionByCode(lawdCd);
  const sidoSigungu = region ? `${region.sido} ${region.sigungu.name}` : "";

  const ymdList = buildYmdRange(months);

  const settled = await Promise.allSettled(ymdList.map((ymd) => fetchTradesByMonth(lawdCd, ymd)));
  const allTrades: RawAptTrade[] = [];
  const failedMonths: { ymd: string; reason: string }[] = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") {
      allTrades.push(...s.value);
    } else {
      failedMonths.push({
        ymd: ymdList[i],
        reason: s.reason instanceof Error ? s.reason.message : "unknown",
      });
    }
  });

  const allFailed = failedMonths.length === ymdList.length && ymdList.length > 0;
  if (allFailed) {
    return NextResponse.json(
      {
        sidoSigungu,
        months,
        rawCount: 0,
        items: [],
        failedMonths,
        error: "모든 월의 국토부 API 호출이 실패했습니다.",
      },
      { status: 502 },
    );
  }

  const items = aggregateTrades(allTrades, sidoSigungu);
  return NextResponse.json(
    {
      sidoSigungu,
      months,
      rawCount: allTrades.length,
      items,
      partial: failedMonths.length > 0,
      failedMonths: failedMonths.length ? failedMonths : undefined,
    },
    { status: failedMonths.length > 0 ? 207 : 200 },
  );
}
