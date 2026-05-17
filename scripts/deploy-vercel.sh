#!/usr/bin/env bash
# .env.local 변수를 Vercel(production/preview/development) 환경에 동기화한 뒤 production 배포.
# 두 번째 실행부터는 기존 값이 있는 변수는 자동으로 건너뜁니다.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo ".env.local 파일을 찾을 수 없습니다." >&2
  exit 1
fi

ENVIRONMENTS=("production" "preview" "development")

# 빈 줄/주석 제거 후 라인별 처리
while IFS= read -r line || [ -n "$line" ]; do
  # 주석·빈 줄 스킵
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

  key="${line%%=*}"
  value="${line#*=}"
  # 좌우 공백 제거
  key="$(echo -n "$key" | xargs)"
  # 양쪽 따옴표 제거
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"

  [[ -z "$key" || -z "$value" ]] && continue

  for env in "${ENVIRONMENTS[@]}"; do
    # 기존 값이 있는지 확인 (있으면 스킵). grep 미스매치(exit 1)에 안전하도록 || true.
    existing="$(vercel env ls "$env" 2>/dev/null | awk '{print $1}' | grep -Fx "$key" || true)"
    if [ -n "$existing" ]; then
      echo "skip  $key ($env) — 이미 등록됨"
      continue
    fi
    if printf '%s' "$value" | vercel env add "$key" "$env" >/dev/null 2>&1; then
      echo "added $key ($env)"
    else
      echo "warn  $key ($env) — 등록 실패 (이미 있거나 권한 문제일 수 있음)"
    fi
  done
done < .env.local

echo
echo "===== production 배포 시작 ====="
vercel deploy --prod
