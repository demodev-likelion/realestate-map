import { XMLParser } from "fast-xml-parser";
import { unstable_cache } from "next/cache";
import type { RawAptRent, RawAptTrade } from "@/types/molit";

const TRADE_URL = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";
const RENT_URL = "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent";

const PAGE_SIZE = 1000;
const MAX_PAGES = 10; // 거래량 안전 상한 (월 1만건 = 강남구 최대 거래량의 ~3배)

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  numberParseOptions: { hex: false, leadingZeros: false },
  trimValues: true,
});

type MolitResponse<T> = {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: {
      items?: { item?: T | T[] } | "";
      totalCount?: number;
      pageNo?: number;
      numOfRows?: number;
    };
  };
};

function getServiceKey(): string {
  const key = process.env.MOLIT_SERVICE_KEY;
  if (!key) {
    throw new Error(
      "MOLIT_SERVICE_KEY 가 설정되지 않았습니다. .env.local 에 발급받은 키를 넣어 주세요.",
    );
  }
  return key;
}

function parsePrice(amountStr: string | number | undefined): number {
  if (amountStr == null) return 0;
  const s = String(amountStr).replace(/[^0-9]/g, "");
  return s ? parseInt(s, 10) : 0;
}

function toArray<T>(v: T | T[] | undefined | ""): T[] {
  if (v == null || v === "") return [];
  return Array.isArray(v) ? v : [v];
}

async function callMolitPage<T>(
  baseUrl: string,
  lawdCd: string,
  dealYmd: string,
  pageNo: number,
): Promise<{ items: T[]; totalCount: number }> {
  const params = new URLSearchParams({
    serviceKey: getServiceKey(),
    LAWD_CD: lawdCd,
    DEAL_YMD: dealYmd,
    pageNo: String(pageNo),
    numOfRows: String(PAGE_SIZE),
  });
  const url = `${baseUrl}?${params.toString()}`;
  // 공공데이터포털 WAF가 undici 기본 UA를 차단하므로 브라우저 UA를 명시.
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`MOLIT HTTP ${res.status} (${dealYmd}, ${lawdCd}, page ${pageNo})`);
  }
  const text = await res.text();
  const parsed = xmlParser.parse(text) as MolitResponse<T>;
  const code = parsed.response?.header?.resultCode;
  if (code && code !== "00" && code !== "000") {
    throw new Error(
      `MOLIT 응답 에러: ${parsed.response?.header?.resultMsg ?? code} (${dealYmd}, ${lawdCd}, page ${pageNo})`,
    );
  }
  const rawItems = parsed.response?.body?.items;
  const items = toArray<T>(rawItems === "" ? undefined : rawItems?.item);
  const totalCount = Number(parsed.response?.body?.totalCount ?? items.length);
  return { items, totalCount };
}

async function callMolitAllPages<T>(
  baseUrl: string,
  lawdCd: string,
  dealYmd: string,
): Promise<T[]> {
  const first = await callMolitPage<T>(baseUrl, lawdCd, dealYmd, 1);
  if (first.totalCount <= PAGE_SIZE) return first.items;

  const totalPages = Math.min(Math.ceil(first.totalCount / PAGE_SIZE), MAX_PAGES);
  if (totalPages <= 1) return first.items;

  const restPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
  const rest = await Promise.all(
    restPages.map((p) => callMolitPage<T>(baseUrl, lawdCd, dealYmd, p)),
  );
  return [...first.items, ...rest.flatMap((r) => r.items)];
}

type RawTradeXml = {
  aptNm?: string;
  aptDong?: string;
  umdNm?: string;
  jibun?: string;
  excluUseAr?: number | string;
  floor?: number;
  buildYear?: number;
  dealYear?: number;
  dealMonth?: number;
  dealDay?: number;
  dealAmount?: string | number;
  cdealType?: string;
  cdealDay?: string;
  estateAgentSggNm?: string;
};

type RawRentXml = {
  aptNm?: string;
  umdNm?: string;
  jibun?: string;
  excluUseAr?: number | string;
  floor?: number;
  buildYear?: number;
  dealYear?: number;
  dealMonth?: number;
  dealDay?: number;
  deposit?: string | number;
  monthlyRent?: string | number;
  contractType?: string;
  contractTerm?: string;
};

function normalizeTrade(raw: RawTradeXml): RawAptTrade | null {
  if (!raw.aptNm || !raw.dealYear || !raw.dealMonth || !raw.dealDay) return null;
  return {
    aptNm: String(raw.aptNm).trim(),
    aptDong: raw.aptDong ? String(raw.aptDong).trim() : undefined,
    umdNm: String(raw.umdNm ?? "").trim(),
    jibun: String(raw.jibun ?? "").trim(),
    excluUseAr: Number(raw.excluUseAr ?? 0),
    floor: Number(raw.floor ?? 0),
    buildYear: raw.buildYear ? Number(raw.buildYear) : undefined,
    dealYear: Number(raw.dealYear),
    dealMonth: Number(raw.dealMonth),
    dealDay: Number(raw.dealDay),
    dealAmount: parsePrice(raw.dealAmount),
    cdealType: raw.cdealType ? String(raw.cdealType).trim() : undefined,
    cdealDay: raw.cdealDay ? String(raw.cdealDay).trim() : undefined,
    estateAgentSggNm: raw.estateAgentSggNm ? String(raw.estateAgentSggNm) : undefined,
  };
}

function normalizeRent(raw: RawRentXml): RawAptRent | null {
  if (!raw.aptNm || !raw.dealYear || !raw.dealMonth || !raw.dealDay) return null;
  return {
    aptNm: String(raw.aptNm).trim(),
    umdNm: String(raw.umdNm ?? "").trim(),
    jibun: String(raw.jibun ?? "").trim(),
    excluUseAr: Number(raw.excluUseAr ?? 0),
    floor: Number(raw.floor ?? 0),
    buildYear: raw.buildYear ? Number(raw.buildYear) : undefined,
    dealYear: Number(raw.dealYear),
    dealMonth: Number(raw.dealMonth),
    dealDay: Number(raw.dealDay),
    deposit: parsePrice(raw.deposit),
    monthlyRent: parsePrice(raw.monthlyRent),
    contractType: raw.contractType ? String(raw.contractType) : undefined,
    contractTerm: raw.contractTerm ? String(raw.contractTerm) : undefined,
  };
}

export const fetchTradesByMonth = unstable_cache(
  async (lawdCd: string, dealYmd: string): Promise<RawAptTrade[]> => {
    const rows = await callMolitAllPages<RawTradeXml>(TRADE_URL, lawdCd, dealYmd);
    return rows.map(normalizeTrade).filter((r): r is RawAptTrade => r !== null);
  },
  ["molit-trade"],
  { revalidate: 60 * 60 * 24, tags: ["molit"] },
);

export const fetchRentsByMonth = unstable_cache(
  async (lawdCd: string, dealYmd: string): Promise<RawAptRent[]> => {
    const rows = await callMolitAllPages<RawRentXml>(RENT_URL, lawdCd, dealYmd);
    return rows.map(normalizeRent).filter((r): r is RawAptRent => r !== null);
  },
  ["molit-rent"],
  { revalidate: 60 * 60 * 24, tags: ["molit"] },
);

export function buildYmdRange(months: number, now: Date = new Date()): string[] {
  if (!Number.isFinite(months) || months <= 0) return [];
  const list: string[] = [];
  for (let i = 0; i < months; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    list.push(`${y}${m}`);
  }
  return list;
}
