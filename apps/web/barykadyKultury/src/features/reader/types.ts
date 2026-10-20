import type { Locale } from "@/features/i18n/locales";

/**
 * Unified long-form reader model (T-040, D-32/D-36/D-38).
 *
 * The AST types mirror the JSON accepted by the database trigger
 * (`validate_reader_ast_v1`, `supabase/migrations/20261020160000_reader_ast.sql`).
 * They are intentionally the project-owned storage contract — not mdast or
 * HAST, which are import-time formats only (D-32).
 *
 * Every node property is required unless marked optional. The DB allowlist
 * rejects unknown properties, so the TypeScript union and the SQL validator
 * describe the same v1 shape.
 */

/** Which long-form entity a reader URL resolves to. */
export type ReaderEntityKind = "document" | "publication";

/** Reader state machine. `unsupported` = row exists but no readable v1 text. */
export type ReaderDocumentStatus =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "unavailable"
  | "unsupported";

// ---------------------------------------------------------------------------
// AST v1
// ---------------------------------------------------------------------------

export interface ReaderDocumentV1 {
  readonly kind: "document";
  readonly blocks: readonly ReaderBlock[];
}

export type ReaderBlock =
  | ReaderHeadingBlock
  | ReaderParagraphBlock
  | ReaderListBlock
  | ReaderTableBlock
  | ReaderImageBlock
  | ReaderBlockquoteBlock
  | ReaderCodeBlock
  | ReaderFootnoteBlock
  | ReaderDividerBlock;

export interface ReaderHeadingBlock {
  readonly kind: "heading";
  /** h2–h4 only; the article h1 comes from the page title. */
  readonly level: 2 | 3 | 4;
  readonly children: readonly ReaderInline[];
}

export interface ReaderParagraphBlock {
  readonly kind: "paragraph";
  readonly children: readonly ReaderInline[];
}

export interface ReaderListItem {
  readonly children: readonly ReaderInline[];
}

export interface ReaderListBlock {
  readonly kind: "list";
  readonly ordered: boolean;
  readonly items: readonly ReaderListItem[];
}

export type ReaderTableScope = "col" | "row" | "colgroup" | "rowgroup";

export interface ReaderTableCell {
  readonly header: boolean;
  /** Required for header cells; forbidden for data cells (DB invariant). */
  readonly scope?: ReaderTableScope;
  readonly colspan?: number;
  readonly rowspan?: number;
  readonly children: readonly ReaderInline[];
}

export interface ReaderTableBlock {
  readonly kind: "table";
  readonly headerRows: number;
  readonly caption?: string;
  /** Rows are arrays of cells; ragged rows are allowed by the DB schema. */
  readonly rows: readonly (readonly ReaderTableCell[])[];
}

export interface ReaderImageBlock {
  readonly kind: "image";
  /** References `content_assets.id`; never a remote URL (D-36). */
  readonly assetId: string;
  /** Empty only when `decorative` is true. */
  readonly alt: string;
  readonly caption?: string;
  readonly decorative?: boolean;
}

export interface ReaderBlockquoteBlock {
  readonly kind: "blockquote";
  readonly children: readonly ReaderBlock[];
}

export interface ReaderCodeBlock {
  readonly kind: "code";
  readonly value: string;
  readonly language?: string;
}

export interface ReaderFootnoteBlock {
  readonly kind: "footnote";
  readonly label: string;
  readonly children: readonly ReaderInline[];
}

export interface ReaderDividerBlock {
  readonly kind: "divider";
}

export type ReaderInline =
  | ReaderTextInline
  | ReaderStrongInline
  | ReaderEmphasisInline
  | ReaderLinkInline
  | ReaderInlineCodeInline
  | ReaderSupInline
  | ReaderSubInline
  | ReaderSpanInline;

export interface ReaderTextInline {
  readonly kind: "text";
  readonly value: string;
}

export interface ReaderStrongInline {
  readonly kind: "strong";
  readonly children: readonly ReaderInline[];
}

export interface ReaderEmphasisInline {
  readonly kind: "emphasis";
  readonly children: readonly ReaderInline[];
}

export interface ReaderLinkInline {
  readonly kind: "link";
  readonly href: string;
  readonly children: readonly ReaderInline[];
}

export interface ReaderInlineCodeInline {
  readonly kind: "inlineCode";
  readonly value: string;
}

export interface ReaderSupInline {
  readonly kind: "sup";
  readonly children: readonly ReaderInline[];
}

export interface ReaderSubInline {
  readonly kind: "sub";
  readonly children: readonly ReaderInline[];
}

export interface ReaderSpanInline {
  readonly kind: "span";
  /** Optional BCP 47 tag for a quoted foreign-language passage. */
  readonly lang?: string;
  readonly children: readonly ReaderInline[];
}

// ---------------------------------------------------------------------------
// Reader data model
// ---------------------------------------------------------------------------

export interface ReaderTranslation {
  readonly locale: Locale;
  readonly title: string;
  /** Document description or publication abstract. */
  readonly description: string | null;
  /** `null` for legacy body-only rows and unsupported AST versions. */
  readonly bodyAst: ReaderDocumentV1 | null;
  /** Plain-text projection (or legacy authored text). */
  readonly body: string | null;
  /**
   * True when this translation can be rendered: a supported v1 AST or
   * non-blank legacy body. Drives `availableLocales` and the D-38 fallback.
   */
  readonly hasReadableContent: boolean;
}

export interface ReaderAsset {
  readonly id: string;
  readonly locale: Locale;
  readonly storagePath: string;
  readonly mimeType: "image/png" | "image/jpeg" | "image/webp";
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
  readonly sizeBytes: number | null;
}

export type ReaderSourceProvider = "manual" | "upload" | "google_doc";

export interface ReaderSourceMeta {
  readonly provider: ReaderSourceProvider;
  readonly path: string | null;
  readonly mime: string | null;
  readonly externalId: string | null;
  readonly syncedAt: string | null;
  /**
   * Only a hint for the reader: the UI still requests a short-lived signed URL
   * server-side when true (D-30); the bucket itself is private.
   */
  readonly allowOriginalDownload: boolean;
}

export interface ReaderDocumentModel {
  readonly id: string;
  readonly kind: ReaderEntityKind;
  readonly slug: string;
  readonly translations: readonly ReaderTranslation[];
  /** Translations with readable content, in supported-locale order. */
  readonly availableLocales: readonly Locale[];
  readonly assets: readonly ReaderAsset[];
  readonly source: ReaderSourceMeta;
  /** Documents only. */
  readonly documentType: string | null;
  /** Language of an uploaded file, where meaningful. */
  readonly language: Locale | null;
  readonly publicationDate: string | null;
  /** Publications only. */
  readonly externalUrl: string | null;
  readonly updatedAt: string;
}
