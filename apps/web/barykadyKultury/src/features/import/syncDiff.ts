import type {
  ReaderBlock,
  ReaderDocumentV1,
  ReaderInline
} from "../reader/types";

/**
 * T-042 S8 — a small, deterministic diff summary shown before a sync replaces
 * published content. It is intentionally prose-level (headings + counts), not
 * a pixel diff: the admin needs to recognise the document and see the shape
 * change, without a second renderer.
 */
export interface SyncDiffSummary {
  readonly previousBlocks: number;
  readonly nextBlocks: number;
  readonly previousHeadings: readonly string[];
  readonly nextHeadings: readonly string[];
  readonly addedHeadings: readonly string[];
  readonly removedHeadings: readonly string[];
  readonly imageCount: number;
  readonly tableCount: number;
}

function inlineText(nodes: readonly ReaderInline[]): string {
  return nodes
    .map(node => {
      if (node.kind === "text" || node.kind === "inlineCode") return node.value;
      if ("children" in node) return inlineText(node.children);
      return "";
    })
    .join("");
}

function collectBlockStats(
  blocks: readonly ReaderBlock[],
  headings: string[],
  counts: { images: number; tables: number }
): void {
  for (const block of blocks) {
    if (block.kind === "heading") headings.push(inlineText(block.children));
    if (block.kind === "image") counts.images += 1;
    if (block.kind === "table") counts.tables += 1;
    if (block.kind === "blockquote") {
      collectBlockStats(block.children, headings, counts);
    }
  }
}

function stats(document: ReaderDocumentV1 | null): {
  blocks: number;
  headings: string[];
  images: number;
  tables: number;
} {
  const headings: string[] = [];
  const counts = { images: 0, tables: 0 };
  if (document !== null) {
    collectBlockStats(document.blocks, headings, counts);
  }
  return {
    blocks: document?.blocks.length ?? 0,
    headings,
    images: counts.images,
    tables: counts.tables
  };
}

export function summarizeAstDiff(
  previous: ReaderDocumentV1 | null,
  next: ReaderDocumentV1
): SyncDiffSummary {
  const before = stats(previous);
  const after = stats(next);
  const beforeSet = new Set(before.headings);
  const afterSet = new Set(after.headings);

  return {
    previousBlocks: before.blocks,
    nextBlocks: after.blocks,
    previousHeadings: before.headings,
    nextHeadings: after.headings,
    addedHeadings: after.headings.filter(heading => !beforeSet.has(heading)),
    removedHeadings: before.headings.filter(heading => !afterSet.has(heading)),
    imageCount: after.images,
    tableCount: after.tables
  };
}
