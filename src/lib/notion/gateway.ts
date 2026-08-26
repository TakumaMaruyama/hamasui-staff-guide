import { Client } from "@notionhq/client";
import { withNotionRetry } from "./retry";

export type NotionRecord = Record<string, unknown>;

export type NotionChildrenPage = {
  results: NotionRecord[];
  hasMore: boolean;
  nextCursor?: string;
};

/** A small provider boundary; tests and future providers can replace the SDK. */
export interface NotionGateway {
  retrievePage(pageId: string): Promise<NotionRecord>;
  listBlockChildren(pageId: string, cursor?: string): Promise<NotionChildrenPage>;
  retrieveDatabase(databaseId: string): Promise<NotionRecord>;
  queryDataSource(dataSourceId: string, cursor?: string): Promise<NotionChildrenPage>;
}

export type NotionGatewayOptions = {
  token: string;
  timeoutMs?: number;
};

/**
 * Official SDK adapter. It is constructed only by server-side repository code;
 * callers receive converted ManualPage values, never this client or its token.
 */
export class NotionSdkGateway implements NotionGateway {
  private readonly client: Client;

  constructor({ token, timeoutMs = 12_000 }: NotionGatewayOptions) {
    this.client = new Client({
      auth: token,
      timeoutMs,
      // Retry is bounded in this provider boundary so every gateway remains testable.
      retry: false,
    });
  }

  async retrievePage(pageId: string): Promise<NotionRecord> {
    return withNotionRetry(async () => (await this.client.pages.retrieve({ page_id: pageId })) as unknown as NotionRecord);
  }

  async listBlockChildren(pageId: string, cursor?: string): Promise<NotionChildrenPage> {
    const response = await withNotionRetry(() => this.client.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    }));

    return {
      results: response.results as unknown as NotionRecord[],
      hasMore: response.has_more,
      nextCursor: response.next_cursor ?? undefined,
    };
  }

  async retrieveDatabase(databaseId: string): Promise<NotionRecord> {
    return withNotionRetry(async () => (
      await this.client.databases.retrieve({ database_id: databaseId })
    ) as unknown as NotionRecord);
  }

  async queryDataSource(dataSourceId: string, cursor?: string): Promise<NotionChildrenPage> {
    const response = await withNotionRetry(() => this.client.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
      result_type: "page",
    }));

    return {
      results: response.results as unknown as NotionRecord[],
      hasMore: response.has_more,
      nextCursor: response.next_cursor ?? undefined,
    };
  }
}
