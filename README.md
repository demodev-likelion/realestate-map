# 전국 아파트 실거래가 지도 (Next.js)

국토교통부 실거래가 OpenAPI를 카카오맵 위에 시각화하고, 단지를 클릭하면 매매·전세 12개월 추이 차트가 나오는 SPA.

![preview](./public/preview.png)

## 기능

- 전국 시·도 + 시·군·구 cascade 선택 (250+ 지역)
- 거래유형(매매) + 조회 기간(1·3·6·12개월) 선택
- 단지별 평균/최고/최저 시세 마커 + 카카오 클러스터러
- 마커 클릭 시 우측 패널에 매매/전세 추이 라인 차트 (Recharts)
- 좌표 변환 결과 영구 캐시 (`unstable_cache`) — 1회 조회 후 호출량 급감
- 국토부 응답 24시간 캐시

## 기술 스택

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- 카카오맵 JS SDK (clusterer, services)
- 카카오 로컬 REST (주소→좌표)
- Recharts
- `fast-xml-parser` (국토부 XML 파싱)
- 패키지 매니저: `pnpm`
- 린트/포맷: `biome`

## 사전 준비

1. [공공데이터포털](https://www.data.go.kr) 가입 후 두 API 활용신청 (자동 승인)
   - `국토교통부_아파트 매매 실거래가 상세 자료`
   - `국토교통부_아파트 전월세 자료`
2. [카카오 디벨로퍼스](https://developers.kakao.com) 가입 후 앱 생성
   - **JavaScript 키** + **REST API 키** 둘 다 사용
   - 플랫폼 → Web 도메인에 `http://localhost:3000` (배포 후 `https://<vercel-domain>`) 등록
3. 키를 `.env.local` 에 작성

```bash
cp .env.local.example .env.local
# .env.local 편집
```

## 개발

```bash
pnpm install
pnpm dev
open http://localhost:3000
```

검증:

```bash
pnpm typecheck
pnpm lint
```

## API 단위 테스트

```bash
# 강남구(11680) 최근 1개월 매매
curl "http://localhost:3000/api/trades?lawdCd=11680&months=1" | jq '.items | length'

# 좌표 변환
curl -X POST http://localhost:3000/api/geocode \
  -H 'content-type: application/json' \
  -d '{"aptNm":"래미안대치팰리스","address":"서울특별시 강남구 대치동 670"}' | jq

# 특정 단지 12개월 시계열
curl "http://localhost:3000/api/apt-series?lawdCd=11680&months=12&key=래미안대치팰리스|670|85" | jq
```

## Vercel 배포

1. GitHub repo 푸시 → Vercel "New Project" → Import
2. 환경변수 4개 등록:
   - `MOLIT_SERVICE_KEY`
   - `KAKAO_REST_API_KEY`
   - `NEXT_PUBLIC_KAKAO_JS_KEY`
   - `NEXT_PUBLIC_SITE_URL` (배포 후 도메인)
3. 배포 도메인을 카카오 디벨로퍼스 → 플랫폼 → Web 에 추가
4. `pnpm build` 가 통과하면 자동 배포

## 디렉터리 개요

```
src/
├── app/
│   ├── api/
│   │   ├── apt-series/  # 단지 12개월 매매·전세 시계열
│   │   ├── geocode/     # 카카오 주소→좌표
│   │   ├── regions/     # 시·도·시군구 목록
│   │   ├── rents/       # 전월세 거래
│   │   └── trades/      # 매매 거래 (집계 응답)
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── map/             # KakaoMap, 클러스터러, 인포윈도우
│   ├── panel/           # AptDetail, PriceChart
│   └── sidebar/         # 지역·기간 선택 사이드바
├── data/
│   └── region-codes.json
├── lib/
│   ├── kakao/geocode.ts
│   ├── molit/{client,aggregate}.ts
│   ├── region-codes.ts
│   └── utils.ts
└── types/molit.ts
```

## 라이선스 / 출처

- 거래 데이터: 국토교통부 실거래가 공개시스템 (data.go.kr)
- 지도: ⓒ Kakao Map
