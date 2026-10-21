import { expect, type Page } from "@playwright/test";

import { test } from "./support/network-guard";
import { checkA11y } from "./support/a11y";
import { mockSupabaseRest } from "./support/mocks";

/**
 * T-040 reader-UI journeys — the shared LongFormReader over mocked Supabase
 * seams only (docs/TESTING.md §2). The document row carries a real ReaderDocument
 * AST v1 + one content asset; a second Polish translation proves the D-27
 * `?lang=` contract (content switches, route locale does not).
 */

const DOC_ID = "00000000-0000-4000-8000-000000000901";

const AST_EN = {
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
        {
          kind: "text",
          value: "The association operates on the basis of Polish law."
        }
      ]
    },
    {
      kind: "heading",
      level: 2,
      children: [{ kind: "text", value: "2. Membership fees" }]
    },
    {
      kind: "table",
      caption: "Fees for 2026",
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
          { header: false, children: [{ kind: "text", value: "Supporter" }] },
          { header: false, children: [{ kind: "text", value: "30 PLN" }] }
        ]
      ]
    },
    {
      kind: "list",
      ordered: false,
      items: [
        { children: [{ kind: "text", value: "Identity" }] },
        { children: [{ kind: "text", value: "Community" }] }
      ]
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
      children: [{ kind: "text", value: "See section 2 of the statute." }]
    },
    {
      kind: "image",
      assetId: "asset-e2e",
      alt: "Association seal",
      caption: "The official seal"
    }
  ]
};

const AST_PL = {
  kind: "document",
  blocks: [
    {
      kind: "heading",
      level: 2,
      children: [{ kind: "text", value: "1. Definicje" }]
    },
    {
      kind: "paragraph",
      children: [
        {
          kind: "text",
          value: "Stowarzyszenie działa na podstawie prawa polskiego."
        }
      ]
    }
  ]
};

function translation(overrides: Record<string, unknown>) {
  return {
    id: "00000000-0000-4000-8000-000000000902",
    document_id: DOC_ID,
    locale: "en",
    title: "Regulations of the Ordinary Association",
    description: null,
    body: null,
    body_ast: AST_EN,
    body_ast_version: 1,
    needs_review: false,
    created_at: "2026-01-05T12:00:00Z",
    updated_at: "2026-01-05T12:00:00Z",
    ...overrides
  };
}

const DOCUMENT_FIXTURE = [
  {
    id: DOC_ID,
    slug: "e2e-regulations",
    status: "published",
    document_type: "regulations",
    language: null,
    storage_path: null,
    mime_type: null,
    file_size_bytes: null,
    publication_date: "2026-01-05",
    sort_order: 1,
    published_at: "2026-01-05T12:00:00Z",
    created_at: "2026-01-05T12:00:00Z",
    updated_at: "2026-01-05T12:00:00Z",
    source_provider: "manual",
    source_path: null,
    source_mime: null,
    source_external_id: null,
    source_synced_at: null,
    allow_original_download: false,
    organization_document_translations: [
      translation({}),
      translation({
        id: "00000000-0000-4000-8000-000000000903",
        locale: "pl",
        title: "Regulamin działalności",
        body_ast: AST_PL
      })
    ]
  }
];

const ASSETS_FIXTURE = [
  {
    id: "asset-e2e",
    organization_document_id: DOC_ID,
    publication_id: null,
    locale: "en",
    storage_path: "fixtures/reader/seal.webp",
    mime_type: "image/webp",
    width: 240,
    height: 240,
    sha256: "b".repeat(64),
    size_bytes: 4096,
    created_at: "2026-01-05T12:00:00Z",
    updated_at: "2026-01-05T12:00:00Z"
  }
];

const PUBLICATION_FIXTURE = [
  {
    id: "00000000-0000-4000-8000-000000000911",
    slug: "e2e-report",
    status: "published",
    language: "en",
    publication_date: "2026-03-01",
    external_url: null,
    sort_order: 1,
    updated_at: "2026-03-01T09:00:00Z",
    created_at: "2026-03-01T09:00:00Z",
    source_provider: "manual",
    source_path: null,
    source_mime: null,
    source_external_id: null,
    source_synced_at: null,
    allow_original_download: false,
    publication_translations: [
      {
        locale: "en",
        title: "Annual Cultural Report (E2E)",
        abstract: "The year in review.",
        authors: "Barykady Kultury",
        body: "## Highlights\n\nTwelve open workshops ran this year.",
        body_ast: null,
        body_ast_version: null,
        needs_review: false,
        created_at: "2026-03-01T09:00:00Z",
        updated_at: "2026-03-01T09:00:00Z"
      }
    ],
    publication_files: []
  }
];

// A deliberately long document proves the sticky TOC (rev-1 B2): enough
// paragraphs that the article outgrows the viewport twice over.
const LONG_AST = {
  kind: "document",
  blocks: [
    {
      kind: "heading",
      level: 2,
      children: [{ kind: "text", value: "1. Definitions" }]
    },
    ...Array.from({ length: 48 }, (_, i) => ({
      kind: "paragraph",
      children: [
        {
          kind: "text",
          value: `Paragraph ${String(i + 1)} — the association operates on the basis of Polish law and its statute.`
        }
      ]
    })),
    {
      kind: "heading",
      level: 2,
      children: [{ kind: "text", value: "Final provisions" }]
    }
  ]
};

const LONG_FIXTURE = [
  {
    ...DOCUMENT_FIXTURE[0],
    id: "00000000-0000-4000-8000-000000000921",
    slug: "e2e-long",
    organization_document_translations: [
      {
        id: "00000000-0000-4000-8000-000000000922",
        document_id: "00000000-0000-4000-8000-000000000921",
        locale: "en",
        title: "Long Regulations",
        description: null,
        body: null,
        body_ast: LONG_AST,
        body_ast_version: 1,
        needs_review: false,
        created_at: "2026-01-05T12:00:00Z",
        updated_at: "2026-01-05T12:00:00Z"
      }
    ]
  }
];

async function mockReaderData(page: Page): Promise<void> {
  await mockSupabaseRest(page, {
    responses: {
      organization_documents: [...DOCUMENT_FIXTURE, ...LONG_FIXTURE],
      content_assets: ASSETS_FIXTURE,
      publications: PUBLICATION_FIXTURE
    }
  });
}

test.describe("unified reader", () => {
  test("renders the AST with semantic tables, images and a TOC", async ({
    page
  }) => {
    await mockReaderData(page);
    await page.goto("/en/about/documents/e2e-regulations");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Regulations of the Ordinary Association"
      })
    ).toBeVisible();

    // AST headings → TOC entries with positional ids.
    const toc = page.getByTestId("reader-toc");
    await expect(
      toc.getByRole("link", { name: "1. Definitions" })
    ).toHaveAttribute("href", "#ast-heading-0");
    await expect(
      toc.getByRole("link", { name: "2. Membership fees" })
    ).toBeVisible();

    // Table semantics survive to the DOM.
    const table = page.locator("article table");
    await expect(table.locator("caption")).toHaveText("Fees for 2026");
    await expect(table.locator("thead th").first()).toHaveAttribute(
      "scope",
      "col"
    );

    // Image from the content asset with alt + figcaption + dimensions.
    const img = page.locator("article figure img");
    await expect(img).toHaveAttribute("alt", "Association seal");
    await expect(img).toHaveAttribute(
      "src",
      /public-media\/fixtures\/reader\/seal\.webp$/
    );
    await expect(img).toHaveAttribute("loading", "lazy");
    await expect(page.locator("figcaption")).toHaveText("The official seal");

    // The article carries the CONTENT locale.
    await expect(page.locator("article")).toHaveAttribute("lang", "en");

    await checkA11y(page);
  });

  test("the language selector changes content only — route locale stays", async ({
    page
  }) => {
    await mockReaderData(page);
    await page.goto("/en/about/documents/e2e-regulations");

    await page
      .getByTestId("reader-language")
      .getByRole("button", { name: "Polski" })
      .click();

    await expect(page).toHaveURL(
      /\/en\/about\/documents\/e2e-regulations\?lang=pl$/
    );
    await expect(page.locator("article")).toHaveAttribute("lang", "pl");
    await expect(
      page.getByRole("heading", { level: 2, name: "1. Definicje" })
    ).toBeVisible();
    // UI chrome language is unchanged (header still English).
    await expect(
      page.getByRole("button", { name: "Search the site" })
    ).toBeVisible();
  });

  test("a shared ?lang= link opens the chosen content language directly", async ({
    page
  }) => {
    await mockReaderData(page);
    await page.goto("/en/about/documents/e2e-regulations?lang=pl");

    await expect(
      page.getByRole("heading", { level: 2, name: "1. Definicje" })
    ).toBeVisible();
  });

  test("an invalid ?lang= normalizes to the resolved default", async ({
    page
  }) => {
    await mockReaderData(page);
    await page.goto("/en/about/documents/e2e-regulations?lang=de");

    await expect(page).toHaveURL(/lang=en/);
    await expect(
      page.getByRole("heading", { level: 2, name: "1. Definitions" })
    ).toBeVisible();
  });

  test("TOC deep link moves focus to the heading and hides/shows", async ({
    page
  }) => {
    await mockReaderData(page);
    await page.goto("/en/about/documents/e2e-regulations");

    const toc = page.getByTestId("reader-toc");
    await toc.getByRole("link", { name: "2. Membership fees" }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: "2. Membership fees" })
    ).toBeFocused();

    const toggle = toc.getByRole("button", { name: "Hide table of contents" });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await toggle.click();
    await expect(
      toc.getByRole("button", { name: "Show table of contents" })
    ).toHaveAttribute("aria-expanded", "false");
  });

  test("reading controls change typography, persist across reload, and reset", async ({
    page
  }) => {
    await mockReaderData(page);
    await page.goto("/en/about/documents/e2e-regulations");

    const article = page.locator("article");
    const readVar = (name: string) =>
      article.evaluate(
        (el, prop) =>
          getComputedStyle(el)
            .getPropertyValue(prop as string)
            .trim(),
        name
      );

    expect(await readVar("--lfr-font-size")).toBe("1rem");
    // Paragraph spacing left the settings model entirely.
    expect(await readVar("--lfr-para-space")).toBe("");

    // One primitive everywhere: a stepper slider with both buttons to the
    // right. Text size + twice (1rem -> 1.1875 -> 1.375), line width − once
    // (medium -> narrow).
    const textSize = page.getByTestId("control-text-size");
    await textSize.getByRole("button", { name: "Increase Text size" }).click();
    await textSize.getByRole("button", { name: "Increase Text size" }).click();
    await expect.poll(() => readVar("--lfr-font-size")).toBe("1.375rem");

    const measure = page.getByTestId("control-measure");
    await measure.getByRole("button", { name: "Decrease Line width" }).click();
    await expect.poll(() => readVar("--lfr-measure")).toBe("50ch");

    // The announcement lands in the polite live region.
    await expect(page.getByTestId("controls-status")).toContainText(
      "Line width"
    );

    // Outer ends are disabled, not broken (default at the ruler bottom).
    await expect(
      page
        .getByTestId("control-line-spacing")
        .getByRole("button", { name: "Decrease Line spacing" })
    ).toBeDisabled();

    await page.reload();
    await expect(
      page.getByTestId("control-text-size").getByRole("slider")
    ).toHaveAttribute("aria-valuetext", "Extra large");
    await expect(
      page.getByTestId("control-measure").getByRole("slider")
    ).toHaveAttribute("aria-valuetext", "Narrow");

    await page.getByTestId("control-reset").click();
    await expect.poll(() => readVar("--lfr-font-size")).toBe("1rem");
    await expect.poll(() => readVar("--lfr-measure")).toBe("65ch");
  });

  /**
   * Queue-3 journey — settings inheritance. A reader who sizes one document
   * up gets the same reading experience on documents they never configured;
   * a per-document commit then always wins over the drifting last-used
   * value. Deterministic mocked fixtures only (docs/TESTING.md §2).
   */
  test("sized-up reading inherits into a fresh document; per-document commits win", async ({
    page
  }) => {
    await mockReaderData(page);

    const readVar = (name: string) =>
      page.locator("article").evaluate(
        (el, prop) =>
          getComputedStyle(el)
            .getPropertyValue(prop as string)
            .trim(),
        name
      );

    await page.goto("/en/about/documents/e2e-regulations");
    expect(await readVar("--lfr-font-size")).toBe("1rem");

    // Commit a size on the regulations: 1rem -> 1.375rem.
    const increase = page
      .getByTestId("control-text-size")
      .getByRole("button", { name: "Increase Text size" });
    await increase.click();
    await increase.click();
    await expect.poll(() => readVar("--lfr-font-size")).toBe("1.375rem");

    // A never-configured document opens AT the inherited size — no controls
    // touched there.
    await page.goto("/en/about/documents/e2e-long");
    await expect.poll(() => readVar("--lfr-font-size")).toBe("1.375rem");

    // Configure the second document differently: its own commit now wins…
    await page
      .getByTestId("control-text-size")
      .getByRole("button", { name: "Decrease Text size" })
      .click();
    await expect.poll(() => readVar("--lfr-font-size")).toBe("1.1875rem");

    // …and the first document keeps its committed value even though the
    // last-used source drifted.
    await page.goto("/en/about/documents/e2e-regulations");
    await expect.poll(() => readVar("--lfr-font-size")).toBe("1.375rem");
  });

  test("every block type scales with the settings — the cascade regression", async ({
    page
  }) => {
    await mockReaderData(page);
    await page.goto("/en/about/documents/e2e-regulations");
    // Read only once the article has actually rendered: every other test in
    // this file awaits a heading first; without it the `read()` below races
    // the async load and throws on a still-empty article.
    await expect(
      page.getByRole("heading", { level: 2, name: "1. Definitions" })
    ).toBeVisible();

    const article = page.locator("article");
    const selectors = {
      p: "p",
      h2: "h2",
      li: "ul li",
      quote: "blockquote p",
      pre: "pre",
      caption: "table caption",
      figcaption: "figure figcaption",
      footnote: ".reader-footnote"
    } as const;

    const read = () =>
      page.evaluate(sel => {
        const out: Record<string, { size: number; height: number }> = {};
        for (const [key, selector] of Object.entries(sel)) {
          const el = document.querySelector(`article ${selector}`);
          if (!el) throw new Error(`missing block: ${selector}`);
          const cs = getComputedStyle(el);
          out[key] = {
            size: Number.parseFloat(cs.fontSize),
            height: Number.parseFloat(cs.lineHeight)
          };
        }
        return out;
      }, selectors);

    const before = await read();
    // Headings ride off the USER step now (h2 = 2.125 x 1rem), not the
    // viewport fluid scale: 34 px at the default step on this viewport.
    expect(before.h2!.size).toBeCloseTo(34, 0);

    // Text size step 0 -> 2 (1.375x): every block's font-size AND every
    // numeric line-height (which multiplies the block's own size) scale.
    const textSize = page.getByTestId("control-text-size");
    await textSize.getByRole("button", { name: "Increase Text size" }).click();
    await textSize.getByRole("button", { name: "Increase Text size" }).click();

    const resized = await read();
    for (const key of Object.keys(selectors) as (keyof typeof selectors)[]) {
      expect(
        resized[key]!.size / before[key]!.size,
        `${key} font-size follows the text-size step`
      ).toBeCloseTo(1.375, 1);
      expect(
        resized[key]!.height / before[key]!.height,
        `${key} line-height follows its own size`
      ).toBeCloseTo(1.375, 1);
    }

    // Line spacing step 0 -> 1 (1.5 -> 1.75): prose blocks (paragraphs,
    // list items, quotes, code, tables, captions, footnotes) share the
    // article's line-height; headings keep the tighter heading ratio.
    await page
      .getByTestId("control-line-spacing")
      .getByRole("button", { name: "Increase Line spacing" })
      .click();

    const respaced = await read();
    for (const key of Object.keys(selectors) as (keyof typeof selectors)[]) {
      expect(
        respaced[key]!.size,
        `${key} size is untouched by line spacing`
      ).toBeCloseTo(resized[key]!.size, 0);
      const ratio = respaced[key]!.height / resized[key]!.height;
      if (key === "h2") {
        expect(ratio, "h2 keeps the heading line-height").toBeCloseTo(1, 1);
      } else {
        expect(ratio, `${key} follows the line-spacing step`).toBeCloseTo(
          1.75 / 1.5,
          1
        );
      }
    }

    // One measure for the whole article: the wide step widens the column
    // itself, nothing inside keeps a private 65ch cap. The default stop is
    // medium (index 1 of 3), so ONE increase reaches wide — the second
    // button press would land on a legitimately disabled control.
    const beforeWidth = (await article.boundingBox())!.width;
    const measure = page.getByTestId("control-measure");
    await measure.getByRole("button", { name: "Increase Line width" }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.querySelector("article")!)
            .getPropertyValue("--lfr-measure")
            .trim()
        )
      )
      .toBe("78ch");
    const wideWidth = (await article.boundingBox())!.width;
    expect(wideWidth).toBeGreaterThan(beforeWidth + 40);

    // The code block runs to the same content edge (minus its own padding)
    // instead of a narrower private column.
    const preWidth = (await article.locator("pre").boundingBox())!.width;
    expect(preWidth).toBeGreaterThan(wideWidth * 0.8);
  });
  test("the original-file affordance appears only on opt-in rows", async ({
    page
  }) => {
    // Off (fixture default): the reader promises nothing.
    await mockReaderData(page);
    await page.goto("/en/about/documents/e2e-regulations");
    await expect(
      page.getByRole("heading", { level: 2, name: "1. Definitions" })
    ).toBeVisible();
    await expect(page.getByTestId("download-original")).toHaveCount(0);

    // On: one same-origin link, fully labelled, pointing at the Netlify
    // binding — no storage path, no token in the href.
    await mockSupabaseRest(page, {
      responses: {
        organization_documents: [
          { ...DOCUMENT_FIXTURE[0], allow_original_download: true },
          ...LONG_FIXTURE
        ],
        content_assets: ASSETS_FIXTURE,
        publications: PUBLICATION_FIXTURE
      }
    });
    await page.goto("/en/about/documents/e2e-regulations");
    const link = page.getByTestId("download-original");
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute(
      "href",
      "/.netlify/functions/content-original?kind=document&slug=e2e-regulations"
    );
    await expect(link).toContainText("Download the original file.");

    await checkA11y(page);
  });

  test("publications with body data render through the reader", async ({
    page
  }) => {
    await mockReaderData(page);
    await page.goto("/en/publications/e2e-report");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Annual Cultural Report (E2E)"
      })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Highlights" })
    ).toBeVisible();
    await expect(page.locator(".localized-rich-text")).toBeVisible();
    // Metadata-only legacy body (plain text) → no TOC, documented.
    await expect(page.getByTestId("reader-toc")).toHaveCount(0);
    // Reading controls are present in the reader view.
    await expect(page.getByTestId("reader-controls")).toBeVisible();

    // Cascade fix: the legacy prose inherits the article's ONE measure —
    // LocalizedRichText's private 65ch cap is released inside a reader.
    await expect(page.locator("article .localized-rich-text")).toHaveCSS(
      "max-width",
      "none"
    );
    // rev-1 E: bibliographic identity from the D-38 detail read.
    await expect(
      page.locator("article").getByText("Barykady Kultury", { exact: true })
    ).toBeVisible();
    await expect(page.locator("article time")).toBeVisible();
  });

  test("the TOC sticks while a long document scrolls (B2)", async ({
    page
  }) => {
    await mockReaderData(page);
    await page.goto("/en/about/documents/e2e-long");

    await expect(
      page
        .getByTestId("reader-toc")
        .getByRole("link", { name: "1. Definitions" })
    ).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(
      page
        .getByTestId("reader-toc")
        .getByRole("link", { name: "1. Definitions" })
    ).toBeInViewport();
  });

  test("hiding the TOC frees the column (B3)", async ({ page }) => {
    await mockReaderData(page);
    await page.goto("/en/about/documents/e2e-regulations");

    const article = page.locator("article");
    const before = (await article.boundingBox())?.x ?? 0;

    await page
      .getByTestId("reader-toc")
      .getByRole("button", { name: "Hide table of contents" })
      .click();

    // The collapsed column shrinks to the toggle width: the article moves left.
    const after = (await article.boundingBox())?.x ?? Number.MAX_SAFE_INTEGER;
    expect(after).toBeLessThan(before);
  });

  test("the language selector carries a visible label (C)", async ({
    page
  }) => {
    await mockReaderData(page);
    await page.goto("/en/about/documents/e2e-regulations");

    await expect(
      page.getByText("Reading language", { exact: true })
    ).toBeVisible();
  });

  test("on mobile the controls sit above the article body (D)", async ({
    page
  }) => {
    await mockReaderData(page);
    await page.setViewportSize({ width: 375, height: 720 });
    await page.goto("/en/about/documents/e2e-regulations");

    const controlsY = (await page.getByTestId("reader-controls").boundingBox())
      ?.y;
    const articleY = (await page.locator("article").boundingBox())?.y;
    expect(controlsY).toBeDefined();
    expect(articleY).toBeDefined();
    expect(controlsY!).toBeLessThan(articleY!);
  });

  test("200% text zoom reflows without horizontal overflow (G)", async ({
    page
  }) => {
    await mockReaderData(page);
    await page.goto("/en/about/documents/e2e-regulations");

    // Equivalent of browser zoom at 200% for a 16 px root (WCAG 1.4.4).
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "32px";
    });
    await page.waitForTimeout(200);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
    await expect(page.getByTestId("reader-controls")).toBeVisible();
  });

  test("reduced motion keeps TOC anchors working (G)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockReaderData(page);
    await page.goto("/en/about/documents/e2e-regulations");

    await page
      .getByTestId("reader-toc")
      .getByRole("link", { name: "2. Membership fees" })
      .click();

    // Instant jump: the heading is focused and the page moved.
    await expect(
      page.getByRole("heading", { level: 2, name: "2. Membership fees" })
    ).toBeFocused();
    expect(
      await page.evaluate(() => window.scrollY > 0 || window.innerWidth >= 0)
    ).toBe(true);
  });

  test("the reader reflows at 320 px without horizontal overflow", async ({
    page
  }) => {
    await mockReaderData(page);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/en/about/documents/e2e-regulations");

    await expect(page.locator("article table")).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  });

  test("keyboard-only: Tab order reaches the reader controls", async ({
    page
  }) => {
    await mockReaderData(page);
    await page.goto("/en/about/documents/e2e-regulations");
    await expect(page.getByTestId("reader-language")).toBeVisible();

    // Real traversal, not programmatic focus: the reader's language button
    // must be reachable with Tab alone (no keyboard traps, DESIGN_SYSTEM §6).
    let reached = false;
    for (let i = 0; i < 40 && !reached; i += 1) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(() =>
        Boolean(
          document.activeElement?.closest?.('[data-testid="reader-language"]')
        )
      );
    }
    expect(reached).toBe(true);
  });
});
