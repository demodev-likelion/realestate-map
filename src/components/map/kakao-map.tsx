"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { formatArea, formatManwon } from "@/lib/utils";
import type { AggregatedApt } from "@/types/molit";

type Props = {
  apts: AggregatedApt[];
  onSelect: (apt: AggregatedApt) => void;
};

type GeocodeCache = Record<string, { lat: number; lng: number } | null>;

// biome-ignore lint/suspicious/noExplicitAny: Kakao Maps SDK has no first-party types
type Kakao = any;

declare global {
  interface Window {
    // biome-ignore lint/suspicious/noExplicitAny: Global SDK
    kakao: any;
  }
}

const JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
const BATCH_SIZE = 200;

export function KakaoMap({ apts, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Kakao | null>(null);
  const clustererRef = useRef<Kakao | null>(null);
  const infoWindowRef = useRef<Kakao | null>(null);
  const cacheRef = useRef<GeocodeCache>({});
  const onSelectRef = useRef(onSelect);
  const [sdkReady, setSdkReady] = useState(false);
  const [progress, setProgress] = useState({ mapped: 0, total: 0 });

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const initMap = () => {
    if (!containerRef.current || mapRef.current) return;
    const kakao = window.kakao;
    if (!kakao?.maps) return;

    kakao.maps.load(() => {
      const el = containerRef.current;
      if (!el) return;
      mapRef.current = new kakao.maps.Map(el, {
        center: new kakao.maps.LatLng(37.5665, 126.978),
        level: 8,
      });
      clustererRef.current = new kakao.maps.MarkerClusterer({
        map: mapRef.current,
        averageCenter: true,
        minLevel: 6,
        gridSize: 60,
      });
      setSdkReady(true);
    });
  };

  useEffect(() => {
    if (!sdkReady || !mapRef.current || !clustererRef.current) return;
    if (!apts.length) {
      clustererRef.current.clear();
      setProgress({ mapped: 0, total: 0 });
      return;
    }

    let cancelled = false;
    const kakao = window.kakao;
    clustererRef.current.clear();
    setProgress({ mapped: 0, total: apts.length });

    const run = async () => {
      // 1) cache 안 된 단지만 batch geocode
      const unknown = apts.filter(
        (a) => cacheRef.current[`${a.aptNm}|${a.fullAddress}`] === undefined,
      );
      for (let i = 0; i < unknown.length; i += BATCH_SIZE) {
        if (cancelled) return;
        const chunk = unknown.slice(i, i + BATCH_SIZE);
        try {
          const res = await fetch("/api/geocode/batch", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              items: chunk.map((a) => ({ aptNm: a.aptNm, address: a.fullAddress })),
            }),
          });
          const json = (await res.json()) as {
            results?: {
              aptNm: string;
              address: string;
              result: { lat: number; lng: number } | null;
            }[];
          };
          for (const r of json.results ?? []) {
            cacheRef.current[`${r.aptNm}|${r.address}`] = r.result;
          }
        } catch {
          // 단일 batch 실패는 무시. 다음 batch 진행.
        }
      }
      if (cancelled) return;

      // 2) cache 에서 좌표 꺼내 마커 생성
      const markers: Kakao[] = [];
      const bounds = new kakao.maps.LatLngBounds();
      let mapped = 0;
      for (const apt of apts) {
        const coord = cacheRef.current[`${apt.aptNm}|${apt.fullAddress}`];
        if (!coord) continue;
        const position = new kakao.maps.LatLng(coord.lat, coord.lng);
        const marker = new kakao.maps.Marker({ position });
        kakao.maps.event.addListener(marker, "click", () => openInfoWindow(apt, marker));
        markers.push(marker);
        bounds.extend(position);
        mapped += 1;
      }
      if (cancelled) return;
      clustererRef.current.addMarkers(markers);
      if (markers.length > 0) mapRef.current.setBounds(bounds);
      setProgress({ mapped, total: apts.length });
    };

    const openInfoWindow = (apt: AggregatedApt, marker: Kakao) => {
      const root = buildInfoWindowDom(apt, () => onSelectRef.current(apt));
      if (!infoWindowRef.current) {
        infoWindowRef.current = new kakao.maps.InfoWindow({ removable: true });
      }
      infoWindowRef.current.setContent(root);
      infoWindowRef.current.open(mapRef.current, marker);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [apts, sdkReady]);

  if (!JS_KEY) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-red-500">
        NEXT_PUBLIC_KAKAO_JS_KEY 가 설정되지 않았습니다.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${JS_KEY}&autoload=false&libraries=clusterer,services`}
        strategy="afterInteractive"
        onLoad={initMap}
      />
      <div ref={containerRef} className="h-full w-full" />
      {progress.total > 0 && progress.mapped < progress.total ? (
        <div className="absolute right-4 top-4 rounded-md bg-black/70 px-3 py-2 text-xs text-white shadow-lg">
          좌표 변환 중… {progress.mapped}/{progress.total}
        </div>
      ) : null}
    </div>
  );
}

// innerHTML 대신 DOM API로 빌드 — 외부 API 문자열을 HTML로 해석하지 않음.
function buildInfoWindowDom(apt: AggregatedApt, onDetailClick: () => void): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "padding:10px 12px;min-width:220px;font-size:13px;line-height:1.5;";

  const title = document.createElement("div");
  title.style.cssText = "font-weight:600;margin-bottom:6px;";
  title.textContent = apt.aptNm;
  wrap.appendChild(title);

  const addr = document.createElement("div");
  addr.style.color = "#555";
  addr.textContent = apt.fullAddress;
  wrap.appendChild(addr);

  const avg = document.createElement("div");
  avg.style.marginTop = "6px";
  const avgLabel = document.createTextNode("평균 ");
  const avgVal = document.createElement("b");
  avgVal.textContent = formatManwon(apt.avgPrice);
  avg.appendChild(avgLabel);
  avg.appendChild(avgVal);
  wrap.appendChild(avg);

  const meta = document.createElement("div");
  meta.style.color = "#777";
  meta.textContent = `최근거래 ${apt.recentDealDate} · ${apt.dealCount}건 · ${formatArea(apt.area)}`;
  wrap.appendChild(meta);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "상세 보기";
  btn.style.cssText =
    "margin-top:8px;padding:6px 10px;border:none;background:#fee500;border-radius:4px;cursor:pointer;font-weight:600;color:#3c1e1e;";
  btn.addEventListener("click", onDetailClick);
  wrap.appendChild(btn);

  return wrap;
}
