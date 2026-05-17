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

export function KakaoMap({ apts, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Kakao | null>(null);
  const clustererRef = useRef<Kakao | null>(null);
  const infoWindowRef = useRef<Kakao | null>(null);
  const cacheRef = useRef<GeocodeCache>({});
  const [sdkReady, setSdkReady] = useState(false);
  const [progress, setProgress] = useState({ mapped: 0, total: 0 });

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
    const markers: Kakao[] = [];
    const bounds = new kakao.maps.LatLngBounds();
    setProgress({ mapped: 0, total: apts.length });

    const placeOne = async (apt: AggregatedApt) => {
      const cacheKey = `${apt.aptNm}|${apt.fullAddress}`;
      let coord = cacheRef.current[cacheKey];
      if (coord === undefined) {
        try {
          const res = await fetch("/api/geocode", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ aptNm: apt.aptNm, address: apt.fullAddress }),
          });
          const json = (await res.json()) as { result: { lat: number; lng: number } | null };
          coord = json.result ?? null;
          cacheRef.current[cacheKey] = coord;
        } catch {
          coord = null;
          cacheRef.current[cacheKey] = null;
        }
      }
      if (cancelled || !coord) return;
      const position = new kakao.maps.LatLng(coord.lat, coord.lng);
      const marker = new kakao.maps.Marker({ position });
      kakao.maps.event.addListener(marker, "click", () => {
        const html = `
          <div style="padding:10px 12px;min-width:220px;font-size:13px;line-height:1.5;">
            <div style="font-weight:600;margin-bottom:6px;">${escapeHtml(apt.aptNm)}</div>
            <div style="color:#555;">${escapeHtml(apt.fullAddress)}</div>
            <div style="margin-top:6px;">평균 <b>${formatManwon(apt.avgPrice)}</b></div>
            <div style="color:#777;">최근거래 ${apt.recentDealDate} · ${apt.dealCount}건 · ${formatArea(apt.area)}</div>
            <button data-key="${apt.key}" style="margin-top:8px;padding:6px 10px;border:none;background:#fee500;border-radius:4px;cursor:pointer;font-weight:600;">상세 보기</button>
          </div>`;
        if (!infoWindowRef.current) {
          infoWindowRef.current = new kakao.maps.InfoWindow({ removable: true });
        }
        infoWindowRef.current.setContent(html);
        infoWindowRef.current.open(mapRef.current, marker);
        setTimeout(() => {
          const btn = document.querySelector(`button[data-key="${apt.key}"]`);
          btn?.addEventListener("click", () => onSelect(apt));
        }, 0);
      });
      markers.push(marker);
      bounds.extend(position);
      setProgress((p) => ({ mapped: p.mapped + 1, total: p.total }));
    };

    const run = async () => {
      const batchSize = 10;
      for (let i = 0; i < apts.length; i += batchSize) {
        if (cancelled) return;
        const batch = apts.slice(i, i + batchSize);
        await Promise.all(batch.map(placeOne));
      }
      if (cancelled) return;
      clustererRef.current.addMarkers(markers);
      if (markers.length > 0) mapRef.current.setBounds(bounds);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [apts, onSelect, sdkReady]);

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

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
