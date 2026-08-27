import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ManualArticle } from "@/src/components/manual-article";
import { ManualUnavailable, StaleWarning } from "@/src/components/manual-state";
import { pageBySlug, pageNavigation } from "@/src/lib/manuals/presentation";
import { loadManualSnapshot } from "@/src/lib/manuals/server";

export const dynamic = "force-dynamic";

type ManualPageProps = { params: Promise<{ slug: string }> };

const loadManualPage = cache(async (slug: string) => {
  const loaded = await loadManualSnapshot();
  if (!loaded.ok) return { ok: false as const };
  const { snapshot, source } = loaded.data;
  const page = pageBySlug(snapshot, slug);
  return {
    ok: true as const,
    page,
    source,
    navigation: page ? pageNavigation(snapshot, page) : undefined,
    syncedAt: snapshot.syncedAt,
  };
});

export async function generateMetadata({ params }: ManualPageProps): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadManualPage(slug);
  return {
    title: loaded.ok && loaded.page ? loaded.page.title : "マニュアル",
  };
}

export default async function ManualPage({ params }: ManualPageProps) {
  const { slug } = await params;
  const loaded = await loadManualPage(slug);
  if (!loaded.ok) return <div className="page-container page-container--state"><ManualUnavailable /></div>;
  if (!loaded.page || !loaded.navigation) notFound();
  return (
    <>
      {loaded.source === "stale" ? <StaleWarning syncedAt={loaded.syncedAt} /> : null}
      <ManualArticle
        page={loaded.page}
        previous={loaded.navigation.previous}
        next={loaded.navigation.next}
      />
    </>
  );
}
