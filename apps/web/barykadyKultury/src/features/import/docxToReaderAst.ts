import { defaultSchema, sanitize, type Schema } from "hast-util-sanitize";
import type { Element, Nodes, Properties, Root as HastRoot } from "hast";
import mammoth from "mammoth";
import rehypeParse from "rehype-parse";
import { unified } from "unified";

import { isSafeHref } from "../reader/safeHref";
import type {
  ReaderBlock,
  ReaderDocumentV1,
  ReaderImageBlock,
  ReaderInline,
  ReaderListItem,
  ReaderTableBlock,
  ReaderTableCell,
  ReaderTableScope
} from "../reader/types";

import { ImportConversionError, isImportConversionError } from "./errors";
import { DEFAULT_IMPORT_LIMITS, type ImportLimits } from "./limits";
import type {
  ConversionResult,
  ExtractedImage,
  ImportImageMimeType,
  ImportIssue
} from "./types";
import { inspectDocxZip } from "./zipPreflight";

/**
 * T-041 S2 — DOCX → ReaderDocument v1.
 *
 * Design authority:
 * - D-33: mammoth in a worker; its HTML is parsed with rehype-parse and
 *   sanitized structurally with hast-util-sanitize before mapping. Mammoth is
 *   not a sanitizer.
 * - D-36: images become `content_assets` rows; the AST only stores an assetId.
 *   `convertImage` extracts bytes, checks PNG/JPEG/WebP and assigns a
 *   provisional UUID that the persistence seam inserts with the asset row.
 * - D-37 / reader_ast.sql: heading levels 2–4, link schemes, table caption /
 *   th scope / spans, image alt rules.
 *
 * Why a zip preflight: mammoth must inflate the archive. The central-directory
 * reader rejects zip bombs, macro parts and encrypted/path-traversing entries
 * before that happens (T-041 limits).
 *
 * Why no raw HTML reaches the mapper: the sanitizer runs first, and the mapper
 * understands only the tags in its switch. Anything else is either flattened
 * to safe inline text or dropped with a warning.
 */

const ASSET_SRC_PATTERN = /^asset:([0-9a-f-]{36})$/i;

/**
 * Word style map. Mammoth's defaults already map Heading 1–6; these entries add
 * the document title/subtitle and a caption convention. `Caption` is emitted as
 * `p.import-caption` so the mapper can attach it to the adjacent table/image
 * instead of rendering it as a stray paragraph. Word usually puts captions
 * after the table, so both before/after positions are handled.
 */
const DOCX_STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Heading 5'] => h5:fresh",
  "p[style-name='Heading 6'] => h6:fresh",
  "p[style-name='Caption'] => p.import-caption:fresh"
];

const ALLOWED_TAGS = [
  "a",
  "b",
  "blockquote",
  "br",
  "caption",
  "code",
  "del",
  "div",
  "em",
  "figure",
  "figcaption",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strike",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul"
];

/**
 * Structural allowlist. URLs are reduced to the same schemes as D-37, and the
 * only image source that survives is our `asset:` placeholder; external image
 * URLs are dropped before the mapper can see them.
 */
const IMPORT_SANITIZE_SCHEMA: Schema = {
  ...defaultSchema,
  tagNames: ALLOWED_TAGS,
  attributes: {
    ...defaultSchema.attributes,
    a: ["href", "title"],
    img: [["src", /^asset:[0-9a-f-]{36}$/i], "alt", "title"],
    th: [["scope", "col", "row", "colgroup", "rowgroup"], "colSpan", "rowSpan"],
    td: ["colSpan", "rowSpan"],
    ol: ["start"],
    code: [["className", /^language-[a-z0-9_+-]+$/i]],
    p: [["className", /^import-caption$/]],
    span: ["lang"]
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    src: ["asset"]
  },
  strip: [
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "form",
    "input",
    "button",
    "textarea",
    "select",
    "option",
    "svg",
    "math",
    "template",
    "noscript",
    "meta",
    "link"
  ],
  allowComments: false,
  allowDoctypes: false
};

export interface DocxImageLike {
  readonly contentType: string;
  readonly readAsArrayBuffer: () => Promise<ArrayBuffer>;
}

export interface CollectDocxImageContext {
  readonly images: ExtractedImage[];
  readonly issues: ImportIssue[];
  readonly limits: ImportLimits;
  readonly createAssetId?: () => string;
}

export interface HtmlToReaderAstOptions {
  readonly images?: readonly ExtractedImage[];
  readonly issues?: readonly ImportIssue[];
}

export interface DocxConversionOptions {
  readonly limits?: ImportLimits;
  readonly createAssetId?: () => string;
}

interface WorkingImage {
  id: string;
  fileName: string;
  mimeType: ImportImageMimeType;
  bytes: ArrayBuffer;
  alt: string;
  needsAlt: boolean;
}

interface HastContext {
  readonly images: WorkingImage[];
  readonly imageById: Map<string, WorkingImage>;
  readonly issues: ImportIssue[];
  readonly referencedImageIds: Set<string>;
}

function addIssue(
  ctx: HastContext,
  code: ImportIssue["code"],
  severity: ImportIssue["severity"],
  detail?: string
): void {
  ctx.issues.push(
    detail === undefined ? { code, severity } : { code, severity, detail }
  );
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

function isElement(node: Nodes): node is Element {
  return node.type === "element";
}

function tag(node: Element): string {
  return node.tagName.toLowerCase();
}

function propertyString(
  properties: Properties,
  name: keyof Properties
): string | null {
  const value = properties[name];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(String).join(" ");
  return null;
}

function propertyPositiveInteger(
  properties: Properties,
  name: keyof Properties
): number | null {
  const raw = propertyString(properties, name);
  if (raw === null) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function classNames(node: Element): string[] {
  const value = node.properties.className;
  // HAST represents class names as an array; the sanitizer keeps that shape.
  return Array.isArray(value) ? value.map(String) : [];
}

function textContent(node: Nodes): string {
  if (node.type === "text") return node.value;
  if (node.type === "element" || node.type === "root") {
    return node.children.map(child => textContent(child)).join("");
  }
  return "";
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

function headingLevel(depth: number): 2 | 3 | 4 {
  return Math.min(4, Math.max(2, depth)) as 2 | 3 | 4;
}

function safeScope(raw: string | null): ReaderTableScope | null {
  return raw === "col" ||
    raw === "row" ||
    raw === "colgroup" ||
    raw === "rowgroup"
    ? raw
    : null;
}

function mapInlineNodes(
  nodes: readonly Nodes[],
  ctx: HastContext
): ReaderInline[] {
  const output: ReaderInline[] = [];

  for (const node of nodes) {
    if (node.type === "text") {
      appendText(output, node.value);
      continue;
    }
    if (!isElement(node)) continue;

    const name = tag(node);
    switch (name) {
      case "strong":
      case "b": {
        const children = compactInlines(mapInlineNodes(node.children, ctx));
        if (children.length > 0) output.push({ kind: "strong", children });
        break;
      }
      case "em":
      case "i": {
        const children = compactInlines(mapInlineNodes(node.children, ctx));
        if (children.length > 0) output.push({ kind: "emphasis", children });
        break;
      }
      case "u":
      case "s":
      case "strike":
      case "del": {
        // No underline/strikethrough node in v1; keep the words.
        output.push(...compactInlines(mapInlineNodes(node.children, ctx)));
        addIssue(ctx, "unsupportedFormatting", "warning", name);
        break;
      }
      case "code": {
        const value = textContent(node);
        if (value.trim() !== "") output.push({ kind: "inlineCode", value });
        break;
      }
      case "a": {
        const href = propertyString(node.properties, "href");
        const children = compactInlines(mapInlineNodes(node.children, ctx));
        if (href !== null && isSafeHref(href)) {
          if (children.length > 0)
            output.push({ kind: "link", href, children });
        } else {
          output.push(...children);
          // A missing href means the sanitizer removed an unsafe protocol; an
          // empty anchor is still an unsafe link from the author's point of view.
          addIssue(ctx, "unsafeLink", "warning", href ?? "missing-href");
        }
        break;
      }
      case "sup":
      case "sub": {
        const children = compactInlines(mapInlineNodes(node.children, ctx));
        if (children.length > 0) {
          output.push({ kind: name === "sup" ? "sup" : "sub", children });
        }
        break;
      }
      case "span": {
        const children = compactInlines(mapInlineNodes(node.children, ctx));
        if (children.length > 0) {
          const lang = propertyString(node.properties, "lang");
          output.push(
            lang !== null && lang.trim() !== ""
              ? { kind: "span", lang, children }
              : { kind: "span", children }
          );
        }
        break;
      }
      case "br":
        appendText(output, "\n");
        break;
      case "img":
        // Images are block nodes in v1 and are split out by mapParagraph. A
        // nested image cannot be represented, so it is removed with a warning.
        addIssue(ctx, "imageUnresolved", "warning", "nested-image");
        break;
      default:
        // Transparent inline wrapper (for example a text run split by Word).
        output.push(...mapInlineNodes(node.children, ctx));
        break;
    }
  }

  return output;
}

function mapImageElement(
  node: Element,
  ctx: HastContext,
  caption: string | null
): ReaderImageBlock | null {
  const src = propertyString(node.properties, "src");
  const match = src === null ? null : ASSET_SRC_PATTERN.exec(src);
  if (match === null || match[1] === undefined) {
    addIssue(ctx, "imageUnresolved", "warning", "image");
    return null;
  }

  const id = match[1];
  const image = ctx.imageById.get(id);
  if (!image) {
    addIssue(ctx, "imageUnresolved", "warning", id);
    return null;
  }

  const alt = propertyString(node.properties, "alt")?.trim() ?? "";
  if (alt === "") {
    // T-041: fallback file name is flagged for review; publish stays blocked.
    image.alt = "";
    image.needsAlt = true;
    addIssue(ctx, "imageAltMissing", "blocking", image.fileName);
  } else {
    image.alt = alt;
    image.needsAlt = false;
  }

  ctx.referencedImageIds.add(id);

  const altText = alt === "" ? image.fileName : alt;
  return caption === null
    ? { kind: "image", assetId: id, alt: altText }
    : { kind: "image", assetId: id, alt: altText, caption };
}

function mapCellInlines(
  nodes: readonly Nodes[],
  ctx: HastContext
): ReaderInline[] {
  const output: ReaderInline[] = [];

  for (const node of nodes) {
    if (!isElement(node)) {
      if (node.type === "text") appendText(output, node.value);
      continue;
    }

    if (tag(node) === "table") {
      // A nested table cannot be represented in a table cell.
      addIssue(ctx, "unsupportedFormatting", "warning", "nested-table");
      continue;
    }
    if (tag(node) === "img") {
      addIssue(ctx, "imageUnresolved", "warning", "table-image");
      continue;
    }
    output.push(...mapInlineNodes([node], ctx));
  }

  return compactInlines(output);
}

function mapCell(
  node: Element,
  header: boolean,
  headerRow: boolean,
  ctx: HastContext
): ReaderTableCell {
  const colspan = propertyPositiveInteger(node.properties, "colSpan");
  const rowspan = propertyPositiveInteger(node.properties, "rowSpan");
  const rawScope = header ? propertyString(node.properties, "scope") : null;
  const scope = header
    ? (safeScope(rawScope) ?? (headerRow ? "col" : "row"))
    : null;

  return {
    header,
    ...(scope !== null ? { scope } : {}),
    ...(colspan !== null && colspan > 1 ? { colspan } : {}),
    ...(rowspan !== null && rowspan > 1 ? { rowspan } : {}),
    children: mapCellInlines(node.children, ctx)
  };
}

function collectRows(
  nodes: readonly Nodes[],
  inHeader: boolean,
  output: { node: Element; header: boolean }[]
): void {
  for (const node of nodes) {
    if (!isElement(node)) continue;
    const name = tag(node);
    if (name === "thead") {
      collectRows(node.children, true, output);
    } else if (name === "tbody" || name === "tfoot") {
      collectRows(node.children, false, output);
    } else if (name === "tr") {
      output.push({ node, header: inHeader });
    } else {
      collectRows(node.children, inHeader, output);
    }
  }
}

function mapTable(
  node: Element,
  ctx: HastContext,
  caption: string | null
): ReaderTableBlock | null {
  const rowElements: { node: Element; header: boolean }[] = [];
  collectRows(node.children, false, rowElements);
  if (rowElements.length === 0) {
    addIssue(ctx, "docxWarning", "warning", "empty-table");
    return null;
  }

  const isHeaderRow = (row: { node: Element; header: boolean }): boolean => {
    if (row.header) return true;
    const cells = row.node.children.filter(
      (child): child is Element =>
        isElement(child) && (tag(child) === "th" || tag(child) === "td")
    );
    return cells.length > 0 && cells.every(cell => tag(cell) === "th");
  };

  let headerRows = 0;
  while (
    headerRows < rowElements.length &&
    isHeaderRow(rowElements[headerRows]!)
  ) {
    headerRows += 1;
  }

  const rows = rowElements.map((row, rowIndex) =>
    row.node.children
      .filter(
        (child): child is Element =>
          isElement(child) && (tag(child) === "th" || tag(child) === "td")
      )
      .map(cell =>
        mapCell(
          cell,
          // Mammoth emits <th> for Word's tblHeader rows, but some documents
          // only mark the row (thead without th). Treat every cell in a header
          // row as a header cell so the AST keeps the table semantics.
          tag(cell) === "th" || rowIndex < headerRows,
          rowIndex < headerRows,
          ctx
        )
      )
  );

  const explicitCaption = node.children.find(
    child => isElement(child) && tag(child) === "caption"
  );
  const captionText =
    caption ??
    (explicitCaption ? textContent(explicitCaption).trim() || null : null);

  return {
    kind: "table",
    headerRows,
    ...(captionText !== null ? { caption: captionText } : {}),
    rows
  };
}

function mapList(node: Element, ctx: HastContext): ReaderBlock[] {
  const items: ReaderListItem[] = [];
  const nested: ReaderBlock[] = [];

  for (const child of node.children) {
    if (!isElement(child) || tag(child) !== "li") continue;

    const inlines: ReaderInline[] = [];
    for (const itemChild of child.children) {
      if (isElement(itemChild)) {
        const name = tag(itemChild);
        if (name === "ul" || name === "ol") {
          addIssue(ctx, "nestedListFlattened", "warning");
          nested.push(...mapList(itemChild, ctx));
          continue;
        }
      }
      inlines.push(...mapCellInlines([itemChild], ctx));
    }
    items.push({ children: compactInlines(inlines) });
  }

  if (items.length === 0) return [];

  return [{ kind: "list", ordered: tag(node) === "ol", items }, ...nested];
}

function mapPre(node: Element): ReaderBlock {
  const codeElement = node.children.find(
    (child): child is Element => isElement(child) && tag(child) === "code"
  );
  const value = textContent(codeElement ?? node);
  const language =
    codeElement === undefined
      ? null
      : (classNames(codeElement)
          .find(name => name.startsWith("language-"))
          ?.slice("language-".length) ?? null);

  return language !== null && language !== ""
    ? { kind: "code", value, language }
    : { kind: "code", value };
}

function mapParagraph(node: Element, ctx: HastContext): ReaderBlock[] {
  const blocks: ReaderBlock[] = [];
  let inlineBuffer: ReaderInline[] = [];

  const flush = (): void => {
    const children = compactInlines(inlineBuffer);
    inlineBuffer = [];
    if (children.length > 0) blocks.push({ kind: "paragraph", children });
  };

  for (const child of node.children) {
    if (isElement(child) && tag(child) === "img") {
      flush();
      const image = mapImageElement(child, ctx, null);
      if (image) blocks.push(image);
    } else {
      inlineBuffer.push(...mapInlineNodes([child], ctx));
    }
  }

  flush();
  return blocks;
}

function mapFigure(node: Element, ctx: HastContext): ReaderBlock[] {
  const captionElement = node.children.find(
    (child): child is Element => isElement(child) && tag(child) === "figcaption"
  );
  const caption =
    captionElement === undefined
      ? null
      : textContent(captionElement).trim() || null;

  const blocks: ReaderBlock[] = [];
  for (const child of node.children) {
    if (captionElement !== undefined && child === captionElement) continue;
    if (isElement(child) && tag(child) === "img") {
      const image = mapImageElement(child, ctx, caption);
      if (image) blocks.push(image);
    } else {
      blocks.push(...mapBlockNodes([child], ctx));
    }
  }
  return blocks;
}

function mapBlockElement(
  node: Element,
  ctx: HastContext,
  caption: string | null
): ReaderBlock[] {
  const name = tag(node);

  if (/^h[1-6]$/.test(name)) {
    const level = headingLevel(Number.parseInt(name.slice(1), 10));
    return [
      {
        kind: "heading",
        level,
        children: compactInlines(mapInlineNodes(node.children, ctx))
      }
    ];
  }

  switch (name) {
    case "p":
      return mapParagraph(node, ctx);
    case "ul":
    case "ol":
      return mapList(node, ctx);
    case "table": {
      const table = mapTable(node, ctx, caption);
      return table === null ? [] : [table];
    }
    case "blockquote":
      return [
        { kind: "blockquote", children: mapBlockNodes(node.children, ctx) }
      ];
    case "pre":
      return [mapPre(node)];
    case "hr":
      return [{ kind: "divider" }];
    case "img": {
      const image = mapImageElement(node, ctx, caption);
      return image === null ? [] : [image];
    }
    case "figure":
      return mapFigure(node, ctx);
    case "div":
    case "section":
    case "article":
      return mapBlockNodes(node.children, ctx);
    default: {
      // A phrasing element at block level becomes a paragraph; an unknown block
      // container is flattened rather than dropped.
      const inlines = compactInlines(mapInlineNodes([node], ctx));
      return inlines.length === 0
        ? mapBlockNodes(node.children, ctx)
        : [{ kind: "paragraph", children: inlines }];
    }
  }
}

function isCaptionElement(node: Element): boolean {
  return tag(node) === "p" && classNames(node).includes("import-caption");
}

function mapBlockNodes(
  nodes: readonly Nodes[],
  ctx: HastContext
): ReaderBlock[] {
  const blocks: ReaderBlock[] = [];
  let pendingCaption: string | null = null;

  for (const node of nodes) {
    if (!isElement(node)) {
      if (node.type === "text" && node.value.trim() !== "") {
        blocks.push({
          kind: "paragraph",
          children: [{ kind: "text", value: node.value }]
        });
      }
      continue;
    }

    if (isCaptionElement(node)) {
      const text = textContent(node).trim();
      if (text === "") continue;

      const previous = blocks[blocks.length - 1];
      if (
        previous !== undefined &&
        (previous.kind === "table" || previous.kind === "image") &&
        previous.caption === undefined
      ) {
        blocks[blocks.length - 1] = { ...previous, caption: text };
      } else {
        pendingCaption = text;
      }
      continue;
    }

    const caption = pendingCaption;
    pendingCaption = null;
    const mapped = mapBlockElement(node, ctx, caption);
    const consumedCaption =
      caption !== null &&
      mapped.length > 0 &&
      (mapped[0]!.kind === "table" || mapped[0]!.kind === "image");

    if (caption !== null && !consumedCaption) {
      blocks.push({
        kind: "paragraph",
        children: [{ kind: "text", value: caption }]
      });
    }
    blocks.push(...mapped);
  }

  if (pendingCaption !== null) {
    blocks.push({
      kind: "paragraph",
      children: [{ kind: "text", value: pendingCaption }]
    });
  }

  return blocks;
}

/**
 * Sanitizes mammoth HTML and maps it to ReaderDocument v1. Exported so the
 * table/sanitization contract can be tested without constructing a DOCX zip.
 */
export function htmlToReaderAst(
  html: string,
  options: HtmlToReaderAstOptions = {}
): ConversionResult {
  const parsed = unified()
    .use(rehypeParse, { fragment: true })
    .parse(html) as HastRoot;
  const tree = sanitize(parsed, IMPORT_SANITIZE_SCHEMA) as HastRoot;

  const images: WorkingImage[] = (options.images ?? []).map(image => ({
    ...image
  }));
  const ctx: HastContext = {
    images,
    imageById: new Map(images.map(image => [image.id, image])),
    issues: [...(options.issues ?? [])],
    referencedImageIds: new Set()
  };

  const blocks = mapBlockNodes(tree.children, ctx);
  const issues = dedupeIssues(ctx.issues);
  const ast: ReaderDocumentV1 = { kind: "document", blocks };

  return {
    ast,
    images: images.filter(image => ctx.referencedImageIds.has(image.id)),
    issues,
    publishable: issues.every(issue => issue.severity !== "blocking")
  };
}

function normalizeImageMime(raw: string): ImportImageMimeType | null {
  const mime = (raw.split(";")[0] ?? "").trim().toLowerCase();
  switch (mime) {
    case "image/png":
      return "image/png";
    case "image/jpeg":
    case "image/jpg":
      return "image/jpeg";
    case "image/webp":
      return "image/webp";
    default:
      return null;
  }
}

function imageExtension(mime: ImportImageMimeType): string {
  return mime === "image/jpeg" ? "jpg" : mime.slice("image/".length);
}

/**
 * Extracts one mammoth image. Kept exported and dependency-light so the
 * MIME/size/extraction contract is unit-testable without a binary DOCX.
 */
export async function collectDocxImage(
  image: DocxImageLike,
  context: CollectDocxImageContext
): Promise<{ src: string }> {
  const mimeType = normalizeImageMime(image.contentType);
  if (mimeType === null) {
    context.issues.push({
      code: "imageUnsupported",
      severity: "blocking",
      detail: image.contentType
    });
    return { src: "" };
  }

  const bytes = await image.readAsArrayBuffer();
  if (bytes.byteLength > context.limits.maxImageBytes) {
    context.issues.push({
      code: "imageUnsupported",
      severity: "blocking",
      detail: `${image.contentType} (${bytes.byteLength} bytes)`
    });
    return { src: "" };
  }

  const createAssetId = context.createAssetId ?? (() => crypto.randomUUID());
  const id = createAssetId();
  const fileName = `image-${context.images.length + 1}.${imageExtension(mimeType)}`;

  context.images.push({
    id,
    fileName,
    mimeType,
    bytes,
    alt: "",
    needsAlt: true
  });

  return { src: `asset:${id}` };
}

/**
 * The Node build of mammoth accepts `buffer`, the browser build accepts
 * `arrayBuffer`. The worker is a browser boundary; tests run the Node build.
 * `typeof Buffer` keeps the browser branch free of a Buffer reference.
 */
function mammothInput(
  bytes: ArrayBuffer
): Parameters<typeof mammoth.convertToHtml>[0] {
  if (typeof Buffer !== "undefined") {
    return { buffer: Buffer.from(bytes) } as Parameters<
      typeof mammoth.convertToHtml
    >[0];
  }
  return { arrayBuffer: bytes };
}

/** Converts DOCX bytes (already format/size-checked) to the v1 AST. */
export async function docxToReaderAst(
  bytes: ArrayBuffer,
  options: DocxConversionOptions = {}
): Promise<ConversionResult> {
  const limits = options.limits ?? DEFAULT_IMPORT_LIMITS;

  // The zip gate runs before mammoth inflates anything.
  inspectDocxZip(bytes, limits);

  const images: ExtractedImage[] = [];
  const issues: ImportIssue[] = [];
  const createAssetId = options.createAssetId;

  let html: string;
  try {
    const result = await mammoth.convertToHtml(mammothInput(bytes), {
      styleMap: DOCX_STYLE_MAP,
      convertImage: mammoth.images.imgElement(image =>
        collectDocxImage(image, {
          images,
          issues,
          limits,
          ...(createAssetId !== undefined ? { createAssetId } : {})
        })
      )
    });

    html = result.value;
    for (const message of result.messages) {
      if (message.type === "error") {
        // Mammoth can return partial HTML alongside an error. Publishing a
        // partial conversion is forbidden (T-041 §Errors), so fail instead.
        throw new ImportConversionError("docxInvalid", message.message);
      }
      issues.push({
        code: "docxWarning",
        severity: "warning",
        detail: message.message
      });
    }
  } catch (error) {
    if (isImportConversionError(error)) throw error;
    throw new ImportConversionError(
      "docxInvalid",
      error instanceof Error ? error.message : "unknown mammoth error"
    );
  }

  if (html.trim() === "") {
    throw new ImportConversionError("emptyDocument");
  }

  const result = htmlToReaderAst(html, { images, issues });
  if (result.ast.blocks.length === 0) {
    throw new ImportConversionError("emptyDocument");
  }

  return result;
}
