"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AptTimeSeries } from "@/types/molit";

type Props = {
  data: AptTimeSeries | null;
  loading: boolean;
};

type Row = { yyyymm: string; trade?: number; rent?: number };

export function PriceChart({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-slate-400">
        시계열 데이터를 불러오는 중…
      </div>
    );
  }
  if (!data || (data.trade.length === 0 && data.rent.length === 0)) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-slate-400">
        최근 12개월 거래 데이터가 없습니다.
      </div>
    );
  }

  const monthSet = new Set<string>();
  for (const p of data.trade) monthSet.add(p.yyyymm);
  for (const p of data.rent) monthSet.add(p.yyyymm);
  const rows: Row[] = Array.from(monthSet)
    .sort()
    .map((m) => ({
      yyyymm: m,
      trade: data.trade.find((p) => p.yyyymm === m)?.avgPrice,
      rent: data.rent.find((p) => p.yyyymm === m)?.avgPrice,
    }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 10, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="yyyymm" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${Math.round(Number(v) / 10000)}억`}
            width={50}
          />
          <Tooltip
            formatter={(v) => `${Number(v).toLocaleString()}만원`}
            labelFormatter={(label) => `${label}`}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="trade"
            name="매매 평균"
            stroke="#ef4444"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="rent"
            name="전세 평균"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
