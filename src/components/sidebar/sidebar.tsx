"use client";

import { useMemo } from "react";
import { LuLoaderCircle, LuMapPin, LuSearch } from "react-icons/lu";
import { regionMap, sidoList } from "@/lib/region-codes";
import { cn } from "@/lib/utils";

export type SidebarValue = {
  sido: string;
  lawdCd: string;
  months: number;
};

type Props = {
  value: SidebarValue;
  onChange: (v: SidebarValue) => void;
  onSubmit: () => void;
  loading: boolean;
  stats?: { rawCount: number; aptCount: number; sidoSigungu: string } | null;
  errors?: string[];
};

const MONTH_OPTIONS = [1, 3, 6, 12];

export function Sidebar({ value, onChange, onSubmit, loading, stats, errors }: Props) {
  const sigunguList = useMemo(() => regionMap[value.sido] ?? [], [value.sido]);

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-r border-slate-200 bg-slate-50 p-5">
      <header className="mb-5">
        <h1 className="text-lg font-semibold text-slate-900">전국 아파트 실거래가 지도</h1>
        <p className="mt-1 text-xs text-slate-500">국토교통부 OpenAPI · 카카오맵</p>
      </header>

      <div className="space-y-4">
        <Field label="시 / 도">
          <select
            className="form-select"
            value={value.sido}
            onChange={(e) => {
              const sido = e.target.value;
              const first = regionMap[sido]?.[0];
              onChange({ ...value, sido, lawdCd: first?.code ?? "" });
            }}
          >
            {sidoList.map((sido) => (
              <option key={sido} value={sido}>
                {sido}
              </option>
            ))}
          </select>
        </Field>

        <Field label="시 / 군 / 구">
          <select
            className="form-select"
            value={value.lawdCd}
            onChange={(e) => onChange({ ...value, lawdCd: e.target.value })}
          >
            {sigunguList.map((sg) => (
              <option key={sg.code} value={sg.code}>
                {sg.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="조회 기간">
          <div className="grid grid-cols-4 gap-1.5">
            {MONTH_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChange({ ...value, months: m })}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-xs font-medium transition",
                  value.months === m
                    ? "border-amber-400 bg-amber-100 text-amber-900"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100",
                )}
              >
                {m}개월
              </button>
            ))}
          </div>
        </Field>

        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || !value.lawdCd}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-amber-400 px-3 py-2.5 text-sm font-semibold text-amber-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          {loading ? (
            <>
              <LuLoaderCircle className="size-4 animate-spin" />
              조회 중…
            </>
          ) : (
            <>
              <LuSearch className="size-4" />
              데이터 불러오기
            </>
          )}
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {stats ? (
          <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">
            <div className="flex items-center gap-1 font-medium text-slate-900">
              <LuMapPin className="size-3.5" />
              {stats.sidoSigungu}
            </div>
            <Row label="조회 거래 건수" value={`${stats.rawCount.toLocaleString()}건`} />
            <Row label="단지 수" value={`${stats.aptCount.toLocaleString()}개`} />
          </div>
        ) : null}

        {errors?.length ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <div className="font-medium">일부 월 조회 실패</div>
            <ul className="mt-1 space-y-0.5">
              {errors.map((e) => (
                <li key={e}>· {e}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <footer className="mt-auto pt-6 text-[11px] text-slate-400">
        데이터: 국토교통부 실거래가 공개시스템 · 좌표: 카카오맵
      </footer>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block text-xs font-medium text-slate-600">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-1.5 flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-rose-500">{value}</span>
    </div>
  );
}
