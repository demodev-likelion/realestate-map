# realestate-map

전국 아파트 실거래가를 카카오맵 위에 띄우고, 단지별 매매·전세 추이 차트를 보여주는 Next.js 앱.

## 빌드 / 검증

- 개발: `pnpm dev` → http://localhost:3000
- 빌드: `pnpm build && pnpm start`
- 타입체크: `pnpm typecheck`
- 린트: `pnpm lint`
- 포맷: `pnpm format`

## 도메인 용어

- **법정동 코드(LAWD_CD)**: 행정안전부가 부여하는 10자리 코드. 국토부 실거래가 API는 앞 5자리만 사용 (시·군·구 단위).
- **단지 키**: `${aptNm}|${jibun}|${전용면적 반올림}`. 같은 단지라도 평형이 다르면 시세가 달라 분리 집계함.
- **매매 거래금액**: API 응답에서 쉼표 포함 만원 단위 문자열 (예: `"125,000"`). 숫자만 추출해 `number`로 정규화.

## 외부 API

- 국토교통부_아파트 매매: `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev`
- 국토교통부_아파트 전월세: `https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent`
- 카카오 로컬 REST (주소→좌표): `https://dapi.kakao.com/v2/local/search/address.json`
- 카카오맵 JS SDK: `https://dapi.kakao.com/v2/maps/sdk.js`

## 캐싱 전략

- 국토부 응답: `unstable_cache((lawdCd, yyyymm), revalidate=24h)`
- 카카오 지오코딩: `unstable_cache((aptNm, address), revalidate=1y)` — 좌표는 사실상 영구

## 디렉터리 메모

- `src/lib/molit/`: 국토부 API 클라이언트와 집계 로직.
- `src/lib/kakao/`: 지오코딩 래퍼.
- `src/app/api/`: Route Handler 4종 (regions, trades, rents, geocode, apt-series).
- `src/components/{map,sidebar,panel}/`: UI 컴포넌트.
- `src/data/region-codes.json`: 시·도 + 시·군·구 → 법정동 5자리 코드.

## 공통 규칙

- 새 파일 생성 전 사용자 확인 (단, 기존 모듈에 함수 추가는 자유).
- 주석은 한국어로 작성.
- 패키지 추가는 `pnpm add` 사용 — package.json 수동 편집 금지.
