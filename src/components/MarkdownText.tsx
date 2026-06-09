import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\$[^$]+\$)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded border border-surface-border bg-background/70 px-1 py-0.5 font-mono text-[0.92em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("$") && part.endsWith("$")) {
      return (
        <span key={index} className="font-mono text-[0.95em] text-[#4FC4CF]">
          {part.slice(1, -1)}
        </span>
      );
    }
    return part;
  });
}

function flushList(items: ReactNode[], ordered: boolean, key: string): ReactNode | null {
  if (items.length === 0) return null;
  const List = ordered ? "ol" : "ul";
  return (
    <List
      key={key}
      className={
        ordered
          ? "ml-5 list-decimal space-y-1.5 marker:text-muted-foreground"
          : "ml-5 list-disc space-y-1.5 marker:text-muted-foreground"
      }
    >
      {items}
    </List>
  );
}

export function MarkdownText({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let listItems: ReactNode[] = [];
  let orderedList = false;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const textBlock = paragraph.join(" ").trim();
    if (textBlock) {
      blocks.push(<p key={`p-${blocks.length}`}>{renderInline(textBlock)}</p>);
    }
    paragraph = [];
  };

  const flushCurrentList = () => {
    const list = flushList(listItems, orderedList, `list-${blocks.length}`);
    if (list) blocks.push(list);
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushCurrentList();
      continue;
    }

    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushCurrentList();
      blocks.push(
        <h4 key={`h-${blocks.length}`} className="font-semibold text-foreground">
          {renderInline(heading[2])}
        </h4>,
      );
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      if (listItems.length > 0 && orderedList !== isOrdered) flushCurrentList();
      orderedList = isOrdered;
      listItems.push(
        <li key={`li-${blocks.length}-${listItems.length}`}>
          {renderInline((ordered?.[1] || unordered?.[1] || "").trim())}
        </li>,
      );
      continue;
    }

    flushCurrentList();
    paragraph.push(line);
  }

  flushParagraph();
  flushCurrentList();

  return <div className={`space-y-3 ${className}`}>{blocks}</div>;
}
