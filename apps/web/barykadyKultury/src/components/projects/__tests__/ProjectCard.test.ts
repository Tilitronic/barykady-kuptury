import { describe, expect, it } from "vitest";

import ProjectCard from "@/components/projects/ProjectCard.vue";
import type { ProjectSummaryView } from "@/features/projects/useProjects";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * Spec axis: docs/tickets/T-019-projects-public.md — the card matrix: optional
 * cover, optional dates, long titles, real-anchor links with the localized
 * slug. Status lives on the detail page, not the card (T-019 review): the
 * published-only listing would repeat one uniform badge on every card.
 */

function projectView(
  overrides: Partial<ProjectSummaryView> = {}
): ProjectSummaryView {
  return {
    id: "00000000-0000-4000-8000-000000000201",
    status: "published",
    slug: "warsztat-spoleczny",
    title: "Warsztat społeczny",
    summary: "Podsumowanie projektu.",
    body: "Treść projektu.",
    isFallback: false,
    featuredRank: null,
    coverPath: null,
    coverUrl: null,
    startDate: null,
    endDate: null,
    updatedAt: "2026-02-01T00:00:00Z",
    ...overrides
  };
}

async function mountCard(
  project: ProjectSummaryView,
  options: { href?: string; locale?: "en" | "pl" | "uk" } = {}
) {
  const {
    href = `/${options.locale ?? "pl"}/projects/${project.slug}`,
    locale = "pl"
  } = options;

  return mountWithPlugins(ProjectCard, {
    locale,
    props: { project, href },
    initialRoute: href
  });
}

describe("ProjectCard", () => {
  it("links the title to the localized slug as a real anchor", async () => {
    const wrapper = await mountCard(projectView());

    const link = wrapper.get(".project-card__link");
    expect(link.element.tagName).toBe("A");
    expect(link.attributes("href")).toBe("/pl/projects/warsztat-spoleczny");
    expect(wrapper.get(".project-card__title").text()).toBe(
      "Warsztat społeczny"
    );
  });

  // M1 (T-025 review): homepage cards sit under section h2s and ask for h3
  // titles; the projects listing keeps the default h2 outline.
  it("renders the title as h3 when headingLevel is 3", async () => {
    const wrapper = await mountWithPlugins(ProjectCard, {
      locale: "pl",
      props: {
        project: projectView(),
        href: "/pl/projects/warsztat-spoleczny",
        locale: "pl",
        headingLevel: 3
      },
      initialRoute: "/pl/projects"
    });

    expect(wrapper.findAll("h2")).toHaveLength(0);
    expect(wrapper.get(".project-card__title").element.tagName).toBe("H3");
  });

  it("renders without a cover: no img element at all", async () => {
    const wrapper = await mountCard(projectView({ coverUrl: null }));

    expect(wrapper.find("img").exists()).toBe(false);
  });

  it("gives the card cover an empty alt (decorative inside the named link) with explicit dimensions", async () => {
    const wrapper = await mountCard(
      projectView({
        coverPath: "fixtures/projects/cover.webp",
        coverUrl: "https://cdn.test/fixtures/projects/cover.webp"
      })
    );

    const img = wrapper.get(".project-card__cover");
    expect(img.attributes("alt")).toBe("");
    expect(img.attributes("width")).toBe("640");
    expect(img.attributes("height")).toBe("360");
    expect(img.attributes("loading")).toBe("lazy");
  });

  it("omits the dates block when both dates are absent", async () => {
    const wrapper = await mountCard(projectView());

    expect(wrapper.find(".project-card__dates").exists()).toBe(false);
  });

  it("renders a date range when both dates are present", async () => {
    const wrapper = await mountCard(
      projectView({ startDate: "2026-01-10", endDate: "2026-03-20" })
    );

    const times = wrapper.findAll(".project-card__dates time");
    expect(times).toHaveLength(2);
    expect(times[0]!.attributes("datetime")).toBe("2026-01-10");
    expect(times[1]!.attributes("datetime")).toBe("2026-03-20");
    expect(times[0]!.text().length).toBeGreaterThan(0);
  });

  it("renders a single time when only the start date exists", async () => {
    const wrapper = await mountCard(projectView({ startDate: "2026-01-10" }));

    expect(wrapper.findAll(".project-card__dates time")).toHaveLength(1);
  });

  it("renders a long title in full without truncation", async () => {
    const longTitle =
      "Międzynarodowy program wymiany młodzieży i warsztatów międzykulturowych " +
      "„Mosty” realizowany wspólnie z partnerami lokalnymi";

    const wrapper = await mountCard(projectView({ title: longTitle }));

    expect(wrapper.get(".project-card__title").text()).toBe(longTitle);
  });

  it("collapses an absent summary without placeholder dashes", async () => {
    const wrapper = await mountCard(projectView({ summary: null }));

    expect(wrapper.find(".project-card__summary").exists()).toBe(false);
  });

  it("names the source language when the English translation stands in", async () => {
    const wrapper = await mountCard(
      projectView({
        title: "Community Workshop",
        summary: "Summary (EN)",
        isFallback: true
      }),
      { locale: "uk" }
    );

    expect(wrapper.get(".project-card__fallback").text()).toContain(
      "англійською"
    );
  });
});
