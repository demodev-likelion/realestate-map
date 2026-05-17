import { NextResponse } from "next/server";
import { buildTimeSeries } from "@/lib/molit/aggregate";
import { buildYmdRange, fetchRentsByMonth, fetchTradesByMonth } from "@/lib/molit/client";
import type { RawAptRent, RawAptTrade } from "@/types/molit";

export const dynamic = "force-dynamic";

const ALLOWED_MONTHS = new Set([1, 3, 6, 12]);

function parseMonths(raw: string | null): number | null {
  if (raw == null) return 12;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return ALLOWED_MONTHS.has(n) ? n : null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lawdCd = searchParams.get("lawdCd")?.trim();
  const aptKey = searchParams.get("key")?.trim();
  const months = parseMonths(searchParams.get("months"));

  if (!lawdCd || !/^\d{5}$/.test(lawdCd)) {
    return NextResponse.json({ error: "lawdCd 가 잘못되었습니다." }, { status: 400 });
  }
  if (!aptKey) {
    return NextResponse.json({ error: "key 파라미터가 필요합니다." }, { status: 400 });
  }
  if (months === null) {
    return NextResponse.json(
      { error: "months 는 1, 3, 6, 12 중 하나여야 합니다." },
      { status: 400 },
    );
  }

  const ymdList = buildYmdRange(months);

  const [tradesSettled, rentsSettled] = await Promise.all([
    Promise.allSettled(ymdList.map((ymd) => fetchTradesByMonth(lawdCd, ymd))),
    Promise.allSettled(ymdList.map((ymd) => fetchRentsByMonth(lawdCd, ymd))),
  ]);

  const trades: RawAptTrade[] = [];
  const rents: RawAptRent[] = [];
  const failedTradeMonths: string[] = [];
  const failedRentMonths: string[] = [];
  tradesSettled.forEach((s, i) => {
    if (s.status === "fulfilled") trades.push(...s.value);
    else failedTradeMonths.push(ymdList[i]);
  });
  rentsSettled.forEach((s, i) => {
    if (s.status === "fulfilled") rents.push(...s.value);
    else failedRentMonths.push(ymdList[i]);
  });

  const allTradesFailed = failedTradeMonths.length === ymdList.length;
  const allRentsFailed = failedRentMonths.length === ymdList.length;
  if (allTradesFailed && allRentsFailed) {
    return NextResponse.json(
      { error: "모든 월의 국토부 API 호출이 실패했습니다.", failedTradeMonths, failedRentMonths },
      { status: 502 },
    );
  }

  const series = buildTimeSeries(trades, rents, aptKey);
  return NextResponse.json({
    ...series,
    partial: failedTradeMonths.length > 0 || failedRentMonths.length > 0,
    failedTradeMonths: failedTradeMonths.length ? failedTradeMonths : undefined,
    failedRentMonths: failedRentMonths.length ? failedRentMonths : undefined,
  });
}
