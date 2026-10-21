import type {
  Blockquote,
  Code,
  Definition,
  FootnoteDefinition,
  Heading,
  Image,
  ImageReference,
  List,
  ListItem,
  Paragraph,
  PhrasingContent,
  Root,
  RootContent,
  Table,
  TableCell as MdastTableCell,
  TableRow
} from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { isSafeHref } from "../reader/safeHref";
import type {
  ReaderBlock,
  ReaderDocumentV1,
  ReaderImageBlock,
  ReaderInline,
  ReaderListItem,
  ReaderTableBlock,
  ReaderTableCell
} from "../reader/types";

import type { ConversionResult, ImportIssue } from "./types";

/**
 * T-041 S2 — Markdown/GFM → ReaderDocument v1.
 *
 * Design authority:
 * - D-32: mdast is an import-time format only; the storage contract is the
 *   project-owned v1 AST.
 * - T-041 §Conversion pipeline: unified + remark-parse + remark-gfm, drop
 *   mdast `html` nodes, no marked/markdown-it HTML-string pipeline.
 * - D-37 / reader_ast.sql: node/prop allowlists, heading levels 2–4, link
 *   schemes, table semantics, image alt rules.
 *
 * Image policy (D-36): the AST stores `assetId`, never a URL. Markdown that
 * already points at Supabase Storage needs the later upload/persistence seam
 * to translate the URL to a `content_assets.id`, so this converter exposes an
 * injectable `resolveAssetId`. Without a resolver every image is removed:
 * remote URLs get an explicit warning (no hotlinking/tracking pixels), and
 * other URLs are reported as unresolved. No URL ever reaches the AST.
 *
 * Raw HTML is dropped rather than sanitized-and-rendered: mdast gives us a
 * structural tree for everything else, and the renderer must never receive
 * HTML strings.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MarkdownConversionOptions {
  /**
   * Maps an image URL (for example a Supabase Storage public URL) to an
   * existing `content_assets.id`. Returning `null` removes the image with a
   * warning. This seam keeps URL resolution out of the pure converter.
   */
  readonly resolveAssetId?: (url: string) => string | null;
}

interface MarkdownContext extends MarkdownConversionOptions {
  readonly definitions: ReadonlyMap<string, Definition>;
  readonly issues: ImportIssue[];
}

function addIssue(
  ctx: MarkdownContext,
  code: ImportIssue["code"],
  severity: ImportIssue["severity"],
  detail?: string
): void {
  ctx.issues.push(
    detail === undefined ? { code, severity } : { code, severity, detail }
  );
}

function appendText(nodes: ReaderInline[], value: string): void {
  if (value === "") return;

  const last = nodes[nodes.length - 1];
  if (last?.kind === "text") {
    nodes[nodes.length - 1] = { kind: "text", value: last.value + value };
    return;
  }
  nodes.push({ kind: "text", value });
}

/**
 * The SQL validator requires every text/inlineCode value to be non-blank
 * (`btrim(value) <> ''`). Merge adjacent text first, then drop nodes that are
 * only layout whitespace; this keeps the AST valid without changing words.
 */
function compactInlines(nodes: readonly ReaderInline[]): ReaderInline[] {
  const result: ReaderInline[] = [];

  for (const node of nodes) {
    if (node.kind === "text" && node.value.trim() === "") {
      // Keep a word gap between adjacent inline nodes. The DB rejects a
      // whitespace-only text value (`btrim(value) <> ''`), but a newline is not
      // trimmed by PostgreSQL's default btrim and HTML collapses it to a
      // space, so the rendered words stay separated.
      result.push({ kind: "text", value: "\n" });
      continue;
    }
    result.push(node);
  }

  // A gap at either edge of a block is layout noise, not content.
  while (result.length > 0) {
    const first = result[0]!;
    if (first.kind === "text" && first.value === "\n") result.shift();
    else break;
  }
  while (result.length > 0) {
    const last = result[result.length - 1]!;
    if (last.kind === "text" && last.value === "\n") result.pop();
    else break;
  }

  return result;
}

function definitionKey(identifier: string): string {
  return identifier.toLowerCase();
}

function definitionsOf(nodes: readonly RootContent[]): Map<string, Definition> {
  const definitions = new Map<string, Definition>();
  for (const node of nodes) {
    if (node.type === "definition") {
      definitions.set(definitionKey(node.identifier), node);
    }
  }
  return definitions;
}

function headingLevel(depth: number): 2 | 3 | 4 {
  // The page owns the h1; imported documents start at h2 even when the source
  // starts at h1, and never go below h4 (D-37).
  return Math.min(4, Math.max(2, depth)) as 2 | 3 | 4;
}

function mapImage(
  node: Image | ImageReference,
  ctx: MarkdownContext
): ReaderImageBlock | null {
  let url: string;
  let alt: string;
  let title: string | null | undefined;

  if (node.type === "image") {
    url = node.url;
    alt = node.alt ?? "";
    title = node.title;
  } else {
    const definition = ctx.definitions.get(definitionKey(node.identifier));
    if (!definition) {
      addIssue(ctx, "imageUnresolved", "warning", node.identifier);
      return null;
    }
    url = definition.url;
    alt = node.alt ?? "";
    title = definition.title;
  }

  const resolvedId = ctx.resolveAssetId?.(url) ?? null;
  if (resolvedId === null || !UUID_PATTERN.test(resolvedId)) {
    if (/^https?:\/\//i.test(url)) {
      addIssue(ctx, "remoteImageStripped", "warning", url);
    } else {
      addIssue(ctx, "imageUnresolved", "warning", url);
    }
    return null;
  }

  if (alt.trim() === "") {
    // D-37: a non-decorative image without alt must never reach the DB.
    addIssue(ctx, "imageAltMissing", "blocking", url);
    return null;
  }

  const caption = title?.trim();
  return caption
    ? { kind: "image", assetId: resolvedId, alt, caption }
    : { kind: "image", assetId: resolvedId, alt };
}

function mapInline(
  nodes: readonly PhrasingContent[],
  ctx: MarkdownContext
): ReaderInline[] {
  const output: ReaderInline[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case "text":
        appendText(output, node.value);
        break;
      case "strong": {
        const children = compactInlines(mapInline(node.children, ctx));
        if (children.length > 0) output.push({ kind: "strong", children });
        break;
      }
      case "emphasis": {
        const children = compactInlines(mapInline(node.children, ctx));
        if (children.length > 0) output.push({ kind: "emphasis", children });
        break;
      }
      case "delete": {
        // The v1 AST has no strikethrough node; keep the words, drop the style.
        output.push(...compactInlines(mapInline(node.children, ctx)));
        addIssue(ctx, "unsupportedFormatting", "warning", "delete");
        break;
      }
      case "inlineCode":
        if (node.value.trim() !== "") {
          output.push({ kind: "inlineCode", value: node.value });
        }
        break;
      case "link": {
        const children = compactInlines(mapInline(node.children, ctx));
        if (isSafeHref(node.url)) {
          if (children.length > 0) {
            output.push({ kind: "link", href: node.url, children });
          }
        } else {
          output.push(...children);
          addIssue(ctx, "unsafeLink", "warning", node.url);
        }
        break;
      }
      case "linkReference": {
        const definition = ctx.definitions.get(definitionKey(node.identifier));
        const children = compactInlines(mapInline(node.children, ctx));
        if (definition && isSafeHref(definition.url)) {
          if (children.length > 0) {
            output.push({
              kind: "link",
              href: definition.url,
              children
            });
          }
        } else {
          output.push(...children);
          addIssue(ctx, "unsafeLink", "warning", node.identifier);
        }
        break;
      }
      case "break":
        appendText(output, "\n");
        break;
      case "footnoteReference":
        output.push({
          kind: "sup",
          children: [{ kind: "text", value: node.label ?? node.identifier }]
        });
        break;
      case "html":
        addIssue(ctx, "rawHtmlDropped", "warning");
        break;
      case "image":
      case "imageReference":
        // Images are block nodes in v1; a nested image cannot be represented.
        addIssue(ctx, "imageUnresolved", "warning", node.type);
        break;
      default:
        addIssue(
          ctx,
          "unsupportedFormatting",
          "warning",
          (node as { type: string }).type
        );
        break;
    }
  }

  return output;
}

function mapParagraph(node: Paragraph, ctx: MarkdownContext): ReaderBlock[] {
  const blocks: ReaderBlock[] = [];
  let inlineBuffer: ReaderInline[] = [];

  const flush = (): void => {
    const children = compactInlines(inlineBuffer);
    inlineBuffer = [];
    if (children.length > 0) blocks.push({ kind: "paragraph", children });
  };

  for (const child of node.children) {
    if (child.type === "image" || child.type === "imageReference") {
      flush();
      const image = mapImage(child, ctx);
      if (image) blocks.push(image);
    } else {
      inlineBuffer.push(...mapInline([child], ctx));
    }
  }

  flush();
  return blocks;
}

function itemInlines(item: ListItem, ctx: MarkdownContext): ReaderInline[] {
  const inlines: ReaderInline[] = [];

  for (const child of item.children) {
    if (child.type === "paragraph") {
      inlines.push(...mapInline(child.children, ctx));
    } else if (child.type === "list") {
      // Nested lists are flattened below; their text is not part of this item.
      continue;
    } else if (child.type === "html") {
      addIssue(ctx, "rawHtmlDropped", "warning");
    } else if ("children" in child) {
      // Defensive: unusual block content inside an item is flattened to inline
      // text rather than dropped silently.
      inlines.push(...mapInline(child.children as PhrasingContent[], ctx));
    }
  }

  return compactInlines(inlines);
}

function mapList(node: List, ctx: MarkdownContext): ReaderBlock[] {
  const items: ReaderListItem[] = [];
  const flattenedNested: ReaderBlock[] = [];

  for (const item of node.children) {
    items.push({ children: itemInlines(item, ctx) });
    for (const child of item.children) {
      if (child.type === "list") {
        addIssue(ctx, "nestedListFlattened", "warning");
        flattenedNested.push(...mapList(child, ctx));
      }
    }
  }

  const list: ReaderBlock = {
    kind: "list",
    ordered: node.ordered === true,
    items
  };
  return [list, ...flattenedNested];
}

function mapTableCell(
  cell: MdastTableCell,
  header: boolean,
  ctx: MarkdownContext
): ReaderTableCell {
  return header
    ? {
        header: true,
        scope: "col",
        children: compactInlines(mapInline(cell.children, ctx))
      }
    : {
        header: false,
        children: compactInlines(mapInline(cell.children, ctx))
      };
}

function mapTableRow(
  row: TableRow,
  header: boolean,
  ctx: MarkdownContext
): ReaderTableCell[] {
  return row.children.map(cell => mapTableCell(cell, header, ctx));
}

function mapTable(node: Table, ctx: MarkdownContext): ReaderTableBlock {
  // GFM has no caption/row-header/span syntax; the first row is the header by
  // convention. DOCX (the only source that can carry captions/spans) supplies
  // those through the HAST mapper.
  const rows = node.children.map((row, index) =>
    mapTableRow(row, index === 0, ctx)
  );

  return {
    kind: "table",
    headerRows: rows.length > 0 ? 1 : 0,
    rows
  };
}

function mapFootnote(
  node: FootnoteDefinition,
  ctx: MarkdownContext
): ReaderBlock {
  const children: ReaderInline[] = [];

  for (const child of node.children) {
    if (child.type === "paragraph") {
      if (children.length > 0) appendText(children, "\n");
      children.push(...mapInline(child.children, ctx));
    } else if (child.type === "html") {
      addIssue(ctx, "rawHtmlDropped", "warning");
    }
  }

  return {
    kind: "footnote",
    label: node.label ?? node.identifier,
    children: compactInlines(children)
  };
}

function mapBlock(node: RootContent, ctx: MarkdownContext): ReaderBlock[] {
  switch (node.type) {
    case "heading": {
      const heading = node as Heading;
      return [
        {
          kind: "heading",
          level: headingLevel(heading.depth),
          children: compactInlines(mapInline(heading.children, ctx))
        }
      ];
    }
    case "paragraph":
      return mapParagraph(node, ctx);
    case "list":
      return mapList(node, ctx);
    case "blockquote": {
      const quote = node as Blockquote;
      return [{ kind: "blockquote", children: mapBlocks(quote.children, ctx) }];
    }
    case "code": {
      const code = node as Code;
      const language = code.lang?.trim();
      return [
        language
          ? { kind: "code", value: code.value, language }
          : { kind: "code", value: code.value }
      ];
    }
    case "table":
      return [mapTable(node as Table, ctx)];
    case "thematicBreak":
      return [{ kind: "divider" }];
    case "footnoteDefinition":
      return [mapFootnote(node as FootnoteDefinition, ctx)];
    case "html":
      addIssue(ctx, "rawHtmlDropped", "warning");
      return [];
    case "definition":
    case "yaml":
      // Definitions are consumed by reference lookup; front matter is metadata,
      // not reader content.
      return [];
    default:
      addIssue(ctx, "unsupportedFormatting", "warning", node.type);
      return [];
  }
}

function mapBlocks(
  nodes: readonly RootContent[],
  ctx: MarkdownContext
): ReaderBlock[] {
  return nodes.flatMap(node => mapBlock(node, ctx));
}

function dedupeIssues(issues: readonly ImportIssue[]): ImportIssue[] {
  const seen = new Set<string>();
  return issues.filter(issue => {
    const key = `${issue.code}|${issue.severity}|${issue.detail ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Converts a parsed mdast tree. Exported for tests that want to pin the parse
 * step separately; production callers use `markdownToReaderAst`.
 */
export function mdastToReaderAst(
  tree: Root,
  options: MarkdownConversionOptions = {}
): ConversionResult {
  const ctx: MarkdownContext = {
    ...options,
    definitions: definitionsOf(tree.children),
    issues: []
  };

  const blocks = mapBlocks(tree.children, ctx);
  const issues = dedupeIssues(ctx.issues);
  const ast: ReaderDocumentV1 = { kind: "document", blocks };

  return {
    ast,
    images: [],
    issues,
    publishable: issues.every(issue => issue.severity !== "blocking")
  };
}

/** Parses Markdown/GFM and maps it to the safe ReaderDocument v1 AST. */
export function markdownToReaderAst(
  source: string,
  options: MarkdownConversionOptions = {}
): ConversionResult {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(source) as Root;

  return mdastToReaderAst(tree, options);
}
