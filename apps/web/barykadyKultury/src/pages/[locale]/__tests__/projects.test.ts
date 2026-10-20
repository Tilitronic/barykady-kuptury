import { describe, expect, it } from "vitest";
import { nextTick } from "vue";

import ProjectsPage from "@/pages/[locale]/projects.vue";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * Spec axis: docs/tickets/T-038-canonical-slugs.md + D-24 — the listing shows
 * only published projects with a translated empty state and links each card
 * with the one canonical slug shared by every locale. The prefix follows the
 * language whose text is rendered: an English-stand-in card links under `/en`
 * because strict detail resolution 404s a locale without a translation. There
 * is no per-locale slug. Draft rows stay hidden even when the payload leaks them.
 */

const CANONICAL_SLUG = "sample-community-workshop";

const EN_TRANSLATION = {
  locale: "en",
  title: "Sample Community Workshop (EN)",
  summary: "Summary (EN)",
  body: "Body (EN)"
};

const PL_TRANSLATION = {
  locale: "pl",
  title: "Przykładowy warsztat społeczny (PL)",
  summary: "Podsumowanie (PL)",
  body: "Treść (PL)"
};

function publishedRow() {
  return {
    id: "00000000-0000-4000-8000-000000000201",
    slug: CANONICAL_SLUG,
    status: "published",
    featured_rank: 1,
    cover_path: "fixtures/projects/sample-cover.webp",
    start_date: "2026-01-10",
    end_date: "2026-03-20",
    updated_at: "2026-02-01T00:00:00Z",
    project_translations: [EN_TRANSLATION, PL_TRANSLATION]
  };
}

function draftRow() {
  return {
    id: "00000000-0000-4000-8000-000000000202",
    slug: "sample-draft-project",
    status: "draft",
    featured_rank: null,
    cover_path: null,
    start_date: null,
    end_date: null,
    updated_at: "2026-02-02T00:00:00Z",
    project_translations: [{ ...EN_TRANSLATION, title: "DRAFT LEAK" }]
  };
}

async function mountListing(
  supabase: ReturnType<typeof createFakeSupabase>["client"] | null,
  locale: "en" | "pl" | "uk" = "en"
) {
  const wrapper = await mountWithPlugins(ProjectsPage, {
    locale,
    supabase,
    initialRoute: `/${locale}/projects`,
    routes: [
      {
        path: "/:locale(en|pl|uk)/projects",
        name: "projects",
        component: ProjectsPage
      }
    ]
  });

  await flushPromises();
  return wrapper;
}

async function flushPromises() {
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe("projects listing", () => {
  it("shows the translated empty state and fabricates nothing", async () => {
    const fake = createFakeSupabase({ tables: { projects: [] } });
    const wrapper = await mountListing(fake.client, "pl");

    expect(wrapper.text()).toContain("Brak dostępnych projektów.");
    expect(wrapper.find(".project-card").exists()).toBe(false);
  });

  it("renders published cards and never a draft row leaked into the payload", async () => {
    const fake = createFakeSupabase({
      tables: { projects: [publishedRow(), draftRow()] }
    });
    const wrapper = await mountListing(fake.client, "pl");

    // T-039: the ranked project appears in BOTH #featured and #all (the
    // ticket defines #all as every published project); drafts stay out.
    expect(wrapper.get("section#all").findAll(".project-card")).toHaveLength(1);
    expect(
      wrapper.get("section#featured").findAll(".project-card")
    ).toHaveLength(1);
    expect(wrapper.text()).toContain("Przykładowy warsztat społeczny (PL)");
    expect(wrapper.text()).not.toContain("DRAFT LEAK");
  });

  it("links a same-locale card with the canonical slug under the requested locale", async () => {
    const fake = createFakeSupabase({ tables: { projects: [publishedRow()] } });
    const wrapper = await mountListing(fake.client, "pl");

    expect(wrapper.get(".project-card__link").attributes("href")).toBe(
      `/pl/projects/${CANONICAL_SLUG}`
    );
  });

  it("links an English-stand-in card under the English owning locale", async () => {
    // Strict detail resolution requires a requested-locale translation, so a
    // card rendering English fallback text must link under /en; the slug stays
    // canonical and the fallback note still explains the substitution.
    const fake = createFakeSupabase({
      tables: {
        projects: [
          { ...publishedRow(), project_translations: [EN_TRANSLATION] }
        ]
      }
    });
    const wrapper = await mountListing(fake.client, "uk");

    expect(wrapper.get(".project-card__link").attributes("href")).toBe(
      `/en/projects/${CANONICAL_SLUG}`
    );
    expect(wrapper.get(".project-card__fallback").text()).toContain(
      "англійською"
    );
  });

  it("resolves the cover URL in the feature layer and passes it as data", async () => {
    const fake = createFakeSupabase({ tables: { projects: [publishedRow()] } });
    const wrapper = await mountListing(fake.client, "en");

    const img = wrapper.get(".project-card__cover");
    expect(img.attributes("src")).toContain(
      "public-media/fixtures/projects/sample-cover.webp"
    );
    expect(img.attributes("alt")).toBe("");
  });

  it("keeps one h1, section h2s, and card titles stepped down to h3", async () => {
    // T-039 outline: h1 → Featured/All h2 → card h3 (was h1 → card h2).
    const fake = createFakeSupabase({ tables: { projects: [publishedRow()] } });
    const wrapper = await mountListing(fake.client, "en");

    expect(wrapper.findAll("h1")).toHaveLength(1);
    expect(wrapper.findAll("h2").map(h => h.text())).toEqual([
      "Featured",
      "All projects"
    ]);
    expect(wrapper.get(".project-card__title").element.tagName).toBe("H3");
  });

  it("shows the unavailable state without a client", async () => {
    const wrapper = await mountListing(null, "en");

    expect(wrapper.text()).toContain("temporarily unavailable");
  });

  describe("T-039 sectioning", () => {
    function rankedRow(rank: number | null, slug: string, title: string) {
      return {
        ...publishedRow(),
        id: `00000000-0000-4000-8000-0000000002${rank ?? 9}`,
        slug,
        featured_rank: rank,
        project_translations: [{ ...EN_TRANSLATION, title }]
      };
    }

    it("orders #featured by rank ascending, non-contiguous ranks included", async () => {
      const fake = createFakeSupabase({
        tables: {
          projects: [
            rankedRow(5, "p-five", "Fifth"),
            rankedRow(null, "p-plain", "Plain"),
            rankedRow(1, "p-one", "First"),
            rankedRow(2, "p-two", "Second")
          ]
        }
      });
      const wrapper = await mountListing(fake.client, "en");

      const titles = wrapper
        .get("section#featured")
        .findAll(".project-card__title")
        .map(t => t.text());
      expect(titles).toEqual(["First", "Second", "Fifth"]);

      expect(wrapper.get("section#all").findAll(".project-card")).toHaveLength(
        4
      );
    });

    it("omits #featured (and its TOC entry) when no project is ranked", async () => {
      const fake = createFakeSupabase({
        tables: { projects: [rankedRow(null, "p-plain", "Plain")] }
      });
      const wrapper = await mountListing(fake.client, "en");

      expect(wrapper.find("section#featured").exists()).toBe(false);
      const tocLinks = wrapper
        .findAll(".page-toc__desktop a")
        .map(link => link.attributes("href"));
      expect(tocLinks).toEqual(["#all"]);
    });

    it("lists both sections in the TOC when featured exist", async () => {
      const fake = createFakeSupabase({
        tables: { projects: [publishedRow()] }
      });
      const wrapper = await mountListing(fake.client, "en");

      const tocLinks = wrapper
        .findAll(".page-toc__desktop a")
        .map(link => link.attributes("href"));
      expect(tocLinks).toEqual(["#featured", "#all"]);
    });
  });
});
