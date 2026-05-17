"use client";

import { useEffect, useState } from "react";
import { LuX } from "react-icons/lu";
import { formatArea, formatManwon } from "@/lib/utils";
import type { AggregatedApt, AptTimeSeries } from "@/types/molit";
import { PriceChart } from "./price-chart";

type Props = {
  apt: AggregatedApt | null;
  lawdCd: string;
  onClose: () => void;
};

export function AptDetail({ apt, lawdCd, onClose }: Props) {
  const [series, setSeries] = useState<AptTimeSeries | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!apt) {
      setSeries(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setSeries(null);
    const url = `/api/apt-series?lawdCd=${lawdCd}&months=12&key=${encodeURIComponent(apt.key)}`;
    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setSeries(data as AptTimeSeries))
      .catch((err: unknown) => {
        if (err instanceof Error && err.name !== "AbortError") setSeries(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [apt, lawdCd]);

  if (!apt) return null;

  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-[400px] flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-900 dark:text-slate-50">
            {apt.aptNm}
          </h2>
          <p className="mt-0.5 truncate text-xs text-slate-500">{apt.fullAddress}</p>
          <p className="mt-1 text-[11px] text-slate-400">
            {formatArea(apt.area)} {apt.buildYear ? `· ${apt.buildYear}년 준공` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 -mt-1 rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="close"
        >
          <LuX className="size-4" />
        </button>
      </header>

      <div className="grid grid-cols-3 gap-3 border-b border-slate-200 px-5 py-4 text-center dark:border-slate-800">
        <Stat label="평균 매매가" value={formatManwon(apt.avgPrice)} highlight />
        <Stat label="최고" value={formatManwon(apt.maxPrice)} />
        <Stat label="최저" value={formatManwon(apt.minPrice)} />
      </div>

      <div className="px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            매매 / 전세 추이 (최근 12개월)
          </h3>
          <span className="text-[11px] text-slate-400">단위: 만원</span>
        </div>
        <PriceChart data={series} loading={loading} />
      </div>

      <div className="mt-auto px-5 py-3 text-[11px] text-slate-400">
        최근 거래일: {apt.recentDealDate} · 표시 기간 내 거래 {apt.dealCount}건
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-slate-400">{label}</div>
      <div
        className={`mt-1 text-sm font-semibold ${
          highlight ? "text-rose-500" : "text-slate-800 dark:text-slate-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
