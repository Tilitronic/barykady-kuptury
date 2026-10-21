import { Fragment, h, type VNode } from "vue";

import { isSafeHref } from "@/features/reader/safeHref";
import type {
  ReaderBlock,
  ReaderDocumentV1,
  ReaderInline,
  ReaderTableCell
} from "@/features/reader/types";

/**
 * AST v1 → VNode renderer (T-040, D-32/D-36/D-37).
 *
 * The client twin of the DB validator: it renders ONLY the documented node
 * kinds and ignores anything else, so even a row written before a future
 * schema change cannot smuggle markup. No `v-html` anywhere — every node
 * becomes an element with text children, exactly the guarantee the legacy
 * `richText.ts` path gives for plain Markdown.
 *
 * Link schemes are re-filtered client-side (http/https/mailto): the DB is the
 * authority on write, but a stale bundle must still render `javascript:` as
 * inert text (defense in depth). The predicate is shared with the T-041 import
 * converter (`features/reader/safeHref`) so the two cannot drift.
 *
 * Heading ids are positional (`ast-heading-<blockIndex>`): stable for a given
 * stored AST version, and the only contract the TOC and deep links need —
 * slugifying localized heading text would make anchors locale-dependent.
 */

export interface ResolvedAsset {
  readonly url: string;
  readonly width: number;
  readonly height: number;
}

export interface AstRenderContext {
  /** Resolves an AST `assetId` to a public URL + dimensions, or `null`. */
  readonly assetUrl: (assetId: string) => ResolvedAsset | null;
  /** Localized suffix for external links opening a new tab. */
  readonly newTabLabel?: string | undefined;
  /** Language of `newTabLabel` for the visually-hidden suffix. */
  readonly labelLang?: string | undefined;
}

/** Flattens inline nodes to plain text (TOC labels, aria helpers). */
export function astInlineText(nodes: readonly ReaderInline[]): string {
  return nodes
    .map(node => {
      if (node.kind === "text" || node.kind === "inlineCode") return node.value;
      if (node.kind === "link") return astInlineText(node.children);
      if (node.kind === "span") return astInlineText(node.children);
      if ("children" in node) return astInlineText(node.children);
      return "";
    })
    .join("");
}

export interface AstHeadingItem {
  readonly id: string;
  readonly level: 2 | 3 | 4;
  readonly label: string;
}

/** TOC items from AST headings, in document order, with positional ids. */
export function astHeadingItems(
  document: ReaderDocumentV1 | null
): AstHeadingItem[] {
  if (!document) return [];

  const items: AstHeadingItem[] = [];
  document.blocks.forEach((block, index) => {
    if (block.kind === "heading") {
      items.push({
        id: `ast-heading-${index}`,
        level: block.level,
        label: astInlineText(block.children)
      });
    }
  });
  return items;
}

function renderInline(
  nodes: readonly ReaderInline[],
  ctx: AstRenderContext
): (string | VNode)[] {
  return nodes.map(node => {
    switch (node.kind) {
      case "text":
        return node.value;
      case "strong":
        return h("strong", {}, renderInline(node.children, ctx));
      case "emphasis":
        return h("em", {}, renderInline(node.children, ctx));
      case "inlineCode":
        return h("code", {}, node.value);
      case "sup":
        return h("sup", {}, renderInline(node.children, ctx));
      case "sub":
        return h("sub", {}, renderInline(node.children, ctx));
      case "span":
        return h(
          "span",
          node.lang ? { lang: node.lang } : {},
          renderInline(node.children, ctx)
        );
      case "link": {
        if (!isSafeHref(node.href)) {
          // Unsafe scheme: render the label as inert text, never an anchor.
          return h(Fragment, {}, renderInline(node.children, ctx));
        }
        const isExternal = /^https?:\/\//i.test(node.href);
        const children = renderInline(node.children, ctx);
        if (isExternal && ctx.newTabLabel) {
          children.push(
            h(
              "span",
              { class: "visually-hidden", lang: ctx.labelLang },
              ` (${ctx.newTabLabel})`
            )
          );
        }
        return h(
          "a",
          {
            href: node.href,
            rel: "noopener noreferrer",
            ...(isExternal ? { target: "_blank" } : {})
          },
          children
        );
      }
      default:
        return "";
    }
  });
}

function renderCell(cell: ReaderTableCell, ctx: AstRenderContext): VNode {
  const tag = cell.header ? "th" : "td";
  return h(
    tag,
    {
      ...(cell.header && cell.scope ? { scope: cell.scope } : {}),
      ...(cell.colspan ? { colspan: cell.colspan } : {}),
      ...(cell.rowspan ? { rowspan: cell.rowspan } : {})
    },
    renderInline(cell.children, ctx)
  );
}

function renderBlock(
  block: ReaderBlock,
  index: number,
  ctx: AstRenderContext
): VNode | null {
  switch (block.kind) {
    case "heading": {
      const tag = `h${block.level}`;
      return h(
        tag,
        { id: `ast-heading-${index}`, tabindex: -1 },
        renderInline(block.children, ctx)
      );
    }
    case "paragraph":
      return h("p", {}, renderInline(block.children, ctx));
    case "list":
      return h(
        block.ordered ? "ol" : "ul",
        {},
        block.items.map(item => h("li", {}, renderInline(item.children, ctx)))
      );
    case "table": {
      const headerRows = Math.max(0, block.headerRows);
      const head = block.rows.slice(0, headerRows);
      const body = block.rows.slice(headerRows);
      const children: VNode[] = [];
      if (block.caption) children.push(h("caption", {}, block.caption));
      if (head.length > 0) {
        children.push(
          h(
            "thead",
            {},
            head.map(row =>
              h(
                "tr",
                {},
                row.map(cell => renderCell(cell, ctx))
              )
            )
          )
        );
      }
      if (body.length > 0) {
        children.push(
          h(
            "tbody",
            {},
            body.map(row =>
              h(
                "tr",
                {},
                row.map(cell => renderCell(cell, ctx))
              )
            )
          )
        );
      }
      return h("table", {}, children);
    }
    case "image": {
      const asset = ctx.assetUrl(block.assetId);
      if (!asset) return null; // unknown asset: omit, never a placeholder.
      const img = h("img", {
        src: asset.url,
        alt: block.decorative ? "" : block.alt,
        ...(block.decorative ? { "aria-hidden": "true" } : {}),
        loading: "lazy",
        width: asset.width,
        height: asset.height
      });
      const parts: VNode[] = [img];
      if (block.caption) parts.push(h("figcaption", {}, block.caption));
      return h("figure", { class: "reader-figure" }, parts);
    }
    case "blockquote":
      return h("blockquote", {}, renderAstBlocks(block.children, ctx));
    case "code":
      return h(
        "pre",
        {},
        h("code", block.language ? { lang: block.language } : {}, block.value)
      );
    case "footnote":
      // A div, not an <aside>: repeated unnamed complementary landmarks
      // fragment the AT landmark list (rev-1 F).
      return h("div", { class: "reader-footnote" }, [
        h("span", { class: "reader-footnote__label" }, `${block.label} `),
        ...renderInline(block.children, ctx)
      ]);
    case "divider":
      return h("hr");
    default:
      return null;
  }
}

/** Renders AST blocks; unknown kinds are skipped, never guessed at. */
export function renderAstBlocks(
  blocks: readonly ReaderBlock[],
  ctx: AstRenderContext
): VNode[] {
  return blocks
    .map((block, index) => renderBlock(block, index, ctx))
    .filter((node): node is VNode => node !== null);
}

/** Convenience wrapper for a whole document. */
export function renderAstDocument(
  document: ReaderDocumentV1,
  ctx: AstRenderContext
): VNode[] {
  return renderAstBlocks(document.blocks, ctx);
}
