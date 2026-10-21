import { describe, expect, it } from "vitest";

import { parseReaderAst } from "@/features/reader/api";
import type {
  ReaderImageBlock,
  ReaderParagraphBlock,
  ReaderTableBlock
} from "@/features/reader/types";

import { markdownToReaderAst } from "../mdastToReaderAst";

/**
 * T-041 S2 — Markdown → ReaderDocument v1.
 *
 * Authority:
 * - docs/tickets/T-041-content-import.md §Conversion pipeline — unified +
 *   remark-parse + remark-gfm → mdast → ReaderDocument AST; drop raw HTML;
 *   remote image URLs are stripped with a warning.
 * - supabase/migrations/20261020160000_reader_ast.sql — node/prop allowlists,
 *   heading levels 2–4, link schemes, table semantics, image alt rules.
 * - docs/tickets/DECISIONS.md D-32/D-36/D-37.
 */
describe("markdownToReaderAst", () => {
  it("maps headings, emphasis, inline code and links, clamping headings to 2–4", () => {
    const result = markdownToReaderAst(
      [
        "# Title",
        "",
        "### Section",
        "",
        "##### Deep",
        "",
        "Text with **bold**, *emphasis*, `code` and [a link](https://example.com/path)."
      ].join("\n")
    );

    const headings = result.ast.blocks.filter(
      block => block.kind === "heading"
    );
    expect(headings.map(heading => heading.level)).toEqual([2, 3, 4]);

    const paragraph = result.ast.blocks.find(
      (block): block is ReaderParagraphBlock => block.kind === "paragraph"
    );
    expect(paragraph?.children).toEqual([
      { kind: "text", value: "Text with " },
      { kind: "strong", children: [{ kind: "text", value: "bold" }] },
      { kind: "text", value: ", " },
      { kind: "emphasis", children: [{ kind: "text", value: "emphasis" }] },
      { kind: "text", value: ", " },
      { kind: "inlineCode", value: "code" },
      { kind: "text", value: " and " },
      {
        kind: "link",
        href: "https://example.com/path",
        children: [{ kind: "text", value: "a link" }]
      },
      { kind: "text", value: "." }
    ]);
    expect(result.publishable).toBe(true);
    expect(parseReaderAst(result.ast, 1)).toBe(result.ast);
  });

  it("keeps a word gap between adjacent inline elements", () => {
    const result = markdownToReaderAst("**a** **b**");

    // A literal space value would fail the DB's non-blank text rule; a
    // newline is accepted and HTML collapses it to a space.
    expect(result.ast.blocks[0]).toEqual({
      kind: "paragraph",
      children: [
        { kind: "strong", children: [{ kind: "text", value: "a" }] },
        { kind: "text", value: "\n" },
        { kind: "strong", children: [{ kind: "text", value: "b" }] }
      ]
    });
  });

  it("drops raw HTML instead of passing it to the renderer", () => {
    const result = markdownToReaderAst(
      "Before <script>alert('xss')</script> and <b>markup</b> after."
    );

    expect(JSON.stringify(result.ast)).not.toContain("<script");
    expect(JSON.stringify(result.ast)).not.toContain("<b>");
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "rawHtmlDropped", severity: "warning" })
    );
    expect(result.publishable).toBe(true);
  });

  it("maps GFM tables with a header row and column scope", () => {
    const result = markdownToReaderAst(
      [
        "| Name | Value |",
        "| --- | --- |",
        "| Alpha | **1** |",
        "| Beta | 2 |"
      ].join("\n")
    );

    const table = result.ast.blocks.find(
      (block): block is ReaderTableBlock => block.kind === "table"
    );
    expect(table).toMatchObject({ kind: "table", headerRows: 1 });
    expect(table?.rows).toHaveLength(3);
    expect(table?.rows[0]?.[0]).toEqual({
      header: true,
      scope: "col",
      children: [{ kind: "text", value: "Name" }]
    });
    expect(table?.rows[1]?.[1]).toEqual({
      header: false,
      children: [{ kind: "strong", children: [{ kind: "text", value: "1" }] }]
    });
  });

  it("maps lists, blockquotes, code fences and dividers", () => {
    const result = markdownToReaderAst(
      [
        "- one",
        "- two",
        "",
        "> quoted text",
        "",
        "```ts",
        "const x = 1;",
        "```",
        "",
        "---"
      ].join("\n")
    );

    expect(result.ast.blocks).toEqual([
      {
        kind: "list",
        ordered: false,
        items: [
          { children: [{ kind: "text", value: "one" }] },
          { children: [{ kind: "text", value: "two" }] }
        ]
      },
      {
        kind: "blockquote",
        children: [
          {
            kind: "paragraph",
            children: [{ kind: "text", value: "quoted text" }]
          }
        ]
      },
      { kind: "code", value: "const x = 1;", language: "ts" },
      { kind: "divider" }
    ]);
  });

  it("flattens nested lists that the reader AST cannot represent", () => {
    const result = markdownToReaderAst("- parent\n  - child");

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "nestedListFlattened",
        severity: "warning"
      })
    );
    expect(result.ast.blocks[0]).toMatchObject({
      kind: "list",
      items: [{ children: [{ kind: "text", value: "parent" }] }]
    });
  });

  it("strips remote image URLs with a warning (no hotlinking or tracking pixels)", () => {
    const result = markdownToReaderAst(
      "![Tracker](https://example.com/pixel.png)"
    );

    expect(result.ast.blocks.some(block => block.kind === "image")).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "remoteImageStripped",
        severity: "warning"
      })
    );
    expect(result.publishable).toBe(true);
  });

  it("keeps a Markdown image only when a resolver supplies a content asset id", () => {
    const assetId = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const result = markdownToReaderAst(
      '![A red dot](/media/red.png "Figure 1")',
      { resolveAssetId: url => (url === "/media/red.png" ? assetId : null) }
    );

    const image = result.ast.blocks.find(
      (block): block is ReaderImageBlock => block.kind === "image"
    );
    expect(image).toEqual({
      kind: "image",
      assetId,
      alt: "A red dot",
      caption: "Figure 1"
    });
    expect(result.publishable).toBe(true);
  });

  it("rejects an image without alternative text as a blocking issue", () => {
    const result = markdownToReaderAst("![](/media/red.png)", {
      resolveAssetId: () => "0f8fad5b-d9cb-469f-a165-70867728950e"
    });

    expect(result.ast.blocks.some(block => block.kind === "image")).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "imageAltMissing",
        severity: "blocking"
      })
    );
    expect(result.publishable).toBe(false);
  });

  it("flattens links with unsafe schemes to plain text", () => {
    const result = markdownToReaderAst("[click](javascript:alert(1))");

    expect(result.ast.blocks[0]).toEqual({
      kind: "paragraph",
      children: [{ kind: "text", value: "click" }]
    });
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "unsafeLink", severity: "warning" })
    );
  });

  it("maps GFM footnotes and footnote references to the v1 footnote node", () => {
    const result = markdownToReaderAst("Text[^1]\n\n[^1]: The note.");

    expect(result.ast.blocks).toContainEqual({
      kind: "footnote",
      label: "1",
      children: [{ kind: "text", value: "The note." }]
    });
  });
});
