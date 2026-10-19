import { h, type VNode } from "vue";

/**
 * Restricted Markdown renderer for organization content (T-016).
 *
 * The content model stores a minimal, safe subset of Markdown in
 * `site_page_translations.body`:
 *   - `##` / `###` headings
 *   - paragraphs
 *   - `-` bullet lists
 *   - `**bold**` / `*italic*` inline formatting
 *   - links restricted to `http:`, `https:` and `mailto:` schemes
 *
 * The parser produces an AST and renders it to Vue VNodes with text children.
 * Because no raw HTML is ever emitted, hostile input such as `<script>` tags or
 * `javascript:` URLs is rendered as inert text (verified by
 * `richText.test.ts`).
 */

export interface RichTextRoot {
  readonly children: readonly BlockNode[];
}

export type BlockNode =
  | {
      readonly kind: "heading";
      readonly level: 2 | 3;
      readonly children: readonly InlineNode[];
    }
  | { readonly kind: "paragraph"; readonly children: readonly InlineNode[] }
  | {
      readonly kind: "bulletList";
      readonly items: readonly (readonly InlineNode[])[];
    };

export type InlineNode =
  | { readonly kind: "text"; readonly value: string }
  | {
      readonly kind: "strong";
      readonly children: readonly InlineNode[];
    }
  | {
      readonly kind: "emphasis";
      readonly children: readonly InlineNode[];
    }
  | {
      readonly kind: "link";
      readonly href: string;
      readonly children: readonly InlineNode[];
    };

const ALLOWED_LINK_SCHEMES = ["http:", "https:", "mailto:"];

function isAllowedHref(href: string): boolean {
  const lower = href.toLowerCase();
  return ALLOWED_LINK_SCHEMES.some(scheme => lower.startsWith(scheme));
}

/** Parses inline formatting inside a single line of text. */
export function parseInline(text: string): readonly InlineNode[] {
  const nodes: InlineNode[] = [];
  let i = 0;

  while (i < text.length) {
    const rest = text.slice(i);

    // Link: [label](href)
    const linkMatch = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const consumed = linkMatch[0].length;
      if (href && isAllowedHref(href)) {
        nodes.push({
          kind: "link",
          href,
          children: parseInline(label ?? "")
        });
      } else {
        nodes.push({ kind: "text", value: linkMatch[0] });
      }
      i += consumed;
      continue;
    }

    // Strong: **text**
    const strongMatch = rest.match(/^\*\*([^*]+)\*\*/);
    if (strongMatch) {
      nodes.push({
        kind: "strong",
        children: parseInline(strongMatch[1] ?? "")
      });
      i += strongMatch[0].length;
      continue;
    }

    // Emphasis: *text*
    const emMatch = rest.match(/^\*([^*]+)\*/);
    if (emMatch) {
      nodes.push({
        kind: "emphasis",
        children: parseInline(emMatch[1] ?? "")
      });
      i += emMatch[0].length;
      continue;
    }

    const nextSpecial = rest.search(/[[*]/);
    if (nextSpecial === -1) {
      nodes.push({ kind: "text", value: rest });
      break;
    }

    if (nextSpecial > 0) {
      nodes.push({ kind: "text", value: rest.slice(0, nextSpecial) });
      i += nextSpecial;
      continue;
    }

    // A special character that does not start a recognized pattern is emitted
    // as plain text so raw `<script>` and unmatched delimiters stay inert.
    nodes.push({ kind: "text", value: rest[0] ?? "" });
    i += 1;
  }

  return nodes;
}

function trimInline(nodes: readonly InlineNode[]): readonly InlineNode[] {
  const firstTextIndex = nodes.findIndex(node => node.kind === "text");
  const lastTextIndex = nodes.findLastIndex(node => node.kind === "text");

  return nodes.map((node, index) => {
    if (node.kind !== "text") return node;

    let value = node.value;
    if (index === firstTextIndex) value = value.trimStart();
    if (index === lastTextIndex) value = value.trimEnd();

    return { kind: "text", value };
  });
}

/** Parses a restricted Markdown string into a typed AST. */
export function parseRichText(input: string): RichTextRoot {
  const lines = input.split("\n");
  const children: BlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line === undefined || line.trim() === "") {
      i += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{2,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1]?.length === 2 ? 2 : 3;
      children.push({
        kind: "heading",
        level,
        children: trimInline(parseInline(headingMatch[2] ?? ""))
      });
      i += 1;
      continue;
    }

    if (line.startsWith("- ")) {
      const items: (readonly InlineNode[])[] = [];
      while (i < lines.length && lines[i]?.startsWith("- ")) {
        const itemLine = lines[i];
        items.push(trimInline(parseInline(itemLine?.slice(2) ?? "")));
        i += 1;
      }
      children.push({ kind: "bulletList", items });
      continue;
    }

    // Paragraph: collect consecutive non-blank, non-special lines.
    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i] !== undefined &&
      lines[i]!.trim() !== "" &&
      !lines[i]!.match(/^#{2,3}\s/) &&
      !lines[i]!.startsWith("- ")
    ) {
      paragraphLines.push(lines[i] ?? "");
      i += 1;
    }

    if (paragraphLines.length > 0) {
      children.push({
        kind: "paragraph",
        children: trimInline(parseInline(paragraphLines.join(" ")))
      });
    }
  }

  return { children };
}

export interface RenderRichTextOptions {
  /** Localized screen-reader suffix for external links that open a new tab. */
  readonly newTabLabel?: string | undefined;
  /** Language of `newTabLabel`, applied to the visually-hidden suffix span. */
  readonly labelLang?: string | undefined;
  /**
   * M1 (T-025 review): shift rendered heading levels down the outline.
   * The homepage nests authored content under its section h2s, so it passes
   * `1` ("## " renders h3, "### " renders h4) while `about.vue` keeps `0`.
   * This changes only the rendered ELEMENT tag of already-parsed, already-
   * sanitized headings — parsing and the restricted-subset guarantees are
   * untouched, and the result is clamped to h1..h6.
   */
  readonly headingOffset?: number | undefined;
}

function renderInline(
  nodes: readonly InlineNode[],
  options: RenderRichTextOptions = {}
): (string | VNode)[] {
  return nodes.map(node => {
    if (node.kind === "text") return node.value;
    if (node.kind === "strong")
      return h("strong", {}, renderInline(node.children, options));
    if (node.kind === "emphasis")
      return h("em", {}, renderInline(node.children, options));

    const isExternal = /^https?:\/\//i.test(node.href);
    const children = renderInline(node.children, options);
    if (isExternal && options.newTabLabel) {
      // Screen-reader announcement for links that open a new tab.
      children.push(
        h(
          "span",
          { class: "visually-hidden", lang: options.labelLang },
          ` (${options.newTabLabel})`
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
  });
}

function renderBlock(
  node: BlockNode,
  options: RenderRichTextOptions = {}
): VNode {
  if (node.kind === "heading") {
    const offset = options.headingOffset ?? 0;
    // Clamp to the valid HTML heading range; never emit h0/h7.
    const level = Math.min(6, Math.max(1, node.level + offset));
    return h(`h${level}`, {}, renderInline(node.children, options));
  }

  if (node.kind === "paragraph") {
    return h("p", {}, renderInline(node.children, options));
  }

  return h(
    "ul",
    {},
    node.items.map(item => h("li", {}, renderInline(item, options)))
  );
}

/**
 * Parses `input` and returns a list of Vue VNodes ready to be passed as children
 * to another element. Returns an empty array for blank/nullish input.
 */
export function renderRichText(
  input: string | null | undefined,
  options: RenderRichTextOptions = {}
): VNode[] {
  if (!input || input.trim().length === 0) return [];

  return parseRichText(input).children.map(node => renderBlock(node, options));
}
