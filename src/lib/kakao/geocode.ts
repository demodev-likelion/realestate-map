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

export type GeocodeResult = { lat: number; lng: number; source: "address" | "keyword" } | null;

export const geocodeApt = unstable_cache(
  async (aptNm: string, address: string): Promise<GeocodeResult> => {
    const cleaned = address.trim();
    if (cleaned) {
      const addr = (await geocodeOnce(cleaned, "address")) as AddressResponse | null;
      const first = addr?.documents?.[0];
      if (first) {
        return { lat: parseFloat(first.y), lng: parseFloat(first.x), source: "address" };
      }
    }

    const kwQuery = `${address} ${aptNm}`.trim();
    if (kwQuery) {
      const kw = (await geocodeOnce(kwQuery, "keyword")) as KeywordResponse | null;
      const first = kw?.documents?.[0];
      if (first) {
        return { lat: parseFloat(first.y), lng: parseFloat(first.x), source: "keyword" };
      }
    }
    return null;
  },
  ["kakao-geocode-apt"],
  { revalidate: 60 * 60 * 24 * 365, tags: ["kakao-geocode"] },
);
