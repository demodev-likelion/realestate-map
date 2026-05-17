import { unstable_cache } from "next/cache";

type AddressResponse = {
  documents: Array<{
    x: string;
    y: string;
    address_name?: string;
  }>;
};

type KeywordResponse = {
  documents: Array<{
    x: string;
    y: string;
    place_name?: string;
    road_address_name?: string;
  }>;
};

const NOT_FOUND_MARKER = "__GEOCODE_NOT_FOUND__";
const FAILURE_TTL_MS = 60 * 60 * 1000; // null 결과는 1시간만 메모리 캐시 (장애 영구화 방지)
const failureMemCache = new Map<string, number>();

function getRestKey(): string {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    throw new Error(
      "KAKAO_REST_API_KEY 가 설정되지 않았습니다. .env.local 에 카카오 REST API 키를 넣어 주세요.",
    );
  }
  return key;
}

async function geocodeOnce(query: string, endpoint: "address" | "keyword") {
  const url =
    endpoint === "address"
      ? `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`
      : `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(
          query,
        )}&size=1`;

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${getRestKey()}` },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    return null;
  }
  return (await res.json()) as AddressResponse | KeywordResponse;
}

export type GeocodeResult = { lat: number; lng: number; source: "address" | "keyword" };

async function rawGeocode(aptNm: string, address: string): Promise<GeocodeResult | null> {
  const cleaned = address.trim();
  if (cleaned) {
    const addr = (await geocodeOnce(cleaned, "address")) as AddressResponse | null;
    const first = addr?.documents?.[0];
    if (first) {
      const lat = parseFloat(first.y);
      const lng = parseFloat(first.x);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng, source: "address" };
      }
    }
  }
  const kwQuery = `${address} ${aptNm}`.trim();
  if (kwQuery) {
    const kw = (await geocodeOnce(kwQuery, "keyword")) as KeywordResponse | null;
    const first = kw?.documents?.[0];
    if (first) {
      const lat = parseFloat(first.y);
      const lng = parseFloat(first.x);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng, source: "keyword" };
      }
    }
  }
  return null;
}

// 성공 결과만 unstable_cache 에 보관. throw 시 캐시 안 됨.
const cachedSuccessGeocode = unstable_cache(
  async (aptNm: string, address: string): Promise<GeocodeResult> => {
    const r = await rawGeocode(aptNm, address);
    if (!r) throw new Error(NOT_FOUND_MARKER);
    return r;
  },
  ["kakao-geocode-success"],
  { revalidate: 60 * 60 * 24 * 365, tags: ["kakao-geocode"] },
);

export async function geocodeApt(aptNm: string, address: string): Promise<GeocodeResult | null> {
  if (!aptNm || !address) return null;
  const memKey = `${aptNm}|${address}`;
  const failExpiry = failureMemCache.get(memKey);
  if (failExpiry !== undefined) {
    if (failExpiry > Date.now()) return null;
    failureMemCache.delete(memKey);
  }

  try {
    return await cachedSuccessGeocode(aptNm, address);
  } catch (err) {
    if (err instanceof Error && err.message === NOT_FOUND_MARKER) {
      failureMemCache.set(memKey, Date.now() + FAILURE_TTL_MS);
      return null;
    }
    throw err;
  }
}
