import type {
  AggregatedApt,
  AptTimeSeries,
  MonthlyPoint,
  RawAptRent,
  RawAptTrade,
} from "@/types/molit";

const AREA_BUCKET = 5;

function aptKey(aptNm: string, jibun: string, area: number): string {
  const bucket = Math.round(area / AREA_BUCKET) * AREA_BUCKET;
  return `${aptNm.trim()}|${jibun.trim()}|${bucket}`;
}

function fmtDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fmtMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function fullAddressOf(sidoSigungu: string, umdNm: string, jibun: string): string {
  return [sidoSigungu, umdNm, jibun].filter(Boolean).join(" ");
}

export function aggregateTrades(rawList: RawAptTrade[], sidoSigungu: string): AggregatedApt[] {
  const map = new Map<
    string,
    {
      aptNm: string;
      umdNm: string;
      jibun: string;
      area: number;
      buildYear?: number;
      prices: number[];
      recentDealDate: string;
    }
  >();

  for (const t of rawList) {
    if (!t.dealAmount || !t.aptNm) continue;
    const key = aptKey(t.aptNm, t.jibun, t.excluUseAr);
    const dateStr = fmtDate(t.dealYear, t.dealMonth, t.dealDay);
    const cur = map.get(key);
    if (cur) {
      cur.prices.push(t.dealAmount);
      if (dateStr > cur.recentDealDate) cur.recentDealDate = dateStr;
    } else {
      map.set(key, {
        aptNm: t.aptNm,
        umdNm: t.umdNm,
        jibun: t.jibun,
        area: Math.round(t.excluUseAr * 10) / 10,
        buildYear: t.buildYear,
        prices: [t.dealAmount],
        recentDealDate: dateStr,
      });
    }
  }

  const out: AggregatedApt[] = [];
  for (const [key, v] of map) {
    const sum = v.prices.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / v.prices.length);
    out.push({
      key,
      aptNm: v.aptNm,
      umdNm: v.umdNm,
      jibun: v.jibun,
      fullAddress: fullAddressOf(sidoSigungu, v.umdNm, v.jibun),
      buildYear: v.buildYear,
      area: v.area,
      dealCount: v.prices.length,
      avgPrice: avg,
      maxPrice: Math.max(...v.prices),
      minPrice: Math.min(...v.prices),
      recentDealDate: v.recentDealDate,
    });
  }
  out.sort((a, b) => b.dealCount - a.dealCount);
  return out;
}

export function buildTimeSeries(
  trades: RawAptTrade[],
  rents: RawAptRent[],
  filterKey: string,
): AptTimeSeries {
  const tradeBuckets = new Map<string, number[]>();
  const rentBuckets = new Map<string, number[]>();
  let aptNm = "";
  let area = 0;

  for (const t of trades) {
    const key = aptKey(t.aptNm, t.jibun, t.excluUseAr);
    if (key !== filterKey) continue;
    if (!aptNm) {
      aptNm = t.aptNm;
      area = Math.round(t.excluUseAr * 10) / 10;
    }
    const m = fmtMonth(t.dealYear, t.dealMonth);
    const arr = tradeBuckets.get(m) ?? [];
    arr.push(t.dealAmount);
    tradeBuckets.set(m, arr);
  }
  for (const r of rents) {
    const key = aptKey(r.aptNm, r.jibun, r.excluUseAr);
    if (key !== filterKey) continue;
    if (!aptNm) {
      aptNm = r.aptNm;
      area = Math.round(r.excluUseAr * 10) / 10;
    }
    if (!r.deposit) continue;
    const m = fmtMonth(r.dealYear, r.dealMonth);
    const arr = rentBuckets.get(m) ?? [];
    arr.push(r.deposit);
    rentBuckets.set(m, arr);
  }

  const toPoints = (bucket: Map<string, number[]>): MonthlyPoint[] =>
    Array.from(bucket.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([yyyymm, prices]) => ({
        yyyymm,
        avgPrice: Math.round(prices.reduce((s, x) => s + x, 0) / prices.length),
        count: prices.length,
      }));

  return {
    key: filterKey,
    aptNm,
    area,
    trade: toPoints(tradeBuckets),
    rent: toPoints(rentBuckets),
  };
}
