import type { Metadata } from "next";
import { ManualArticle } from "@/src/components/manual-article";
import { ManualUnavailable, StaleWarning } from "@/src/components/manual-state";
import { emergencyLinks, emergencyPage } from "@/src/lib/manuals/field-navigation";
import { loadManualSnapshot } from "@/src/lib/manuals/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "安全・緊急対応" };

export default async function EmergencyPage() {
  const result = await loadManualSnapshot();
  if (!result.ok) return <div className="page-container page-container--state"><ManualUnavailable /></div>;
  const { snapshot, source, warning } = result.data;
  const page = emergencyPage(snapshot);
  if (!page) return <div className="page-container standard-page"><p className="empty-state">「緊急時対応」マニュアルが見つかりません。</p></div>;
  const links = emergencyLinks(page);
  return (
    <>
      {source === "stale" || warning === "stale-fallback" ? <StaleWarning syncedAt={snapshot.syncedAt} /> : null}
      <ManualArticle
        page={page}
        tone="emergency"
        quickLinks={links.map((link) => ({
          label: link.label,
          ...(link.href !== "#" ? { href: link.href } : {}),
        }))}
      />
    </>
  );
}
