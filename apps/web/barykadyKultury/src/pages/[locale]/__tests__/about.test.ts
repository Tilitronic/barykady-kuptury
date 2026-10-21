import { describe, expect, it } from "vitest";
import { nextTick } from "vue";

import AboutPage from "@/pages/[locale]/about.vue";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * T-016 → T-039 — About is ONE page: Mission/History/Values/Aims parsed from
 * the body's `## ` headings with POSITIONAL stable ids (mission/history/
 * values/aims), plus anchored `#team` and `#documents` sections, a TOC, and
 * independent per-section states (docs/tickets/T-039-consolidated-pages-search.md,
 * D-25). The sub-navigation and the two list routes are gone.
 */

const EN_BODY = "## Mission\nExpand culture.";

const FULL_EN_BODY = `## Mission

To expand Ukrainian culture beyond borders and give it the space it deserves.

## History

The association was founded by Daria Yakovleva in Poznań.

## Values

- Identity
- Education
- Support
- Community

## Aims

The aims of the Association are:

- Cultural diplomacy: acting as a "cultural bridge" between Ukrainians, Poles, and the international community.
- Promotion and popularization of Ukrainian culture in Poland and worldwide.`;

function aboutRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000101",
    page_key: "about",
    status: "published",
    updated_at: "2026-01-05T12:00:00Z",
    site_page_translations: [
      {
        locale: "en",
        title: "About us",
        body: EN_BODY,
        meta_description: "About the association",
        needs_review: false
      }
    ],
    ...overrides
  };
}

const TEAM_ROW = {
  id: "00000000-0000-4000-8000-000000000801",
  name: "Anna Kowalska",
  status: "published",
  sort_order: 1,
  portrait_path: null,
  updated_at: "2026-01-05T12:00:00Z",
  team_member_translations: [
    { locale: "en", role: "Chair", bio: "Coordinates the board." }
  ]
};

const DOC_ROW = {
  id: "00000000-0000-4000-8000-000000000601",
  slug: "regulations",
  status: "published",
  document_type: "regulations",
  language: null,
  storage_path: null,
  mime_type: null,
  file_size_bytes: null,
  publication_date: null,
  sort_order: 1,
  published_at: "2026-01-05T12:00:00Z",
  created_at: "2026-01-05T12:00:00Z",
  updated_at: "2026-01-05T12:00:00Z",
  organization_document_translations: [
    {
      id: "00000000-0000-4000-8000-000000000602",
      document_id: "00000000-0000-4000-8000-000000000601",
      locale: "en",
      title: "Regulations",
      description: null,
      body: "## § 1\n\nBody.",
      needs_review: false,
      created_at: "2026-01-05T12:00:00Z",
      updated_at: "2026-01-05T12:00:00Z"
    }
  ]
};

async function mountAbout(
  supabase: ReturnType<typeof createFakeSupabase>["client"],
  locale: "en" | "pl" | "uk" = "en"
) {
  // The mount router's default record is `/:locale(.*)?` — a path like
  // "/pl/about" would capture "pl/about" as the locale param, so tests
  // mount at the bare locale path and the page reads its locale from there
  // (identical to the pre-T-039 test convention).
  const wrapper = await mountWithPlugins(AboutPage, {
    locale,
    supabase,
    initialRoute: `/${locale}`
  });

  await flushPromises();
  return wrapper;
}

async function flushPromises() {
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 0));
  await nextTick();
}

describe("About page — body sections (T-016 contract preserved)", () => {
  it("renders the mission for the active locale", async () => {
    const fake = createFakeSupabase({ tables: { site_pages: [aboutRow()] } });
    const wrapper = await mountAbout(fake.client);

    expect(wrapper.get("h1").text()).toBe("About us");
    expect(wrapper.text()).toContain("Expand culture");
  });

  it("shows a fallback note when only English exists", async () => {
    const fake = createFakeSupabase({ tables: { site_pages: [aboutRow()] } });
    const wrapper = await mountAbout(fake.client, "pl");

    expect(wrapper.get("h1").text()).toBe("About us");
    expect(wrapper.text()).toContain("Expand culture");
    expect(wrapper.text()).toMatch(/po angielsku/i);
  });

  it("renders the localized title when the requested translation is complete", async () => {
    const fake = createFakeSupabase({
      tables: {
        site_pages: [
          aboutRow({
            site_page_translations: [
              {
                locale: "en",
                title: "About us",
                body: EN_BODY,
                meta_description: "About the association",
                needs_review: false
              },
              {
                locale: "pl",
                title: "O nas",
                body: "## Misja\nRozwijać kulturę.",
                meta_description: "O stowarzyszeniu",
                needs_review: false
              }
            ]
          })
        ]
      }
    });
    const wrapper = await mountAbout(fake.client, "pl");

    expect(wrapper.get("h1").text()).toBe("O nas");
    expect(wrapper.text()).toContain("Rozwijać kulturę");
  });

  it("renders an intentional empty state when the page is absent", async () => {
    const fake = createFakeSupabase({ tables: { site_pages: [] } });
    const wrapper = await mountAbout(fake.client);

    expect(wrapper.text()).toContain("not available");
  });

  it("marks the rich-text prose with English lang when falling back", async () => {
    const fake = createFakeSupabase({
      tables: {
        site_pages: [
          aboutRow({
            site_page_translations: [
              {
                locale: "en",
                title: "About us",
                body: FULL_EN_BODY,
                meta_description: "About the association",
                needs_review: false
              },
              {
                locale: "pl",
                title: "O nas",
                body: null,
                meta_description: null,
                needs_review: true
              }
            ]
          })
        ]
      }
    });
    const wrapper = await mountAbout(fake.client, "pl");

    const richText = wrapper.find(".localized-rich-text");
    expect(richText.attributes("lang")).toBe("en");
  });
});

describe("About side rail — edge-docked layout (Vue docs pattern)", () => {
  async function mountRail() {
    const fake = createFakeSupabase({
      tables: {
        site_pages: [
          aboutRow({
            site_page_translations: [
              {
                locale: "en",
                title: "About us",
                body: FULL_EN_BODY,
                meta_description: "About the association",
                needs_review: false
              }
            ]
          })
        ],
        team_members: [TEAM_ROW],
        organization_documents: [DOC_ROW]
      }
    });
    return mountAbout(fake.client);
  }

  /**
   * The layout contract the rail redesign turns on: the TOC is a sibling of
   * the content column inside a full-bleed wrapper (CSS pins it to the
   * viewport edge), and the h1 lives INSIDE the column so the heading can
   * never be shifted away from the body it titles. A symmetric mirror column
   * keeps the column centered at wide viewports.
   */
  it("docks the TOC as a bleed-rail sibling of a centered column that owns the h1", async () => {
    const wrapper = await mountRail();

    const bleed = wrapper.get(".about-page__bleed");
    expect(bleed.find("nav.about-page__rail").exists()).toBe(true);
    expect(bleed.get("nav.about-page__rail").attributes("aria-label")).toBe(
      "On this page"
    );

    const column = bleed.get(".about-page__column");
    expect(column.find("h1.about-page__title").exists()).toBe(true);
    expect(column.find("section#mission").exists()).toBe(true);
    expect(bleed.find(".about-page__mirror").exists()).toBe(true);

    // The old in-flow TOC column that shifted the content is gone.
    expect(wrapper.find(".about-page__layout").exists()).toBe(false);
  });
});

describe("About page — T-039 consolidation", () => {
  async function mountFull() {
    const fake = createFakeSupabase({
      tables: {
        site_pages: [
          aboutRow({
            site_page_translations: [
              {
                locale: "en",
                title: "About us",
                body: FULL_EN_BODY,
                meta_description: "About the association",
                needs_review: false
              }
            ]
          })
        ],
        team_members: [TEAM_ROW],
        organization_documents: [DOC_ROW]
      }
    });
    return mountAbout(fake.client);
  }

  it("assigns positional stable ids to the body sections", async () => {
    const wrapper = await mountFull();

    for (const id of ["mission", "history", "values", "aims"]) {
      expect(wrapper.find(`section#${id}`).exists()).toBe(true);
    }
    // Heading text is the localized label; ids are locale-independent.
    expect(wrapper.get("section#mission h2").text()).toBe("Mission");
    expect(wrapper.get("section#mission h2").attributes("tabindex")).toBe("-1");
  });

  it("has exactly one h1 and the six section h2s in reading order", async () => {
    const wrapper = await mountFull();

    expect(wrapper.findAll("h1")).toHaveLength(1);
    const h2Texts = wrapper.findAll("h2").map(heading => heading.text());
    expect(h2Texts).toEqual([
      "Mission",
      "History",
      "Values",
      "Aims",
      "Team",
      "Documents"
    ]);
  });

  it("renders #team inline with members and #documents with a reader link", async () => {
    const wrapper = await mountFull();

    const team = wrapper.get("section#team");
    expect(team.find(".team-card__name").text()).toBe("Anna Kowalska");

    const documents = wrapper.get("section#documents");
    const link = documents.get(".documents-list__link");
    expect(link.text()).toBe("Regulations");
    expect(link.attributes("href")).toBe("/en/about/documents/regulations");
  });

  it("lists all six sections in the TOC", async () => {
    const wrapper = await mountFull();

    const tocLinks = wrapper
      .findAll(".page-toc__desktop a")
      .map(link => link.attributes("href"));
    expect(tocLinks).toEqual([
      "#mission",
      "#history",
      "#values",
      "#aims",
      "#team",
      "#documents"
    ]);
  });

  it("keeps the old sub-navigation gone", async () => {
    const wrapper = await mountFull();

    expect(wrapper.find(".about-page__subnav").exists()).toBe(false);
  });

  it("a failing team query does not blank the body or documents", async () => {
    const fake = createFakeSupabase({
      tables: {
        site_pages: [aboutRow()],
        organization_documents: [DOC_ROW]
      },
      tableErrors: { team_members: "team down" }
    });
    const wrapper = await mountAbout(fake.client);

    expect(wrapper.text()).toContain("Expand culture");
    expect(wrapper.text()).toContain(
      "This content is temporarily unavailable."
    );
    expect(
      wrapper.find("section#documents .documents-list__link").exists()
    ).toBe(true);
  });

  it("a failing body query still renders team and documents sections", async () => {
    const fake = createFakeSupabase({
      tables: { team_members: [TEAM_ROW], organization_documents: [DOC_ROW] },
      tableErrors: { site_pages: "pages down" }
    });
    const wrapper = await mountAbout(fake.client);

    expect(wrapper.find("section#team").exists()).toBe(true);
    expect(wrapper.find("section#documents").exists()).toBe(true);
    expect(wrapper.text()).toContain("temporarily unavailable");
    // The TOC keeps the two always-rendered anchors.
    const tocLinks = wrapper
      .findAll(".page-toc__desktop a")
      .map(link => link.attributes("href"));
    expect(tocLinks).toEqual(["#team", "#documents"]);
  });
});
