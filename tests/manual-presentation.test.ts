import { describe, expect, it } from "vitest";
import { pageBySlug } from "../src/lib/manuals/presentation";
import type { ManualSnapshot } from "../src/types/manual";

const manual = {
  id: "root",
  title: "はまスイ 業務マニュアル",
  slug: "はまスイ-業務マニュアル",
  breadcrumbs: [],
  plainText: "",
  headings: [],
  blocks: [],
};

const snapshot: ManualSnapshot = {
  rootPageId: manual.id,
  pages: [manual],
  syncedAt: "2026-08-26T00:00:00.000Z",
};

describe("manual page lookup", () => {
  it("日本語slugを生値でもURLエンコード値でも解決する", () => {
    expect(pageBySlug(snapshot, manual.slug)).toBe(manual);
    expect(pageBySlug(snapshot, encodeURIComponent(manual.slug))).toBe(manual);
  });

  it("不正なURLエンコード値を例外にせず拒否する", () => {
    expect(pageBySlug(snapshot, "%E0%A4%A")).toBeUndefined();
  });
});
