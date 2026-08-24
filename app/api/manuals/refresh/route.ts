import { NextResponse } from "next/server";
import {
  requireRequestAuth,
  sameOrigin,
} from "@/src/lib/auth/session";
import { getManualRepository } from "@/src/lib/notion";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireRequestAuth(request);
  } catch {
    return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
  }
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "不正なリクエストです。" }, { status: 403 });
  }

  try {
    const result = await getManualRepository().getSnapshot(true);
    if (result.warning === "refresh-cooldown") {
      return NextResponse.json(
        { error: "更新の間隔が短すぎます。" },
        { status: 429, headers: { "Retry-After": "30" } },
      );
    }
    if (result.source === "stale") {
      return NextResponse.json(
        { error: "最新情報を取得できませんでした。", stale: true },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, syncedAt: result.snapshot.syncedAt });
  } catch {
    return NextResponse.json(
      { error: "マニュアルを取得できませんでした。" },
      { status: 503 },
    );
  }
}
