import { describe, expect, it } from "vitest";
import { nextTick } from "vue";

import ProjectsPage from "@/pages/[locale]/projects.vue";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * Spec axis: docs/tickets/T-019-projects-public.md — the listing shows only
 * published projects with a translated empty state, links each card to the
 * slug's owning locale (strict (locale, slug) resolution — never a dead link,
 * never a silent cross-locale slug match), and hides draft rows even when the
 * payload leaks them.
 */

const EN_TRANSLATION = {
  locale: "en",
  slug: "sample-community-workshop",
  title: "Sample Community Workshop (EN)",
  summary: "Summary (EN)",
  body: "Body (EN)"
};

const PL_TRANSLATION = {
  locale: "pl",
  slug: "przykladowy-warsztat-spoleczny",
  title: "Przykładowy warsztat społeczny (PL)",
  summary: "Podsumowanie (PL)",
  body: "Treść (PL)"
};

function publishedRow() {
  return {
    id: "00000000-0000-4000-8000-000000000201",
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
    status: "draft",
    featured_rank: null,
    cover_path: null,
    start_date: null,
    end_date: null,
    updated_at: "2026-02-02T00:00:00Z",
    project_translations: [
      { ...EN_TRANSLATION, slug: "sample-draft-project", title: "DRAFT LEAK" }
    ]
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

    expect(wrapper.findAll(".project-card")).toHaveLength(1);
    expect(wrapper.text()).toContain("Przykładowy warsztat społeczny (PL)");
    expect(wrapper.text()).not.toContain("DRAFT LEAK");
  });

  it("links a same-locale card to the localized slug under the requested locale", async () => {
    const fake = createFakeSupabase({ tables: { projects: [publishedRow()] } });
    const wrapper = await mountListing(fake.client, "pl");

    expect(wrapper.get(".project-card__link").attributes("href")).toBe(
      "/pl/projects/przykladowy-warsztat-spoleczny"
    );
  });

  it("links an English-stand-in card to the English prefix, never a dead Polish URL", async () => {
    // Ukrainian has no translation: the card shows English text (with a note)
    // and must link where that slug actually resolves — strict (locale, slug)
    // resolution would 404 a /uk/…/sample-community-workshop link.
    const fake = createFakeSupabase({
      tables: {
        projects: [
          { ...publishedRow(), project_translations: [EN_TRANSLATION] }
        ]
      }
    });
    const wrapper = await mountListing(fake.client, "uk");

    expect(wrapper.get(".project-card__link").attributes("href")).toBe(
      "/en/projects/sample-community-workshop"
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

  it("keeps exactly one h1 and one h2 per card", async () => {
    const fake = createFakeSupabase({ tables: { projects: [publishedRow()] } });
    const wrapper = await mountListing(fake.client, "en");

    expect(wrapper.findAll("h1")).toHaveLength(1);
    expect(wrapper.findAll("h2")).toHaveLength(1);
  });

  it("shows the unavailable state without a client", async () => {
    const wrapper = await mountListing(null, "en");

    expect(wrapper.text()).toContain("temporarily unavailable");
  });
});
