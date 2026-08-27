"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function RetryButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
    >
      {isPending ? "再試行中…" : "もう一度試す"}
    </button>
  );
}
