import Link from "next/link";
import { ManualUnavailable, StaleWarning } from "@/src/components/manual-state";
import { SearchForm } from "@/src/components/search-form";
import { formatDate } from "@/src/lib/manuals/presentation";
import { loadManualSnapshot } from "@/src/lib/manuals/server";
import type { ManualPage } from "@/src/types/manual";

export const dynamic = "force-dynamic";

export default async function ManualsPage() {
  const result = await loadManualSnapshot();
  if (!result.ok) return <div className="page-container page-container--state"><ManualUnavailable /></div>;
  const { snapshot, source } = result.data;
  const root = snapshot.pages.find((page) => page.id === snapshot.rootPageId);
  const childrenByParent = new Map<string, ManualPage[]>();
  for (const page of snapshot.pages) {
    if (!page.parentId) continue;
    const children = childrenByParent.get(page.parentId) ?? [];
    children.push(page);
    childrenByParent.set(page.parentId, children);
  }

  return (
    <div className="page-container standard-page">
      {source === "stale" ? <StaleWarning syncedAt={snapshot.syncedAt} /> : null}
      <header className="standard-page__header">
        <p className="eyebrow">マニュアル一覧</p>
        <h1>すべてのマニュアル</h1>
        <p>Notionの並び順と親子関係を保ったまま表示しています。</p>
      </header>
      <SearchForm compact />
      <div className="manual-tree">
        {root ? <ManualTreeItem page={root} childrenByParent={childrenByParent} depth={0} /> : (
          <p className="empty-state">表示できるマニュアルがありません。</p>
        )}
      </div>
    </div>
  );
}

function ManualTreeItem({
  page,
  childrenByParent,
  depth,
}: {
  page: ManualPage;
  childrenByParent: Map<string, ManualPage[]>;
  depth: number;
}) {
  const children = childrenByParent.get(page.id) ?? [];
  return (
    <div className="manual-tree__branch">
      <Link className="manual-tree__item" href={`/manual/${encodeURIComponent(page.slug)}`} style={{ "--tree-depth": depth } as React.CSSProperties}>
        <span aria-hidden="true">{depth === 0 ? "水" : "└"}</span>
        <span><strong>{page.title}</strong><small>{formatDate(page.lastEditedTime) ?? "更新日不明"}</small></span>
        <span aria-hidden="true">→</span>
      </Link>
      {children.map((child) => (
        <ManualTreeItem key={child.id} page={child} childrenByParent={childrenByParent} depth={depth + 1} />
      ))}
    </div>
  );
}
