import { describe, expect, it } from "vitest";

import {
  publicLinkPolicy,
  type PublicLinkProject
} from "@/features/admin/events/publicLinkPolicy";

/**
 * T-031 — the admin-visible public-link policy.
 *
 * docs/architecture.md §4: an event link may point at a draft project in the
 * admin, but public output may only include the link when the project AND the
 * selected translation are published. The public data mapper already enforces
 * this; this module is the same rule in a form the admin UI can explain, so an
 * administrator sees *why* a draft assignment produces no public link.
 *
 * The rule must never drift between the admin preview and the public join:
 * both call `selectTranslation` with the same required-field list.
 */

function project(
  overrides: Partial<PublicLinkProject> = {}
): PublicLinkProject {
  return {
    slug: "sample-project",
    status: "published",
    translations: [{ locale: "en", title: "Sample Project" }],
    ...overrides
  };
}

describe("publicLinkPolicy", () => {
  it("emits no link for an unassigned event", () => {
    expect(publicLinkPolicy(null, "en")).toEqual({
      public: false,
      path: null,
      reason: "unlinked"
    });
  });

  it("emits a link for a published project with the requested translation", () => {
    expect(
      publicLinkPolicy(
        project({
          translations: [
            { locale: "en", title: "Sample Project" },
            { locale: "pl", title: "Przykladowy projekt" }
          ]
        }),
        "pl"
      )
    ).toEqual({
      public: true,
      path: "/pl/projects/sample-project",
      reason: "published"
    });
  });

  it("links an English fallback from the English prefix", () => {
    expect(publicLinkPolicy(project(), "uk")).toEqual({
      public: true,
      path: "/en/projects/sample-project",
      reason: "published"
    });
  });

  it("never links a draft assignment publicly", () => {
    expect(publicLinkPolicy(project({ status: "draft" }), "en")).toEqual({
      public: false,
      path: null,
      reason: "draft"
    });
  });

  it("never links an archived project publicly", () => {
    expect(publicLinkPolicy(project({ status: "archived" }), "en")).toEqual({
      public: false,
      path: null,
      reason: "archived"
    });
  });

  it("reports a published project with no usable translation", () => {
    expect(publicLinkPolicy(project({ translations: [] }), "en")).toEqual({
      public: false,
      path: null,
      reason: "missing-translation"
    });
  });
});
