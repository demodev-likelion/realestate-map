import { XMLParser } from "fast-xml-parser";
import { unstable_cache } from "next/cache";
import type { RawAptRent, RawAptTrade } from "@/types/molit";

const TRADE_URL =
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";
const RENT_URL = "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent";

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

async function callMolit<T>(baseUrl: string, lawdCd: string, dealYmd: string): Promise<T[]> {
  const params = new URLSearchParams({
    serviceKey: getServiceKey(),
    LAWD_CD: lawdCd,
    DEAL_YMD: dealYmd,
    pageNo: "1",
    numOfRows: "1000",
  });
  const url = `${baseUrl}?${params.toString()}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`MOLIT HTTP ${res.status} (${dealYmd}, ${lawdCd})`);
  }
  const text = await res.text();
  const parsed = xmlParser.parse(text) as MolitResponse<T>;
  const code = parsed.response?.header?.resultCode;
  if (code && code !== "00" && code !== "000") {
    throw new Error(
      `MOLIT 응답 에러: ${parsed.response?.header?.resultMsg ?? code} (${dealYmd}, ${lawdCd})`,
    );
  }
  return toArray<T>(
    parsed.response?.body?.items === "" ? undefined : parsed.response?.body?.items?.item,
  );
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
    cdealType: raw.cdealType ? String(raw.cdealType) : undefined,
    cdealDay: raw.cdealDay ? String(raw.cdealDay) : undefined,
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
    const rows = await callMolit<RawTradeXml>(TRADE_URL, lawdCd, dealYmd);
    return rows.map(normalizeTrade).filter((r): r is RawAptTrade => r !== null);
  },
  ["molit-trade"],
  { revalidate: 60 * 60 * 24, tags: ["molit"] },
);

export const fetchRentsByMonth = unstable_cache(
  async (lawdCd: string, dealYmd: string): Promise<RawAptRent[]> => {
    const rows = await callMolit<RawRentXml>(RENT_URL, lawdCd, dealYmd);
    return rows.map(normalizeRent).filter((r): r is RawAptRent => r !== null);
  },
  ["molit-rent"],
  { revalidate: 60 * 60 * 24, tags: ["molit"] },
);

export function buildYmdRange(months: number, now: Date = new Date()): string[] {
  const list: string[] = [];
  for (let i = 0; i < months; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    list.push(`${y}${m}`);
  }
  return list;
}
