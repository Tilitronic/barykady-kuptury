import { describe, expect, it } from "vitest";

import { splitRichTextSections } from "../sections";

/**
 * T-039 — About body section parsing.
 *
 * The about body is authored in the restricted Markdown subset
 * (`shared/content/richText.ts`); `## ` headings drive the section split.
 * Ids are POSITIONAL (mission, history, values, aims) so they are stable
 * across locales even though the heading text is localized — the English
 * content's section order is the id contract (D-25 / T-039 page structure).
 */

describe("splitRichTextSections", () => {
  it("splits on level-2 headings and assigns positional ids", () => {
    const body = `## Mission

Expand culture.

## History

Founded in Poznań.

## Values

- Identity
- Education

## Aims

Bridge cultures.`;

    const parsed = splitRichTextSections(body);

    expect(parsed.sections.map(s => s.id)).toEqual([
      "mission",
      "history",
      "values",
      "aims"
    ]);
    expect(parsed.sections.map(s => s.title)).toEqual([
      "Mission",
      "History",
      "Values",
      "Aims"
    ]);
    expect(parsed.intro).toHaveLength(0);
  });

  it("keeps pre-heading blocks as the intro", () => {
    const parsed = splitRichTextSections(
      "Welcome paragraph.\n\n## Mission\n\nExpand culture."
    );

    expect(parsed.intro).toHaveLength(1);
    expect(parsed.sections.map(s => s.id)).toEqual(["mission"]);
  });

  it("nests level-3 headings inside the current section", () => {
    const parsed = splitRichTextSections(
      "## Mission\n\nLead.\n\n### Approach\n\nDetails."
    );

    expect(parsed.sections).toHaveLength(1);
    const blocks = parsed.sections[0]!.blocks;
    expect(blocks.map(b => b.kind)).toEqual([
      "paragraph",
      "heading",
      "paragraph"
    ]);
  });

  it("assigns overflow ids for headings beyond the four slots", () => {
    const body = Array.from(
      { length: 6 },
      (_, i) => `## Heading ${i + 1}\n\nBody ${i + 1}.`
    ).join("\n\n");

    const parsed = splitRichTextSections(body);

    expect(parsed.sections.map(s => s.id)).toEqual([
      "mission",
      "history",
      "values",
      "aims",
      "section-5",
      "section-6"
    ]);
  });

  it("flattens inline markup in the title (TOC labels are plain text)", () => {
    const parsed = splitRichTextSections(
      "## Our **bold** [mission](https://example.org)\n\nText."
    );

    expect(parsed.sections[0]!.title).toBe("Our bold mission");
  });

  it("returns nothing for blank or heading-less bodies", () => {
    expect(splitRichTextSections("").sections).toHaveLength(0);
    expect(splitRichTextSections("   ").intro).toHaveLength(0);

    const noHeadings = splitRichTextSections("Just a paragraph.");
    expect(noHeadings.sections).toHaveLength(0);
    expect(noHeadings.intro).toHaveLength(1);
  });

  it("treats hostile input as inert text (parser guarantee reused)", () => {
    const parsed = splitRichTextSections(
      "## Mission <script>alert(1)</script>\n\nText."
    );

    // The restricted parser never emits HTML — the heading title is text.
    expect(parsed.sections[0]!.title).toBe("Mission <script>alert(1)</script>");
  });
});
