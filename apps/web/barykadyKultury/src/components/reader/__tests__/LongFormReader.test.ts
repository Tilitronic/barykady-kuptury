import { describe, expect, it } from "vitest";
import { Quasar } from "quasar";

import LongFormReader from "@/components/reader/LongFormReader.vue";
import {
  DEFAULT_READER_SETTINGS,
  readerSettingsKey,
  saveReaderSettings
} from "@/components/reader/readerSettings";
import type { ReaderAsset, ReaderDocumentV1 } from "@/features/reader/types";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * T-040 — the shared long-form reader.
 *
 * Renders the ReaderDocument AST v1 (D-32) with semantic, sanitized markup —
 * never v-html — plus the legacy plain-text path (D-38), the content-language
 * selector (D-27), the TOC from AST headings and the reading controls.
 */

const ASSET: ReaderAsset = {
  id: "asset-1",
  locale: "en",
  storagePath: "documents/appendix.webp",
  mimeType: "image/webp",
  width: 640,
  height: 480,
  sha256: "a".repeat(64),
  sizeBytes: 1234
};

const AST: ReaderDocumentV1 = {
  kind: "document",
  blocks: [
    {
      kind: "heading",
      level: 2,
      children: [{ kind: "text", value: "1. Definitions" }]
    },
    {
      kind: "paragraph",
      children: [
        { kind: "text", value: "The term " },
        {
          kind: "strong",
          children: [{ kind: "text", value: "member" }]
        },
        { kind: "text", value: " means a natural person." },
        {
          kind: "link",
          href: "https://example.org/statute",
          children: [{ kind: "text", value: "statute" }]
        },
        {
          kind: "link",
          href: "javascript:alert(1)",
          children: [{ kind: "text", value: "evil" }]
        },
        {
          kind: "span",
          lang: "uk",
          children: [{ kind: "text", value: "громадянин" }]
        },
        {
          kind: "sup",
          children: [{ kind: "text", value: "1" }]
        }
      ]
    },
    {
      kind: "heading",
      level: 3,
      children: [{ kind: "text", value: "Membership" }]
    },
    {
      kind: "list",
      ordered: true,
      items: [
        { children: [{ kind: "text", value: "Apply in writing" }] },
        { children: [{ kind: "text", value: "Approve by board" }] }
      ]
    },
    {
      kind: "table",
      caption: "Membership fees",
      headerRows: 1,
      rows: [
        [
          {
            header: true,
            scope: "col",
            children: [{ kind: "text", value: "Tier" }]
          },
          {
            header: true,
            scope: "col",
            children: [{ kind: "text", value: "Fee" }]
          }
        ],
        [
          {
            header: false,
            children: [{ kind: "text", value: "Supporter" }]
          },
          {
            header: false,
            colspan: 1,
            children: [{ kind: "inlineCode", value: "30 PLN" }]
          }
        ]
      ]
    },
    {
      kind: "image",
      assetId: "asset-1",
      alt: "Signed membership form",
      caption: "Form wzoru 2026"
    },
    {
      kind: "blockquote",
      children: [
        {
          kind: "paragraph",
          children: [{ kind: "text", value: "Culture is a bridge." }]
        }
      ]
    },
    { kind: "code", value: "SELECT 1;", language: "sql" },
    {
      kind: "footnote",
      label: "[1]",
      children: [{ kind: "text", value: "See § 2 of the statute." }]
    },
    { kind: "divider" },
    {
      kind: "heading",
      level: 4,
      children: [{ kind: "text", value: "Deep subsection" }]
    }
  ]
};

async function mountReader(
  // The SFC's $props resolves to `{}` under vue-tsc's generic inference here;
  // the runtime contract is asserted through the mounted DOM, not the type.
  props: Record<string, unknown> = {}
) {
  const fake = createFakeSupabase({});
  const wrapper = await mountWithPlugins(LongFormReader, {
    plugins: [Quasar],
    supabase: fake.client,
    props: {
      title: "Regulations",
      description: null,
      bodyAst: AST,
      body: null,
      contentLocale: "en" as never,
      uiLocale: "en" as never,
      availableLocales: ["en"] as never,
      assets: [ASSET] as never,
      status: "ready" as never,
      storageKey: "bk.reader.document.regulations",
      isFallback: false,
      ...props
    }
  });
  return wrapper;
}

describe("AST rendering (D-32)", () => {
  it("renders exactly one h1 from the title and the AST headings as h2–h4", async () => {
    const wrapper = await mountReader();

    expect(wrapper.findAll("h1")).toHaveLength(1);
    expect(wrapper.get("h1").text()).toBe("Regulations");

    const headings = wrapper
      .findAll("article h2, article h3, article h4")
      .map(h => `${h.element.tagName}:${h.text()}`);
    expect(headings).toEqual([
      "H2:1. Definitions",
      "H3:Membership",
      "H4:Deep subsection"
    ]);
  });

  it("gives every heading a stable id and focus target", async () => {
    const wrapper = await mountReader();

    const h2 = wrapper.get("article h2");
    expect(h2.attributes("id")).toBe("ast-heading-0");
    expect(h2.attributes("tabindex")).toBe("-1");
  });

  it("renders inline nodes without ever emitting raw HTML", async () => {
    const wrapper = await mountReader();

    const paragraph = wrapper.get("article p");
    expect(paragraph.find("strong").text()).toBe("member");
    expect(paragraph.find("a").attributes("href")).toBe(
      "https://example.org/statute"
    );
    expect(paragraph.find("a").attributes("rel")).toContain("noopener");
    // javascript: link degrades to inert text (defense in depth).
    expect(paragraph.text()).toContain("evil");
    expect(wrapper.html()).not.toContain("javascript:");
    expect(paragraph.find('span[lang="uk"]').text()).toBe("громадянин");
    expect(paragraph.find("sup").text()).toBe("1");
  });

  it("accepts exactly the DB link contract (rev-1 A)", async () => {
    const ast: ReaderDocumentV1 = {
      kind: "document",
      blocks: [
        {
          kind: "paragraph",
          children: [
            {
              kind: "link",
              href: "#definitions",
              children: [{ kind: "text", value: "frag" }]
            },
            {
              kind: "link",
              href: "/en/about",
              children: [{ kind: "text", value: "origin" }]
            },
            {
              kind: "link",
              href: "mailto:a@b.c",
              children: [{ kind: "text", value: "mail" }]
            },
            {
              kind: "link",
              href: "//evil.example/x",
              children: [{ kind: "text", value: "proto" }]
            },
            {
              kind: "link",
              href: "data:text/html,x",
              children: [{ kind: "text", value: "data" }]
            },
            {
              kind: "link",
              href: "docs/relative",
              children: [{ kind: "text", value: "rel" }]
            }
          ]
        }
      ]
    };
    const wrapper = await mountReader({ bodyAst: ast, body: null });

    const paragraph = wrapper.get("article p");
    const hrefs = paragraph.findAll("a").map(a => a.attributes("href"));
    expect(hrefs).toEqual(["#definitions", "/en/about", "mailto:a@b.c"]);
    // Rejected forms render their labels as inert text.
    expect(paragraph.text()).toContain("proto");
    expect(paragraph.text()).toContain("data");
    expect(paragraph.text()).toContain("rel");
    expect(paragraph.html()).not.toContain("evil.example");
    expect(paragraph.html()).not.toContain("data:text");
  });

  it("renders an ordered list", async () => {
    const wrapper = await mountReader();

    const list = wrapper.get("article ol");
    expect(list.findAll("li")).toHaveLength(2);
    expect(list.text()).toContain("Apply in writing");
  });

  it("renders tables with caption, thead and th scope", async () => {
    const wrapper = await mountReader();

    const table = wrapper.get("article table");
    expect(table.get("caption").text()).toBe("Membership fees");
    expect(table.find("thead th")?.attributes("scope")).toBe("col");
    expect(table.findAll("thead tr")).toHaveLength(1);
    expect(table.findAll("tbody td")).toHaveLength(2);
    expect(table.find("tbody td code")?.text()).toBe("30 PLN");
  });

  it("renders the image from the asset with alt, caption, lazy and dimensions", async () => {
    const wrapper = await mountReader();

    const figure = wrapper.get("article figure");
    const img = figure.get("img");
    expect(img.attributes("alt")).toBe("Signed membership form");
    expect(img.attributes("src")).toContain(
      "public-media/documents/appendix.webp"
    );
    expect(img.attributes("loading")).toBe("lazy");
    expect(img.attributes("width")).toBe("640");
    expect(img.attributes("height")).toBe("480");
    expect(figure.get("figcaption").text()).toBe("Form wzoru 2026");
  });

  it("omits the figure when the asset is unknown (no placeholders)", async () => {
    const wrapper = await mountReader({ assets: [] as never });

    expect(wrapper.find("figure").exists()).toBe(false);
  });

  it("renders blockquote, code, footnote and divider", async () => {
    const wrapper = await mountReader();

    expect(wrapper.get("article blockquote").text()).toContain(
      "Culture is a bridge."
    );
    expect(wrapper.get("article pre code").text()).toBe("SELECT 1;");
    // rev-1 F: a footnote is NOT a landmark — div, never repeated <aside>.
    const footnote = wrapper.get("article div.reader-footnote");
    expect(footnote.element.tagName).toBe("DIV");
    expect(footnote.text()).toContain("See § 2 of the statute.");
    expect(footnote.get(".reader-footnote__label").text()).toBe("[1]");
    expect(wrapper.findAll("article aside")).toHaveLength(0);
    expect(wrapper.find("article hr").exists()).toBe(true);
  });
});

describe("legacy fallback (D-38)", () => {
  it("renders legacy body through the safe rich-text path with no TOC", async () => {
    const wrapper = await mountReader({
      bodyAst: null,
      body: "## Mission\n\nLegacy text."
    });

    expect(wrapper.find(".localized-rich-text").exists()).toBe(true);
    expect(wrapper.text()).toContain("Legacy text.");
    // Documented degradation: legacy text has no AST headings, so no TOC.
    expect(wrapper.find('[data-testid="reader-toc"]').exists()).toBe(false);
  });
});

describe("content-language selector (D-27)", () => {
  it("lists only available locales, marks the current one, sets lang", async () => {
    const wrapper = await mountReader({
      availableLocales: ["en", "uk"] as never,
      contentLocale: "uk" as never
    });

    const buttons = wrapper.findAll('[data-testid="reader-language"] button');
    const labels = buttons.map(b => b.text());
    expect(labels).toEqual(["English", "Українська"]);
    expect(
      wrapper
        .find('[data-testid="reader-language"] button[lang="uk"]')
        .attributes("aria-current")
    ).toBe("true");
    expect(wrapper.find('button[lang="pl"]').exists()).toBe(false);
  });

  it("emits changeLocale without touching the route", async () => {
    const wrapper = await mountReader({
      availableLocales: ["en", "pl"] as never
    });

    await wrapper.get('button[lang="pl"]').trigger("click");

    expect(wrapper.emitted("change-locale")?.[0]).toEqual(["pl"]);
  });

  it("names the fallback language when the page flags a fallback selection", async () => {
    // `isFallback` is page-computed (requested lang absent + resolved ≠ UI),
    // so an explicit ?lang=uk choice never shows a "fallback" note.
    const wrapper = await mountReader({
      uiLocale: "pl" as never,
      contentLocale: "en" as never,
      isFallback: true
    });

    expect(wrapper.text()).toMatch(/only available in English/);
  });
});

describe("article language and TOC", () => {
  it("sets lang on the article to the CONTENT locale", async () => {
    const wrapper = await mountReader({ contentLocale: "uk" as never });

    expect(wrapper.get("article").attributes("lang")).toBe("uk");
  });

  it("builds the TOC from h2/h3/h4 with hierarchy and hides it on toggle", async () => {
    const wrapper = await mountReader();

    const toc = wrapper.get('[data-testid="reader-toc"]');
    // Desktop list only: PageToc renders one CSS-swapped copy per viewport band.
    const links = toc.findAll(".page-toc__desktop a");
    expect(links.map(l => l.attributes("href"))).toEqual([
      "#ast-heading-0",
      "#ast-heading-2",
      "#ast-heading-10"
    ]);

    // Hierarchy: nested lists, not a flat indented list (rev-1 B1).
    const nested = toc.findAll(".page-toc__list");
    expect(nested.length).toBeGreaterThanOrEqual(2);
    expect(
      toc
        .findAll(".page-toc__desktop .page-toc__list .page-toc__list a")
        .map(l => l.text())
    ).toEqual(["Membership", "Deep subsection"]);

    const toggle = toc.get("button");
    expect(toggle.attributes("aria-expanded")).toBe("true");
    await toggle.trigger("click");
    expect(toggle.attributes("aria-expanded")).toBe("false");
    // B3: hiding collapses the grid column (state lifted to the reader).
    expect(wrapper.get(".long-form-reader__layout").classes()).toContain(
      "long-form-reader__layout--toc-collapsed"
    );
  });
});

describe("states", () => {
  it("announces loading in a status role", async () => {
    const wrapper = await mountReader({ status: "loading" as never });

    expect(wrapper.get('[role="status"]').text()).toBe("Loading…");
  });

  it("offers retry on unavailable", async () => {
    const wrapper = await mountReader({ status: "unavailable" as never });

    await wrapper.get('button[aria-label="Try again"]').trigger("click");
    expect(wrapper.emitted("retry")).toHaveLength(1);
  });

  it("shows the explicit unsupported state", async () => {
    const wrapper = await mountReader({
      status: "unsupported" as never,
      bodyAst: null,
      body: null
    });

    expect(wrapper.text()).toContain("not available in a readable version yet");
  });
});

describe("reading-preference plumbing (header-lane cascade fix)", () => {
  /**
   * The article is the single owner of the --lfr-* / --prose-* custom
   * properties. jsdom cannot resolve the CSS cascade, so the contract here
   * is the variable surface itself: size/line-height/measure + the prose
   * hooks (measure + relative heading sizes). Paragraph spacing left the
   * model — its variable must never appear again (E2E asserts the cascade
   * effects per block type in reader.spec.ts).
   */
  it("binds exactly the preference vars on the article — no paragraph space", async () => {
    const wrapper = await mountReader();

    const style = wrapper.get("article").attributes("style") ?? "";

    expect(style).toContain("--lfr-font-size: 1rem");
    expect(style).toContain("--lfr-line-height: 1.5");
    expect(style).toContain("--lfr-measure: 65ch");
    expect(style).not.toContain("para-space");
  });

  it("keeps the settings rail mounted for ready content only", async () => {
    const wrapper = await mountReader();
    expect(wrapper.find('[data-testid="reader-controls"]').exists()).toBe(true);

    const loading = await mountReader({ status: "loading" });
    expect(loading.find('[data-testid="reader-controls"]').exists()).toBe(
      false
    );
  });

  /**
   * Queue-3 wiring proof: the mount-time load must be the INHERITING one —
   * a document the reader never configured opens at their last committed
   * size (1.375rem = TEXT_SIZE_STEPS[2]), not at the DS baseline. The store
   * owns the fallback chain; this pins that the component actually uses it.
   */
  it("opens a never-configured document at the last committed size", async () => {
    localStorage.clear();
    try {
      saveReaderSettings(readerSettingsKey("publication", "report-2025"), {
        ...DEFAULT_READER_SETTINGS,
        textSize: 2
      });

      const wrapper = await mountReader();

      expect(wrapper.get("article").attributes("style") ?? "").toContain(
        "--lfr-font-size: 1.375rem"
      );
    } finally {
      // Isolate the inheritance source from every later test in this file.
      localStorage.clear();
    }
  });
});

describe("download-original affordance (content-original endpoint)", () => {
  const url =
    "/.netlify/functions/content-original?kind=document&slug=regulations";

  it("renders a same-origin download link when the page passes one", async () => {
    const wrapper = await mountReader({ originalDownloadUrl: url });
    const link = wrapper.get("a[data-testid='download-original']");
    expect(link.attributes("href")).toBe(url);
    expect(link.text()).toContain("Download the original file.");
    // The affordance is an action, never raw color: an icon-less but fully
    // named link; aria-describedby is not needed — the label is complete.
    expect(link.attributes("rel")).toBeUndefined();
  });

  it("renders nothing when the flag or URL is absent (default off)", async () => {
    const bare = await mountReader();
    expect(bare.find("[data-testid='download-original']").exists()).toBe(false);
    const empty = await mountReader({ originalDownloadUrl: null });
    expect(empty.find("[data-testid='download-original']").exists()).toBe(
      false
    );
  });

  it("localizes the affordance in pl and uk", async () => {
    const pl = await mountWithPlugins(LongFormReader, {
      plugins: [Quasar],
      locale: "pl",
      supabase: createFakeSupabase({}).client,
      props: {
        title: "Regulamin",
        bodyAst: AST,
        body: null,
        contentLocale: "en" as never,
        uiLocale: "pl" as never,
        availableLocales: ["en"] as never,
        assets: [] as never,
        status: "ready" as never,
        storageKey: "bk.reader.document.regulations",
        originalDownloadUrl:
          "/.netlify/functions/content-original?kind=document&slug=regulations"
      }
    });
    expect(pl.text()).toContain("Pobierz oryginalny plik.");
    const uk = await mountWithPlugins(LongFormReader, {
      plugins: [Quasar],
      locale: "uk",
      supabase: createFakeSupabase({}).client,
      props: {
        title: "Статут",
        bodyAst: AST,
        body: null,
        contentLocale: "en" as never,
        uiLocale: "uk" as never,
        availableLocales: ["en"] as never,
        assets: [] as never,
        status: "ready" as never,
        storageKey: "bk.reader.document.regulations",
        originalDownloadUrl:
          "/.netlify/functions/content-original?kind=document&slug=regulations"
      }
    });
    expect(uk.text()).toContain("Завантажити оригінальний файл.");
  });
});
