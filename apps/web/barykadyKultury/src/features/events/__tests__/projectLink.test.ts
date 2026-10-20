import { describe, expect, it } from "vitest";

import { eventProjectPath } from "@/features/events/projectLink";
import type { EventProjectLink } from "@/features/events/api";

/**
 * T-038/D-24: the project slug is canonical for every locale. The prefix
 * follows the language whose text is actually rendered — a same-locale event
 * project stays on the current prefix, while an English fallback title links
 * under /en because strict detail resolution 404s a locale without a
 * translation. The slug never changes.
 */

function link(overrides: Partial<EventProjectLink> = {}): EventProjectLink {
  return {
    calendarId: "fixture-calendar@example.org",
    googleEventId: "event-1",
    projectId: "00000000-0000-4000-8000-000000000201",
    slug: "sample-project",
    title: "Sample Project",
    isFallback: false,
    ...overrides
  };
}

describe("eventProjectPath", () => {
  it("returns null for a missing link (unpublished or absent project)", () => {
    expect(eventProjectPath(null, "en")).toBeNull();
  });

  it("keeps a same-locale link under the requested locale", () => {
    expect(eventProjectPath(link(), "pl")).toBe("/pl/projects/sample-project");
  });

  it("links an English fallback title under the English owning locale", () => {
    expect(eventProjectPath(link({ isFallback: true }), "uk")).toBe(
      "/en/projects/sample-project"
    );
  });
});
