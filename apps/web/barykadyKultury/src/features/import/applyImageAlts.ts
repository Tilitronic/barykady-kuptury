import type { ReaderBlock, ReaderDocumentV1 } from "../reader/types";

import type { ConversionResult, ExtractedImage, ImportIssue } from "./types";

/**
 * T-041 S5 — the admin alt-text review step.
 *
 * The DOCX converter uses the file name as a structural fallback (the DB
 * requires non-empty alt), but marks the image `needsAlt`. The admin page can
 * supply the real alt without re-running conversion; this pure helper updates
 * the AST and recomputes `publishable`, so a publish cannot slip through with
 * an unreviewed image (D-37 / T-041 acceptance).
 */
function updateBlocks(
  blocks: readonly ReaderBlock[],
  alts: Readonly<Record<string, string>>
): ReaderBlock[] {
  return blocks.map(block => {
    if (block.kind === "image") {
      const alt = alts[block.assetId]?.trim() ?? "";
      return alt === "" ? block : { ...block, alt };
    }
    if (block.kind === "blockquote") {
      return { ...block, children: updateBlocks(block.children, alts) };
    }
    return block;
  });
}

function issuesForImages(images: readonly ExtractedImage[]): ImportIssue[] {
  return images
    .filter(image => image.needsAlt)
    .map(image => ({
      code: "imageAltMissing" as const,
      severity: "blocking" as const,
      detail: image.fileName
    }));
}

export function applyImageAlts(
  result: ConversionResult,
  alts: Readonly<Record<string, string>>
): ConversionResult {
  const images = result.images.map(image => {
    const alt = alts[image.id]?.trim() ?? "";
    return alt === "" ? image : { ...image, alt, needsAlt: false };
  });

  const issues = [
    ...result.issues.filter(issue => issue.code !== "imageAltMissing"),
    ...issuesForImages(images)
  ];

  const ast: ReaderDocumentV1 = {
    kind: "document",
    blocks: updateBlocks(result.ast.blocks, alts)
  };

  return {
    ast,
    images,
    issues,
    publishable: issues.every(issue => issue.severity !== "blocking")
  };
}
