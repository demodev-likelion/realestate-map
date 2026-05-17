import { NextResponse } from "next/server";
import { geocodeApt } from "@/lib/kakao/geocode";

export const dynamic = "force-dynamic";

const MAX_FIELD_LEN = 200;

// 한글/영문/숫자/공백/일부 특수문자만 허용. 카카오 쿼리에 안전하지 않은 패턴 차단.
const SAFE_TEXT = /^[\p{L}\p{N}\s\-_().,#~/]+$/u;

type Validated = { aptNm: string; address: string };

function validate(
  aptNm: unknown,
  address: unknown,
): { ok: true; value: Validated } | { ok: false; error: string } {
  if (typeof aptNm !== "string" || typeof address !== "string") {
    return { ok: false, error: "aptNm 과 address 는 문자열이어야 합니다." };
  }
  if (aptNm.length === 0 || address.length === 0) {
    return { ok: false, error: "aptNm 과 address 는 비어있을 수 없습니다." };
  }
  if (aptNm.length > MAX_FIELD_LEN || address.length > MAX_FIELD_LEN) {
    return { ok: false, error: `aptNm/address 길이는 ${MAX_FIELD_LEN}자 이하여야 합니다.` };
  }
  if (!SAFE_TEXT.test(aptNm) || !SAFE_TEXT.test(address)) {
    return { ok: false, error: "aptNm/address 에 허용되지 않은 문자가 포함되어 있습니다." };
  }
  return { ok: true, value: { aptNm, address } };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    aptNm?: unknown;
    address?: unknown;
  } | null;
  const v = validate(body?.aptNm, body?.address);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  try {
    const result = await geocodeApt(v.value.aptNm, v.value.address);
    return NextResponse.json({ result: result ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const v = validate(searchParams.get("aptNm") ?? "", searchParams.get("address") ?? "");
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const result = await geocodeApt(v.value.aptNm, v.value.address);
  return NextResponse.json({ result: result ?? null });
}
