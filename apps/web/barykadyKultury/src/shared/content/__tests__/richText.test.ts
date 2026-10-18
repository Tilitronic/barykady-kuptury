import { describe, expect, it } from "vitest";

import {
  parseRichText,
  parseInline,
  renderRichText
} from "@/shared/content/richText";

/**
 * T-016 — Restricted Markdown renderer.
 *
 * Proves the documented subset (headings, paragraphs, bullet lists, inline
 * emphasis, links) and the security-critical behavior: raw HTML and disallowed
 * URL schemes are rendered as inert text, never as markup or executable links.
 */
describe("parseRichText", () => {
  it("parses headings into typed nodes", () => {
    const root = parseRichText("## Mission\n\n### Approach");

    expect(root.children).toHaveLength(2);
    expect(root.children[0]).toMatchObject({
      kind: "heading",
      level: 2,
      children: [{ kind: "text", value: "Mission" }]
    });
    expect(root.children[1]).toMatchObject({
      kind: "heading",
      level: 3,
      children: [{ kind: "text", value: "Approach" }]
    });
  });

  it("parses paragraphs from consecutive lines", () => {
    const root = parseRichText("Line one.\nLine two.\n\nSecond paragraph.");

    expect(root.children).toHaveLength(2);
    expect(root.children[0]).toMatchObject({
      kind: "paragraph",
      children: [{ kind: "text", value: "Line one. Line two." }]
    });
    expect(root.children[1]).toMatchObject({
      kind: "paragraph",
      children: [{ kind: "text", value: "Second paragraph." }]
    });
  });

  it("parses bullet lists", () => {
    const root = parseRichText("- One\n- Two\n- Three");

    expect(root.children).toHaveLength(1);
    expect(root.children[0]).toMatchObject({
      kind: "bulletList",
      items: [
        [{ kind: "text", value: "One" }],
        [{ kind: "text", value: "Two" }],
        [{ kind: "text", value: "Three" }]
      ]
    });
  });

  it("renders raw HTML as inert text", () => {
    const root = parseRichText("<script>alert('xss')</script>");

    expect(root.children).toHaveLength(1);
    expect(root.children[0]).toMatchObject({
      kind: "paragraph",
      children: [{ kind: "text", value: "<script>alert('xss')</script>" }]
    });
  });

  it("ignores one-item headings and plain text starting with #", () => {
    const root = parseRichText("# Not a heading\nPlain text.");

    expect(root.children[0]).toMatchObject({
      kind: "paragraph",
      children: [{ kind: "text", value: "# Not a heading Plain text." }]
    });
  });
});

describe("parseInline", () => {
  it("parses strong and emphasis", () => {
    const nodes = parseInline("**bold** and *italic*");

    expect(nodes).toMatchObject([
      { kind: "strong", children: [{ kind: "text", value: "bold" }] },
      { kind: "text", value: " and " },
      { kind: "emphasis", children: [{ kind: "text", value: "italic" }] }
    ]);
  });

  it("parses allowed http/https/mailto links", () => {
    const nodes = parseInline("[email us](mailto:hello@example.org)");

    expect(nodes).toMatchObject([
      {
        kind: "link",
        href: "mailto:hello@example.org",
        children: [{ kind: "text", value: "email us" }]
      }
    ]);
  });

  it("rejects javascript: links and renders them as text", () => {
    const nodes = parseInline("[click](javascript:alert('xss'))");
    const text = nodes
      .filter(node => node.kind === "text")
      .map(node => (node.kind === "text" ? node.value : ""))
      .join("");

    expect(nodes.every(node => node.kind === "text")).toBe(true);
    expect(text).toBe("[click](javascript:alert('xss'))");
  });

  it("rejects unknown URL schemes and renders them as text", () => {
    const nodes = parseInline("[file](file:///etc/passwd)");
    const text = nodes
      .filter(node => node.kind === "text")
      .map(node => (node.kind === "text" ? node.value : ""))
      .join("");

    expect(nodes.every(node => node.kind === "text")).toBe(true);
    expect(text).toBe("[file](file:///etc/passwd)");
  });

  it("treats unmatched delimiters as plain text", () => {
    const nodes = parseInline("**not closed");

    expect(nodes).toHaveLength(3);
    expect(nodes).toMatchObject([
      { kind: "text", value: "*" },
      { kind: "text", value: "*" },
      { kind: "text", value: "not closed" }
    ]);
  });
});

describe("renderRichText", () => {
  it("returns an empty array for blank input", () => {
    expect(renderRichText("")).toEqual([]);
    expect(renderRichText(null)).toEqual([]);
    expect(renderRichText("   ")).toEqual([]);
  });

  it("renders a heading and a paragraph", () => {
    const vnodes = renderRichText("## Title\n\nBody text.");

    expect(vnodes).toHaveLength(2);
    expect(vnodes[0]?.type).toBe("h2");
    expect(vnodes[1]?.type).toBe("p");
  });

  it("renders a bullet list with list items", () => {
    const vnodes = renderRichText("- A\n- B");

    expect(vnodes).toHaveLength(1);
    expect(vnodes[0]?.type).toBe("ul");
  });

  it("announces external links that open a new tab with a localized label", () => {
    const vnodes = renderRichText("[example](https://example.org)", {
      newTabLabel: "opens in a new tab",
      labelLang: "en"
    });

    expect(vnodes).toHaveLength(1);
    expect(vnodes[0]?.type).toBe("p");

    const link = ((vnodes[0]?.children as unknown[]) ?? []).find(
      child =>
        typeof child === "object" &&
        child !== null &&
        "type" in child &&
        child.type === "a"
    ) as
      | {
          readonly type: string;
          readonly props?: { readonly target?: string };
          readonly children?: unknown[];
        }
      | undefined;

    expect(link).toBeDefined();
    expect(link?.props?.target).toBe("_blank");

    const hidden = link?.children?.find(
      child =>
        typeof child === "object" &&
        child !== null &&
        "type" in child &&
        child.type === "span" &&
        "props" in child &&
        (child.props as { readonly class?: string } | undefined)?.class ===
          "visually-hidden"
    ) as
      | {
          readonly type: string;
          readonly props?: { readonly lang?: string };
          readonly children?: unknown[];
        }
      | undefined;

    expect(hidden).toBeDefined();
    expect(hidden?.props?.lang).toBe("en");
    expect(hidden?.children).toBe(" (opens in a new tab)");
  });

  it("uses a non-English new-tab label when supplied", () => {
    const vnodes = renderRichText("[example](https://example.org)", {
      newTabLabel: "otwiera się w nowej karcie",
      labelLang: "pl"
    });

    const link = ((vnodes[0]?.children as unknown[]) ?? []).find(
      child =>
        typeof child === "object" &&
        child !== null &&
        "type" in child &&
        child.type === "a"
    ) as { readonly children?: unknown[] } | undefined;

    const hidden = link?.children?.find(
      child =>
        typeof child === "object" &&
        child !== null &&
        "type" in child &&
        child.type === "span"
    ) as
      | {
          readonly type: string;
          readonly props?: { readonly lang?: string };
          readonly children?: unknown[];
        }
      | undefined;

    expect(hidden?.props?.lang).toBe("pl");
    expect(hidden?.children).toBe(" (otwiera się w nowej karcie)");
  });

  it("does not append a new-tab suffix when no label is provided", () => {
    const vnodes = renderRichText("[example](https://example.org)");

    const link = ((vnodes[0]?.children as unknown[]) ?? []).find(
      child =>
        typeof child === "object" &&
        child !== null &&
        "type" in child &&
        child.type === "a"
    ) as { readonly children?: unknown[] } | undefined;

    const hidden = link?.children?.find(
      child =>
        typeof child === "object" &&
        child !== null &&
        "type" in child &&
        child.type === "span"
    );

    expect(hidden).toBeUndefined();
  });

  it("renders hostile input without creating active markup", () => {
    const vnodes = renderRichText("<script>alert('xss')</script>");

    expect(vnodes).toHaveLength(1);
    expect(vnodes[0]?.type).toBe("p");
    // The text child should contain the literal angle brackets as text, not as
    // an element. Vue text VNodes expose their content via `children`.
    expect(vnodes[0]?.children).toEqual(["<script>alert('xss')</script>"]);
  });
});
