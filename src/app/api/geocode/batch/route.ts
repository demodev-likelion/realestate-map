import { NextResponse } from "next/server";
import { type GeocodeResult, geocodeApt } from "@/lib/kakao/geocode";

export const dynamic = "force-dynamic";

const MAX_ITEMS = 500;
const MAX_FIELD_LEN = 200;
const SAFE_TEXT = /^[\p{L}\p{N}\s\-_().,#~/]+$/u;
const CONCURRENCY = 8;

type BatchItem = { aptNm: string; address: string };
type BatchOut = { aptNm: string; address: string; result: GeocodeResult | null };

function isValidItem(it: unknown): it is BatchItem {
  if (!it || typeof it !== "object") return false;
  const o = it as { aptNm?: unknown; address?: unknown };
  if (typeof o.aptNm !== "string" || typeof o.address !== "string") return false;
  if (!o.aptNm || !o.address) return false;
  if (o.aptNm.length > MAX_FIELD_LEN || o.address.length > MAX_FIELD_LEN) return false;
  if (!SAFE_TEXT.test(o.aptNm) || !SAFE_TEXT.test(o.address)) return false;
  return true;
}

async function runWithConcurrency<T, R>(
  items: T[],
  worker: (it: T) => Promise<R>,
  limit: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = idx;
      idx += 1;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { items?: unknown } | null;
  const items = body?.items;
  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "items 배열이 필요합니다." }, { status: 400 });
  }
  if (items.length === 0) {
    return NextResponse.json({ results: [] });
  }
  if (items.length > MAX_ITEMS) {
    return NextResponse.json(
      { error: `items 는 한 번에 최대 ${MAX_ITEMS}개까지 처리됩니다.` },
      { status: 400 },
    );
  }
  const invalidAt = items.findIndex((it) => !isValidItem(it));
  if (invalidAt !== -1) {
    return NextResponse.json(
      { error: `items[${invalidAt}] 의 aptNm/address 가 유효하지 않습니다.` },
      { status: 400 },
    );
  }

  // 같은 (aptNm,address) 중복 제거 후 1회만 호출, 결과를 원본 순서로 매핑.
  const valid = items as BatchItem[];
  const uniqMap = new Map<string, BatchItem>();
  for (const it of valid) uniqMap.set(`${it.aptNm}|${it.address}`, it);
  const uniqList = Array.from(uniqMap.values());

  const uniqResults = await runWithConcurrency(
    uniqList,
    async (it) => {
      try {
        const r = await geocodeApt(it.aptNm, it.address);
        return { aptNm: it.aptNm, address: it.address, result: r };
      } catch {
        return { aptNm: it.aptNm, address: it.address, result: null };
      }
    },
    CONCURRENCY,
  );

  const lookup = new Map<string, GeocodeResult | null>();
  for (const r of uniqResults) lookup.set(`${r.aptNm}|${r.address}`, r.result);

  const results: BatchOut[] = valid.map((it) => ({
    aptNm: it.aptNm,
    address: it.address,
    result: lookup.get(`${it.aptNm}|${it.address}`) ?? null,
  }));

  return NextResponse.json({ results });
}
