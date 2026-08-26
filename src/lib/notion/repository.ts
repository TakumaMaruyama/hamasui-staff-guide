import type { ManualBlock, ManualBreadcrumb, ManualPage, ManualSnapshot } from "@/src/types/manual";
import { ManualSnapshotCache, type CachedManualSnapshot } from "./cache";
import { type NotionGateway, NotionSdkGateway, type NotionRecord } from "./gateway";
import { blockFromNotion, blockTitle, createSlug, pageFromBlocks, richTextFromNotion, richTextToPlainText } from "./transform";

const DEFAULT_MAX_DEPTH = 12;

export type NotionManualRepositoryOptions = {
  gateway: NotionGateway;
  rootPageId: string;
  cache?: ManualSnapshotCache;
  maxDepth?: number;
  now?: () => Date;
};

export class NotionManualRepository {
  private readonly gateway: NotionGateway;
  private readonly rootPageId: string;
  private readonly cache: ManualSnapshotCache;
  private readonly maxDepth: number;
  private readonly now: () => Date;

  constructor({ gateway, rootPageId, cache = new ManualSnapshotCache(), maxDepth = DEFAULT_MAX_DEPTH, now = () => new Date() }: NotionManualRepositoryOptions) {
    this.gateway = gateway;
    this.rootPageId = rootPageId;
    this.cache = cache;
    this.maxDepth = maxDepth;
    this.now = now;
  }

  getSnapshot(force = false): Promise<CachedManualSnapshot> {
    return this.cache.get(() => this.fetchSnapshot(), force);
  }

  private async fetchSnapshot(): Promise<ManualSnapshot> {
    const pages: ManualPage[] = [];
    const pageIds = new Set<string>();
    const pagesById = new Map<string, ManualPage>();
    const blockIds = new Set<string>();
    const slugs = new Set<string>();
    const databaseRowRequests = new Map<string, Promise<NotionRecord[]>>();

    const uniqueSlug = (title: string, id: string) => {
      const base = createSlug(title, id);
      if (!slugs.has(base)) {
        slugs.add(base);
        return base;
      }
      const unique = `${base}-${id.replace(/[^a-zA-Z0-9]/g, "").slice(-8) || "page"}`;
      slugs.add(unique);
      return unique;
    };

    const listAllChildren = async (id: string): Promise<NotionRecord[]> => {
      const blocks: NotionRecord[] = [];
      let cursor: string | undefined;
      do {
        const page = await this.gateway.listBlockChildren(id, cursor);
        blocks.push(...page.results);
        cursor = page.hasMore ? page.nextCursor : undefined;
      } while (cursor);
      return blocks;
    };

    const pageTitle = (page: NotionRecord, fallback: string) => {
      const properties = page.properties && typeof page.properties === "object" ? (page.properties as NotionRecord) : {};
      for (const property of Object.values(properties)) {
        const source = property && typeof property === "object" ? (property as NotionRecord) : {};
        if (source.type === "title") {
          const title = richTextToPlainText(richTextFromNotion(source.title));
          if (title) return title;
        }
      }
      return fallback;
    };

    const listDatabaseRows = (databaseId: string): Promise<NotionRecord[]> => {
      const pending = databaseRowRequests.get(databaseId);
      if (pending) return pending;

      const request = (async () => {
        const database = await this.gateway.retrieveDatabase(databaseId);
        const dataSources = Array.isArray(database.data_sources) ? database.data_sources : [];
        const dataSourceIds = new Set<string>();
        const rowIds = new Set<string>();
        const rows: NotionRecord[] = [];

        for (const value of dataSources) {
          const source = value && typeof value === "object" ? (value as NotionRecord) : {};
          if (typeof source.id !== "string" || dataSourceIds.has(source.id)) continue;
          dataSourceIds.add(source.id);

          let cursor: string | undefined;
          do {
            const result = await this.gateway.queryDataSource(source.id, cursor);
            for (const row of result.results) {
              if (row.object !== "page" || typeof row.id !== "string" || rowIds.has(row.id)) continue;
              rowIds.add(row.id);
              rows.push(row);
            }
            cursor = result.hasMore ? result.nextCursor : undefined;
          } while (cursor);
        }
        return rows;
      })();

      databaseRowRequests.set(databaseId, request);
      return request;
    };

    const fetchPage = async (
      pageId: string,
      fallbackTitle: string,
      parent?: ManualPage,
      depth = 0,
      retrievedPage?: NotionRecord,
    ): Promise<ManualPage | undefined> => {
      if (depth > this.maxDepth) return undefined;
      const existingPage = pagesById.get(pageId);
      if (existingPage) return existingPage;
      if (pageIds.has(pageId)) return undefined;
      pageIds.add(pageId);
      const rawPage = retrievedPage ?? await this.gateway.retrievePage(pageId);
      const title = pageTitle(rawPage, fallbackTitle || "無題のマニュアル");
      const slug = uniqueSlug(title, pageId);
      const breadcrumbs: ManualBreadcrumb[] = parent ? [...parent.breadcrumbs, { id: parent.id, title: parent.title, slug: parent.slug }] : [];

      const rawBlocks = await listAllChildren(pageId);
      const blocks: ManualBlock[] = [];
      for (const rawBlock of rawBlocks) {
        blocks.push(await fetchBlock(rawBlock, depth + 1, new Set()));
      }

      const manualPage = pageFromBlocks({
        id: pageId,
        title,
        slug,
        ...(parent ? { parentId: parent.id } : {}),
        breadcrumbs,
        blocks,
        ...(typeof rawPage.last_edited_time === "string" ? { lastEditedTime: rawPage.last_edited_time } : {}),
      });
      pages.push(manualPage);
      pagesById.set(pageId, manualPage);
      await attachLinkedPages(blocks, manualPage, depth);
      return manualPage;
    };

    const attachLinkedPages = async (
      blocks: ManualBlock[],
      parent: ManualPage,
      depth: number,
    ): Promise<void> => {
      for (const block of blocks) {
        if (block.type === "child_page") {
          const childPage = await fetchPage(block.pageId, block.title, parent, depth + 1);
          if (childPage) block.slug = childPage.slug;
          continue;
        }

        if (block.type === "child_database") {
          let rows: NotionRecord[];
          try {
            rows = await listDatabaseRows(block.id);
          } catch {
            // A database that is not shared with the integration remains available in Notion.
            continue;
          }

          block.isLoaded = true;
          for (const row of rows) {
            if (typeof row.id !== "string") continue;
            try {
              const childPage = await fetchPage(
                row.id,
                pageTitle(row, "無題のマニュアル"),
                parent,
                depth + 1,
                row,
              );
              if (!childPage) continue;
              block.children.push({
                id: childPage.id,
                children: [],
                type: "child_page",
                title: childPage.title,
                pageId: childPage.id,
                slug: childPage.slug,
              });
            } catch {
              // Keep other readable rows available when one page is not shared.
            }
          }
          continue;
        }

        await attachLinkedPages(block.children, parent, depth + 1);
      }
    };

    const fetchBlock = async (rawBlock: NotionRecord, depth: number, ancestry: Set<string>): Promise<ManualBlock> => {
      const id = typeof rawBlock.id === "string" ? rawBlock.id : "unknown-block";
      const type = typeof rawBlock.type === "string" ? rawBlock.type : "unknown";
      const childPageSlug = type === "child_page" ? createSlug(blockTitle(rawBlock), id) : undefined;
      if (depth > this.maxDepth || ancestry.has(id) || blockIds.has(id)) {
        return blockFromNotion(rawBlock, [], childPageSlug);
      }
      blockIds.add(id);
      const nextAncestry = new Set(ancestry).add(id);
      let children: ManualBlock[] = [];
      if (
        rawBlock.has_children === true &&
        type !== "child_page" &&
        type !== "child_database"
      ) {
        const rawChildren = await listAllChildren(id);
        children = await Promise.all(rawChildren.map((child) => fetchBlock(child, depth + 1, nextAncestry)));
      }
      return blockFromNotion(rawBlock, children, childPageSlug);
    };

    const root = await fetchPage(this.rootPageId, "スタッフマニュアル");
    if (!root) throw new Error("Unable to build the Notion root page");
    return { rootPageId: this.rootPageId, pages, syncedAt: this.now().toISOString() };
  }
}

let defaultRepository: NotionManualRepository | undefined;

/** Server entry point. Tokens stay in this module and are never returned. */
export function getManualRepository(): NotionManualRepository {
  if (defaultRepository) return defaultRepository;
  const token = process.env.NOTION_TOKEN;
  const rootPageId = process.env.NOTION_ROOT_PAGE_ID;
  if (!token || !rootPageId) throw new Error("Notion is not configured");
  defaultRepository = new NotionManualRepository({ gateway: new NotionSdkGateway({ token }), rootPageId });
  return defaultRepository;
}
