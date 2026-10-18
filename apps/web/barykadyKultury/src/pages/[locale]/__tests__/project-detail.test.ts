import { describe, expect, it } from "vitest";
import { nextTick } from "vue";

import ProjectDetailPage from "@/pages/[locale]/project-detail.vue";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * Spec axis: docs/tickets/T-019-projects-public.md — the detail renders one
 * h1, localized rich text with `lang`, the cover with a meaningful alt and
 * explicit dimensions, and a fallback note only when English text is actually
 * substituted. Slug resolution is STRICT on (requestedLocale, slug): an
 * English slug on a Polish URL and any draft slug render the 404 content,
 * never the project and never a silent cross-locale match (ticket line 16).
 */

const EN_TRANSLATION = {
  locale: "en",
  slug: "sample-community-workshop",
  title: "Sample Community Workshop (EN)",
  summary: "Summary (EN)",
  body: "## Section\n\nEN body."
};

const PL_TRANSLATION = {
  locale: "pl",
  slug: "przykladowy-warsztat-spoleczny",
  title: "Przykładowy warsztat społeczny",
  summary: "Podsumowanie (PL)",
  body: "## Sekcja\n\nPL body."
};

function publishedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000201",
    status: "published",
    featured_rank: 1,
    cover_path: "fixtures/projects/sample-cover.webp",
    start_date: "2026-01-10",
    end_date: "2026-03-20",
    updated_at: "2026-02-01T00:00:00Z",
    project_translations: [EN_TRANSLATION, PL_TRANSLATION],
    ...overrides
  };
}

async function mountDetail(
  supabase: ReturnType<typeof createFakeSupabase>["client"] | null,
  locale: "en" | "pl" | "uk",
  slug: string
) {
  const wrapper = await mountWithPlugins(ProjectDetailPage, {
    locale,
    supabase,
    initialRoute: `/${locale}/projects/${slug}`,
    routes: [
      {
        path: "/:locale(en|pl|uk)/projects/:slug",
        name: "project-detail",
        component: ProjectDetailPage
      },
      {
        path: "/:locale(en|pl|uk)/projects",
        name: "projects",
        component: { template: "<div />" }
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

describe("project detail", () => {
  it("renders the localized project with one h1 and lang-marked rich text", async () => {
    const fake = createFakeSupabase({ tables: { projects: [publishedRow()] } });
    const wrapper = await mountDetail(
      fake.client,
      "pl",
      "przykladowy-warsztat-spoleczny"
    );

    expect(wrapper.findAll("h1")).toHaveLength(1);
    expect(wrapper.get("h1").text()).toBe("Przykładowy warsztat społeczny");
    expect(wrapper.text()).toContain("PL body.");
    expect(wrapper.find(".localized-rich-text").attributes("lang")).toBe("pl");
    // Exact (locale, slug) match: no fallback note.
    expect(wrapper.find(".project-detail__fallback").exists()).toBe(false);
  });

  it("renders the cover with a meaningful alt and explicit dimensions", async () => {
    const fake = createFakeSupabase({ tables: { projects: [publishedRow()] } });
    const wrapper = await mountDetail(
      fake.client,
      "en",
      "sample-community-workshop"
    );

    const img = wrapper.get(".project-detail__cover");
    expect(img.attributes("alt")).toBe("Sample Community Workshop (EN)");
    expect(img.attributes("width")).toBe("1280");
    expect(img.attributes("height")).toBe("720");
    expect(img.attributes("src")).toContain(
      "public-media/fixtures/projects/sample-cover.webp"
    );
  });

  it("renders both dates when present", async () => {
    const fake = createFakeSupabase({ tables: { projects: [publishedRow()] } });
    const wrapper = await mountDetail(
      fake.client,
      "en",
      "sample-community-workshop"
    );

    const times = wrapper.findAll(".project-detail__dates time");
    expect(times).toHaveLength(2);
    expect(times[0]!.attributes("datetime")).toBe("2026-01-10");
    expect(times[1]!.attributes("datetime")).toBe("2026-03-20");
  });

  it("shows the localized lifecycle status on the detail (T-019 review)", async () => {
    const fake = createFakeSupabase({ tables: { projects: [publishedRow()] } });
    const en = await mountDetail(
      fake.client,
      "en",
      "sample-community-workshop"
    );
    expect(en.get(".project-detail__status").text()).toBe("Published");

    const plWrapper = await mountDetail(
      fake.client,
      "pl",
      "przykladowy-warsztat-spoleczny"
    );
    expect(plWrapper.get(".project-detail__status").text()).toBe(
      "Opublikowany"
    );
  });

  it("links back to the listing under the current locale", async () => {
    const fake = createFakeSupabase({ tables: { projects: [publishedRow()] } });
    const wrapper = await mountDetail(
      fake.client,
      "pl",
      "przykladowy-warsztat-spoleczny"
    );

    expect(wrapper.get(".project-detail__back-link").attributes("href")).toBe(
      "/pl/projects"
    );
    expect(wrapper.get(".project-detail__back-link").text()).toBe(
      "Powrót do projektów"
    );
  });

  it("names the source language when the English body stands in for an incomplete requested translation", async () => {
    // The (uk, slug) pair exists so the strict match succeeds, but the uk
    // text is incomplete: the English body substitutes and the note appears.
    const ukSlugOnly = {
      locale: "uk",
      slug: "zrazkova-hromadska-maisternia",
      title: "Зразкова майстерня",
      summary: null,
      body: null
    };
    const fake = createFakeSupabase({
      tables: {
        projects: [
          publishedRow({ project_translations: [EN_TRANSLATION, ukSlugOnly] })
        ]
      }
    });
    const wrapper = await mountDetail(
      fake.client,
      "uk",
      "zrazkova-hromadska-maisternia"
    );

    expect(wrapper.text()).toContain("EN body.");
    expect(wrapper.find(".localized-rich-text").attributes("lang")).toBe("en");
    expect(wrapper.get(".project-detail__fallback").text()).toContain(
      "англійською"
    );
  });

  it("renders the 404 content — not the project — when an English slug is used on a Polish URL", async () => {
    const fake = createFakeSupabase({ tables: { projects: [publishedRow()] } });
    const wrapper = await mountDetail(
      fake.client,
      "pl",
      "sample-community-workshop"
    );

    expect(wrapper.get("h1").text()).toBe("Nie znaleziono strony");
    expect(wrapper.text()).toContain("Żądana strona nie została znaleziona.");
    expect(wrapper.text()).not.toContain("Sample Community Workshop");
    expect(wrapper.find(".localized-rich-text").exists()).toBe(false);
  });

  it("renders the 404 content for a draft slug even when the payload leaks it", async () => {
    const draft = publishedRow({
      id: "00000000-0000-4000-8000-000000000202",
      status: "draft",
      project_translations: [
        { ...EN_TRANSLATION, slug: "sample-draft-project", title: "DRAFT LEAK" }
      ]
    });
    const fake = createFakeSupabase({
      tables: { projects: [publishedRow(), draft] }
    });
    const wrapper = await mountDetail(
      fake.client,
      "en",
      "sample-draft-project"
    );

    expect(wrapper.get("h1").text()).toBe("Page not found");
    expect(wrapper.text()).not.toContain("DRAFT LEAK");
  });

  it("renders the 404 content for an unknown slug", async () => {
    const fake = createFakeSupabase({ tables: { projects: [publishedRow()] } });
    const wrapper = await mountDetail(fake.client, "en", "no-such-project");

    expect(wrapper.get("h1").text()).toBe("Page not found");
  });

  it("shows the unavailable state without a client", async () => {
    const wrapper = await mountDetail(null, "en", "any");

    expect(wrapper.text()).toContain("temporarily unavailable");
  });
});
