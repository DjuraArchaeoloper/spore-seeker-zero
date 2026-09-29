import type { ReactNode } from "react";
import Link from "next/link";
import { SPORE_WEB_BACKGROUNDS } from "@spore/shared/web-assets";
import { SiteFooter } from "./SiteFooter";
import type { LegalDocument } from "./legalDocuments";

type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; items: string[] };

export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  const blocks = parseMarkdown(document.markdown);

  return (
    <div className="legalPageRoot">
      <div className="atmosphere" aria-hidden="true">
        <picture className="atmospherePicture">
          <source
            media="(max-width: 900px) and (orientation: portrait)"
            srcSet={SPORE_WEB_BACKGROUNDS.mobile.src}
          />
          <source
            media="(max-width: 760px)"
            srcSet={SPORE_WEB_BACKGROUNDS.mobile.src}
          />
          <img
            className="atmosphereImage"
            src={SPORE_WEB_BACKGROUNDS.desktop.src}
            alt=""
            decoding="async"
            height={SPORE_WEB_BACKGROUNDS.desktop.height}
            width={SPORE_WEB_BACKGROUNDS.desktop.width}
          />
        </picture>
        <div className="atmosphereVeil" />
      </div>

      <header className="masthead" aria-label="SPØR">
        <Link href="/">SPØR</Link>
        <i aria-hidden="true" />
        <span>SEEKER ZERO</span>
      </header>

      <main className="legalShell">
        <article className="legalDocument">{blocks.map(renderBlock)}</article>
      </main>

      <SiteFooter />
    </div>
  );
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.trim().split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  function flushParagraph() {
    if (paragraphLines.length > 0) {
      blocks.push({ type: "paragraph", lines: paragraphLines });
      paragraphLines = [];
    }
  }

  function flushList() {
    if (listItems.length > 0) {
      blocks.push({ type: "list", items: listItems });
      listItems = [];
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);

    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2],
      });
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      listItems.push(trimmed.slice(2));
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();

  return blocks;
}

function renderBlock(block: MarkdownBlock, index: number) {
  if (block.type === "heading") {
    const id = headingId(block.text);

    if (block.level === 1) {
      return (
        <h1 id={id} key={`${id}-${index}`}>
          {renderInline(block.text)}
        </h1>
      );
    }

    if (block.level === 2) {
      return (
        <h2 id={id} key={`${id}-${index}`}>
          {renderInline(block.text)}
        </h2>
      );
    }

    return (
      <h3 id={id} key={`${id}-${index}`}>
        {renderInline(block.text)}
      </h3>
    );
  }

  if (block.type === "list") {
    return (
      <ul key={`list-${index}`}>
        {block.items.map((item, itemIndex) => (
          <li key={`${item}-${itemIndex}`}>{renderInline(item)}</li>
        ))}
      </ul>
    );
  }

  return (
    <p key={`paragraph-${index}`}>
      {block.lines.map((line, lineIndex) => (
        <FragmentWithBreak
          key={`${line}-${lineIndex}`}
          addBreak={lineIndex < block.lines.length - 1}
        >
          {renderInline(line)}
        </FragmentWithBreak>
      ))}
    </p>
  );
}

function FragmentWithBreak({
  addBreak,
  children,
}: {
  addBreak: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {children}
      {addBreak ? <br /> : null}
    </>
  );
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    nodes.push(<strong key={`${match[1]}-${match.index}`}>{match[1]}</strong>);
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

function headingId(text: string) {
  return text
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
