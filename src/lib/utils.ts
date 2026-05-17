import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatManwon(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "-";
  if (value >= 10000) {
    const eok = Math.floor(value / 10000);
    const rest = value % 10000;
    return rest > 0 ? `${eok}억 ${rest.toLocaleString()}만` : `${eok}억`;
  }
  return `${value.toLocaleString()}만`;
}

export function formatArea(m2: number): string {
  if (!m2) return "-";
  const pyeong = Math.round(m2 / 3.3058);
  return `${m2.toFixed(1)}㎡ (${pyeong}평)`;
}
