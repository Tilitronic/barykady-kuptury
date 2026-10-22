import { describe, expect, it } from "vitest";

import type { AdminProject } from "@/features/admin/projects/api";
import { resolvePreviewProject } from "@/features/admin/projects/preview";
import { mapProjectDetail } from "@/features/projects/api";

/**
 * Spec axis: T-027 review finding #1 (Critical/Spec + High/Arch) — the admin
 * preview must resolve a translation with the SAME policy as the public detail
 * page (`selectTranslation` + `PROJECT_REQUIRED_FIELDS`: title + summary + body,
 * English fallback). A title-only heuristic previews content the public page
 * would 404 or fall back on, breaking the T-027 promise that the preview
 * "renders the public detail component" and docs/architecture.md §4 ("only
 * complete translations intended for publication should be presented").
 */

function adminProject(overrides: Partial<AdminProject> = {}): AdminProject {
  return {
    id: "00000000-0000-4000-8000-000000000201",
    slug: "spring-workshop",
    status: "draft",
    featured: false,
    featuredRank: null,
    coverPath: null,
    startDate: null,
    endDate: null,
    publishedAt: null,
    updatedAt: "2026-05-01T00:00:00Z",
    translations: {
      en: { title: "EN Title", summary: "EN Summary", body: "EN Body" },
      // Started but incomplete: title only.
      pl: { title: "PL Tytuł", summary: "", body: "" },
      uk: { title: "", summary: "", body: "" }
    },
    ...overrides
  };
}

describe("resolvePreviewProject", () => {
  it("resolves the requested locale when it is complete", () => {
    const source = adminProject({
      translations: {
        en: { title: "EN Title", summary: "EN Summary", body: "EN Body" },
        pl: { title: "PL Tytuł", summary: "PL Opis", body: "PL Treść" },
        uk: { title: "", summary: "", body: "" }
      }
    });

    const view = resolvePreviewProject(source, "pl", null);

    expect(view).not.toBeNull();
    expect(view?.title).toBe("PL Tytuł");
    expect(view?.isFallback).toBe(false);
  });

  it("falls back to the complete English translation when the requested locale is incomplete", () => {
    const view = resolvePreviewProject(adminProject(), "pl", null);

    // The requested (pl) translation has a title but no summary/body, so it is
    // NOT complete: the preview must show English with the fallback flag — the
    // same thing the public detail page would show.
    expect(view?.title).toBe("EN Title");
    expect(view?.body).toBe("EN Body");
    expect(view?.isFallback).toBe(true);
  });

  it("resolves a draft (the published gate is the public query's job)", () => {
    const view = resolvePreviewProject(
      adminProject({ status: "draft" }),
      "en",
      null
    );

    expect(view?.status).toBe("draft");
    expect(view?.title).toBe("EN Title");
  });

  it("returns null when no translation is complete (public detail would 404)", () => {
    const source = adminProject({
      translations: {
        en: { title: "EN Title", summary: "", body: "" },
        pl: { title: "PL Tytuł", summary: "", body: "" },
        uk: { title: "", summary: "", body: "" }
      }
    });

    expect(resolvePreviewProject(source, "en", null)).toBeNull();
    expect(resolvePreviewProject(source, "pl", null)).toBeNull();
  });

  it("carries the resolved cover URL through to the view", () => {
    const view = resolvePreviewProject(adminProject(), "en", "https://x/cover");

    expect(view?.coverUrl).toBe("https://x/cover");
  });

  it("matches the public detail resolution exactly (parity)", () => {
    // Same content, expressed as the public row shape. The preview must select
    // the same translation and the same isFallback flag as `mapProjectDetail`.
    const publicRow = {
      id: "00000000-0000-4000-8000-000000000201",
      slug: "spring-workshop",
      status: "published",
      featured_rank: null,
      cover_path: null,
      start_date: null,
      end_date: null,
      published_at: null,
      updated_at: "2026-05-01T00:00:00Z",
      project_translations: [
        {
          locale: "en",
          title: "EN Title",
          summary: "EN Summary",
          body: "EN Body"
        },
        { locale: "pl", title: "PL Tytuł", summary: "", body: "" }
      ]
    };

    const expected = mapProjectDetail(publicRow as never, "pl");
    const preview = resolvePreviewProject(
      adminProject({ status: "published" }),
      "pl",
      null
    );

    expect(expected).not.toBeNull();
    expect(preview).toMatchObject({
      title: expected!.title,
      summary: expected!.summary,
      body: expected!.body,
      isFallback: expected!.isFallback
    });
  });
});
