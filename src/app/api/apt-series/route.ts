import { NextResponse } from "next/server";
import { buildTimeSeries } from "@/lib/molit/aggregate";
import { buildYmdRange, fetchRentsByMonth, fetchTradesByMonth } from "@/lib/molit/client";
import type { RawAptRent, RawAptTrade } from "@/types/molit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lawdCd = searchParams.get("lawdCd")?.trim();
  const aptKey = searchParams.get("key")?.trim();
  const months = Math.max(1, Math.min(12, Number(searchParams.get("months") ?? "12")));

  if (!lawdCd || !/^\d{5}$/.test(lawdCd)) {
    return NextResponse.json({ error: "lawdCd 가 잘못되었습니다." }, { status: 400 });
  }
  if (!aptKey) {
    return NextResponse.json({ error: "key 파라미터가 필요합니다." }, { status: 400 });
  }

  const ymdList = buildYmdRange(months);
  try {
    const [tradesSettled, rentsSettled] = await Promise.all([
      Promise.allSettled(ymdList.map((ymd) => fetchTradesByMonth(lawdCd, ymd))),
      Promise.allSettled(ymdList.map((ymd) => fetchRentsByMonth(lawdCd, ymd))),
    ]);
    const trades: RawAptTrade[] = tradesSettled.flatMap((s) =>
      s.status === "fulfilled" ? s.value : [],
    );
    const rents: RawAptRent[] = rentsSettled.flatMap((s) =>
      s.status === "fulfilled" ? s.value : [],
    );
    const series = buildTimeSeries(trades, rents, aptKey);
    return NextResponse.json(series);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
