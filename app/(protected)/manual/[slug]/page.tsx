import { notFound } from "next/navigation";
import { ManualArticle } from "@/src/components/manual-article";
import { ManualUnavailable, StaleWarning } from "@/src/components/manual-state";
import { pageBySlug, pageNavigation } from "@/src/lib/manuals/presentation";
import { loadManualSnapshot } from "@/src/lib/manuals/server";

export const dynamic = "force-dynamic";

type ManualPageProps = { params: Promise<{ slug: string }> };

export default async function ManualPage({ params }: ManualPageProps) {
  const { slug } = await params;
  const loaded = await loadManualSnapshot();
  if (!loaded.ok) return <div className="page-container page-container--state"><ManualUnavailable /></div>;
  const { snapshot, source } = loaded.data;
  const page = pageBySlug(snapshot, slug);
  if (!page) notFound();
  const navigation = pageNavigation(snapshot, page);
  return (
    <>
      {source === "stale" ? <StaleWarning syncedAt={snapshot.syncedAt} /> : null}
      <ManualArticle page={page} previous={navigation.previous} next={navigation.next} />
    </>
  );
}
