import type { ReactNode } from "react";
import type { ManualRichText as ManualRichTextValue } from "@/src/types/manual";

const NOTION_COLORS = new Set([
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
  "gray_background",
  "brown_background",
  "orange_background",
  "yellow_background",
  "green_background",
  "blue_background",
  "purple_background",
  "pink_background",
  "red_background",
]);

function safeHref(href?: string): string | undefined {
  if (!href) return undefined;
  if (href.startsWith("/")) return href;
  try {
    const url = new URL(href);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? href : undefined;
  } catch {
    return undefined;
  }
}

function StyledText({ value }: { value: ManualRichTextValue }) {
  let content: ReactNode = value.text;
  if (value.style.code) content = <code>{content}</code>;
  if (value.style.bold) content = <strong>{content}</strong>;
  if (value.style.italic) content = <em>{content}</em>;
  if (value.style.underline) content = <u>{content}</u>;
  if (value.style.strikethrough) content = <s>{content}</s>;

  const href = safeHref(value.href);
  if (href) {
    content = (
      <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
        {content}
      </a>
    );
  }

  const color = NOTION_COLORS.has(value.style.color) ? value.style.color : "default";
  return <span className={`notion-color notion-color--${color}`}>{content}</span>;
}

export function ManualRichText({ value }: { value: ManualRichTextValue[] }) {
  return value.map((part, index) => <StyledText value={part} key={`${index}-${part.text}`} />);
}

export function richTextPlain(value: ManualRichTextValue[]): string {
  return value.map((part) => part.text).join("");
}
