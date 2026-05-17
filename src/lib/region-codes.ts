import regionCodesJson from "@/data/region-codes.json";

export type Sigungu = { name: string; code: string };
export type RegionMap = Record<string, Sigungu[]>;

export const regionMap = regionCodesJson as RegionMap;

export const sidoList = Object.keys(regionMap);

export function findRegionByCode(code: string): { sido: string; sigungu: Sigungu } | null {
  for (const sido of sidoList) {
    const hit = regionMap[sido].find((r) => r.code === code);
    if (hit) return { sido, sigungu: hit };
  }
  return null;
}
