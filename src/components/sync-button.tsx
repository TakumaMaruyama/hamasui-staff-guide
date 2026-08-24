"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SyncState = "idle" | "loading" | "success" | "error" | "cooldown";

export function SyncButton() {
  const router = useRouter();
  const [state, setState] = useState<SyncState>("idle");

  async function refreshManuals() {
    setState("loading");
    try {
      const response = await fetch("/api/manuals/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.status === 429) {
        setState("cooldown");
        return;
      }
      if (!response.ok) {
        setState("error");
        return;
      }

      setState("success");
      router.refresh();
      window.setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("error");
    }
  }

  const message = {
    idle: "",
    loading: "Notionから最新情報を取得中です。",
    success: "最新の内容に更新しました。",
    error: "更新できませんでした。現在の内容を表示します。",
    cooldown: "少し時間を置いてから、もう一度お試しください。",
  }[state];

  return (
    <div className="sync-control">
      <button type="button" onClick={refreshManuals} disabled={state === "loading"}>
        {state === "loading" ? "更新中…" : "更新を確認"}
      </button>
      <span aria-live="polite">{message}</span>
    </div>
  );
}
