/**
 * UI-safe manual data.  These types deliberately do not expose Notion SDK
 * objects so that credentials and provider-only fields cannot leak to clients.
 */
export type ManualTextStyle = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  code: boolean;
  color: string;
};

export type ManualRichText = {
  text: string;
  href?: string;
  style: ManualTextStyle;
};

export type ManualBreadcrumb = {
  id: string;
  title: string;
  slug: string;
};

export type ManualMedia = {
  url?: string;
  name?: string;
  caption: ManualRichText[];
};

type ManualBlockBase = {
  id: string;
  children: ManualBlock[];
};

type ManualTextBlockType =
  | "paragraph"
  | "bulleted_list_item"
  | "numbered_list_item"
  | "toggle"
  | "quote";

export type ManualTextBlock = ManualBlockBase & {
  type: ManualTextBlockType;
  richText: ManualRichText[];
  color?: string;
};

export type ManualHeadingBlock = ManualBlockBase & {
  type: "heading_1" | "heading_2" | "heading_3";
  richText: ManualRichText[];
  color?: string;
  isToggleable: boolean;
};

export type ManualTodoBlock = ManualBlockBase & {
  type: "to_do";
  richText: ManualRichText[];
  checked: boolean;
  color?: string;
};

export type ManualCalloutBlock = ManualBlockBase & {
  type: "callout";
  richText: ManualRichText[];
  color?: string;
  icon?: string;
};

export type ManualDividerBlock = ManualBlockBase & { type: "divider" };

export type ManualMediaBlock = ManualBlockBase & {
  type: "image" | "video" | "file" | "pdf";
  media: ManualMedia;
};

export type ManualLinkBlock = ManualBlockBase & {
  type: "bookmark";
  url?: string;
  caption: ManualRichText[];
};

export type ManualCodeBlock = ManualBlockBase & {
  type: "code";
  richText: ManualRichText[];
  caption: ManualRichText[];
  language?: string;
};

export type ManualTableBlock = ManualBlockBase & {
  type: "table";
  width: number;
  hasColumnHeader: boolean;
  hasRowHeader: boolean;
};

export type ManualTableRowBlock = ManualBlockBase & {
  type: "table_row";
  cells: ManualRichText[][];
};

export type ManualContainerBlock = ManualBlockBase & {
  type: "column_list" | "column" | "synced_block";
};

export type ManualChildPageBlock = ManualBlockBase & {
  type: "child_page";
  title: string;
  pageId: string;
  slug: string;
};

export type ManualChildDatabaseBlock = ManualBlockBase & {
  type: "child_database";
  title: string;
  isLoaded: boolean;
};

export type ManualUnsupportedBlock = ManualBlockBase & {
  type: "unsupported";
  originalType: string;
};

export type ManualBlock =
  | ManualTextBlock
  | ManualHeadingBlock
  | ManualTodoBlock
  | ManualCalloutBlock
  | ManualDividerBlock
  | ManualMediaBlock
  | ManualLinkBlock
  | ManualCodeBlock
  | ManualTableBlock
  | ManualTableRowBlock
  | ManualContainerBlock
  | ManualChildPageBlock
  | ManualChildDatabaseBlock
  | ManualUnsupportedBlock;

export type ManualHeading = {
  id: string;
  text: string;
  level: 1 | 2 | 3;
};

export type ManualPage = {
  id: string;
  title: string;
  slug: string;
  parentId?: string;
  breadcrumbs: ManualBreadcrumb[];
  plainText: string;
  headings: ManualHeading[];
  blocks: ManualBlock[];
  lastEditedTime?: string;
};

export type ManualSnapshot = {
  rootPageId: string;
  pages: ManualPage[];
  syncedAt: string;
};
