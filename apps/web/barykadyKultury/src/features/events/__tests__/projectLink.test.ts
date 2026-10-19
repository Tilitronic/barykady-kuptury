import { describe, expect, it } from "vitest";

import { eventProjectPath } from "@/features/events/projectLink";
import type { EventProjectLink } from "@/features/events/api";

/**
 * The single implementation of the T-019 strict-slug rule for event→project
 * links (T-024 page + T-025 homepage both consume it): the URL always
 * contains its own locale's slug, so an English stand-in links under /en.
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

  it("moves an English stand-in under the English prefix", () => {
    expect(eventProjectPath(link({ isFallback: true }), "uk")).toBe(
      "/en/projects/sample-project"
    );
  });
});
