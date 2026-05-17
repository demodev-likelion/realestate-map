"use client";

import { useCallback, useState } from "react";
import { KakaoMap } from "@/components/map/kakao-map";
import { AptDetail } from "@/components/panel/apt-detail";
import { Sidebar, type SidebarValue } from "@/components/sidebar/sidebar";
import { regionMap } from "@/lib/region-codes";
import type { AggregatedApt } from "@/types/molit";

type TradesResponse = {
  sidoSigungu: string;
  rawCount: number;
  items: AggregatedApt[];
  errors?: string[];
  error?: string;
};

const DEFAULT_SIDO = "서울특별시";

export default function Home() {
  const [value, setValue] = useState<SidebarValue>({
    sido: DEFAULT_SIDO,
    lawdCd: regionMap[DEFAULT_SIDO][0].code,
    months: 3,
  });
  const [apts, setApts] = useState<AggregatedApt[]>([]);
  const [stats, setStats] = useState<{
    rawCount: number;
    aptCount: number;
    sidoSigungu: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [selected, setSelected] = useState<AggregatedApt | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!value.lawdCd) return;
    setLoading(true);
    setErrors([]);
    setSelected(null);
    try {
      const url = `/api/trades?lawdCd=${value.lawdCd}&months=${value.months}`;
      const res = await fetch(url);
      const json = (await res.json()) as TradesResponse;
      if (json.error) {
        setErrors([json.error]);
        setApts([]);
        setStats(null);
      } else {
        setApts(json.items);
        setStats({
          rawCount: json.rawCount,
          aptCount: json.items.length,
          sidoSigungu: json.sidoSigungu,
        });
        if (json.errors) setErrors(json.errors);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      setErrors([msg]);
    } finally {
      setLoading(false);
    }
  }, [value.lawdCd, value.months]);

  return (
    <main className="flex h-dvh w-full overflow-hidden">
      <Sidebar
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        loading={loading}
        stats={stats}
        errors={errors}
      />
      <div className="relative flex-1">
        <KakaoMap apts={apts} onSelect={setSelected} />
        <AptDetail apt={selected} lawdCd={value.lawdCd} onClose={() => setSelected(null)} />
      </div>
    </main>
  );
}
