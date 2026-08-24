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
    const blockIds = new Set<string>();
    const slugs = new Set<string>();

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

    const fetchPage = async (
      pageId: string,
      fallbackTitle: string,
      parent?: ManualPage,
      depth = 0,
    ): Promise<ManualPage | undefined> => {
      if (depth > this.maxDepth || pageIds.has(pageId)) return undefined;
      pageIds.add(pageId);
      const rawPage = await this.gateway.retrievePage(pageId);
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

      for (const rawBlock of rawBlocks) {
        if (rawBlock.type === "child_page" && typeof rawBlock.id === "string") {
          const childPage = await fetchPage(rawBlock.id, blockTitle(rawBlock), manualPage, depth + 1);
          const childBlock = blocks.find((block) => block.id === rawBlock.id && block.type === "child_page");
          if (childPage && childBlock?.type === "child_page") childBlock.slug = childPage.slug;
        }
      }
      return manualPage;
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
      if (rawBlock.has_children === true && type !== "child_page") {
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
