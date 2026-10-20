import { parseRichText, type BlockNode, type InlineNode } from "./richText";

/**
 * T-039 — About body section parsing (D-25).
 *
 * The about body is authored in the restricted Markdown subset and parsed
 * with the SHARED restricted parser (`richText.ts`): no raw HTML is ever
 * emitted here, sanitization is never bypassed — this module only re-groups
 * the already-safe AST into sections.
 *
 * ID CONTRACT (documented deliberately):
 *   Section ids are POSITIONAL, assigned in body order:
 *   1st `## ` heading → `mission`, 2nd → `history`, 3rd → `values`,
 *   4th → `aims`, 5th+ → `section-<n>`.
 *   The ids are locale-independent because the body is localized while the
 *   URLs are shared (T-039: "en content drives the ids for all locales") —
 *   position, not heading text, is the stable contract. The localized
 *   heading text is only the TOC label.
 */

/** Positional id slots for the canonical About sections (T-039 page structure). */
export const ABOUT_SECTION_ID_SLOTS = [
  "mission",
  "history",
  "values",
  "aims"
] as const;

/** One `## `-delimited section of the about body. */
export interface RichTextSection {
  /** Stable positional id (`mission` … or `section-<n>` beyond the slots). */
  readonly id: string;
  /** Plain-text heading label for the TOC (markup flattened). */
  readonly title: string;
  /** The section's blocks WITHOUT the opening heading (rendered by the page). */
  readonly blocks: readonly BlockNode[];
}

export interface ParsedBodySections {
  /** Blocks before the first `## ` heading (lead paragraphs). */
  readonly intro: readonly BlockNode[];
  readonly sections: readonly RichTextSection[];
}

/** Flattens inline nodes to text for TOC labels (links contribute their text). */
export function inlineText(nodes: readonly InlineNode[]): string {
  return nodes
    .map(node => {
      if (node.kind === "text") return node.value;
      if (node.kind === "link") return inlineText(node.children);
      return inlineText(node.children);
    })
    .join("");
}

/** Resolves the positional id for section `index` (0-based). */
export function sectionIdAt(index: number): string {
  const slot = ABOUT_SECTION_ID_SLOTS[index];
  return slot ?? `section-${index + 1}`;
}

/**
 * Splits an authored body into heading-delimited sections using the shared
 * restricted parser. `### ` headings stay INSIDE their section (the page
 * renders them via the same safe renderer).
 */
export function splitRichTextSections(body: string): ParsedBodySections {
  const blocks = parseRichText(body).children;

  const intro: BlockNode[] = [];
  const sections: {
    id: string;
    title: string;
    blocks: BlockNode[];
  }[] = [];

  let sectionIndex = -1;

  for (const block of blocks) {
    if (block.kind === "heading" && block.level === 2) {
      sectionIndex += 1;
      sections.push({
        id: sectionIdAt(sectionIndex),
        title: inlineText(block.children),
        blocks: []
      });
      continue;
    }

    if (sectionIndex === -1) {
      intro.push(block);
    } else {
      sections[sectionIndex]!.blocks.push(block);
    }
  }

  return { intro, sections };
}
