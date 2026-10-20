import { describe, expect, it } from "vitest";

import {
  MAX_NAVIGATION_RESULTS,
  buildNavigationIndex,
  navigationRoute,
  publicationYearEntries,
  searchNavigation
} from "@/features/search/navigationIndex";
import type { NavigationTranslate } from "@/features/search/navigationIndex";
import messages from "@/i18n";
import type { Locale } from "@/features/i18n/locales";

/**
 * Navigation is the instant first section of the header search (T-039). It
 * must cover every consolidated page/section and return locale-prefixed
 * routes with anchors, without a network call.
 *
 * T-039 review fix (i18n): the registry is STRUCTURAL (id, kind, path,
 * keywords) — every display string resolves through the injected
 * `translate`, backed by the real `search.navEntries.*` catalogues. These
 * tests translate against the shipped catalogues, so a missing key fails
 * here instead of shipping a raw key in the dialog.
 */

/** Minimal key resolver over the REAL message catalogues (no Vue instance). */
function makeTranslate(locale: Locale): NavigationTranslate {
  const tree = messages[locale] as unknown as Record<string, unknown>;
  return (key: string, named?: Record<string, string | number>) => {
    const value = key
      .split(".")
      .reduce<unknown>(
        (acc, part) =>
          acc && typeof acc === "object"
            ? (acc as Record<string, unknown>)[part]
            : undefined,
        tree
      );
    if (typeof value !== "string") return key;
    if (!named) return value;
    return Object.entries(named).reduce(
      (text, [name, replacement]) =>
        text.replaceAll(`{${name}}`, String(replacement)),
      value
    );
  };
}

function nav(query: string, locale: Locale = "en") {
  return searchNavigation(query, locale, { translate: makeTranslate(locale) });
}

describe("searchNavigation", () => {
  it("returns no results for a blank query", () => {
    expect(nav("")).toEqual([]);
    expect(nav("   ")).toEqual([]);
  });

  it("finds top-level pages with locale-prefixed routes", () => {
    const [home] = nav("home");
    expect(home).toMatchObject({
      kind: "page",
      title: "Home",
      route: "/en"
    });

    const [projects] = nav("projekty", "pl");
    expect(projects).toMatchObject({
      title: "Projekty",
      route: "/pl/projects"
    });
  });

  it("finds About sections with stable anchors", () => {
    expect(nav("mission")[0]?.route).toBe("/en/about#mission");
    expect(nav("documents")[0]?.route).toBe("/en/about#documents");
    expect(nav("team")[0]?.route).toBe("/en/about#team");
  });

  it("finds area sections and calendar anchors", () => {
    expect(nav("featured")[0]?.route).toBe("/en/projects#featured");
    expect(nav("minione", "pl")[0]?.route).toBe("/pl/events#past");
    expect(nav("calendar")[0]?.route).toBe("/en/events#calendar");
  });

  it("finds homepage sections with homepage anchors", () => {
    expect(nav("explore")[0]?.route).toBe("/en#explore");
    expect(nav("misja", "pl").some(r => r.route === "/pl#mission")).toBe(true);
  });

  it("is diacritic-insensitive for Polish queries", () => {
    expect(nav("wyroznione", "pl")[0]?.route).toBe("/pl/projects#featured");
  });

  it("returns localized titles for the active locale", () => {
    expect(nav("team", "pl")[0]?.title).toBe("Zespół");
    expect(nav("team", "uk")[0]?.title).toBe("Команда");
  });

  it("returns localized descriptions from the catalogue", () => {
    const [about] = nav("abo");
    expect(about?.description).toBe(
      "Mission, history, values, aims, team and documents"
    );
  });

  it("degrades to the entry id when no translate is injected", () => {
    // The data layer never hard-codes display prose: without a resolver the
    // row still routes, the title falls back to the structural id.
    const [team] = searchNavigation("team", "en");
    expect(team?.title).toBe("about-team");
    expect(team?.route).toBe("/en/about#team");
  });

  it("ranks a title match above a keyword-only match", () => {
    const results = nav("about");
    expect(results[0]?.id).toBe("about");
  });

  it("caps the navigation section at five results", () => {
    const results = nav("events");
    expect(results.length).toBeLessThanOrEqual(MAX_NAVIGATION_RESULTS);
    expect(results.length).toBeGreaterThan(0);
  });

  it("appends publication year sections only when years are supplied", () => {
    expect(
      searchNavigation("2026", "en", { translate: makeTranslate("en") })
    ).toEqual([]);

    const [year] = searchNavigation("2026", "en", {
      publicationYears: [2026, 2025],
      translate: makeTranslate("en")
    });
    expect(year).toMatchObject({
      id: "publications-year-2026",
      kind: "section",
      title: "2026",
      route: "/en/publications#2026"
    });
    expect(year?.description).toBe("Publications from 2026");
  });
});

describe("registry helpers", () => {
  it("is structural: entries carry no display prose", () => {
    for (const entry of buildNavigationIndex()) {
      expect("titles" in entry, entry.id).toBe(false);
      expect("descriptions" in entry, entry.id).toBe(false);
    }
  });

  it("builds home and nested routes without a double slash", () => {
    expect(navigationRoute("en", "")).toBe("/en");
    expect(navigationRoute("uk", "#mission")).toBe("/uk#mission");
    expect(navigationRoute("pl", "projects#featured")).toBe(
      "/pl/projects#featured"
    );
  });

  it("deduplicates and orders year entries newest-first", () => {
    const entries = publicationYearEntries([2024, 2026, 2024, 2025]);
    expect(entries.map(entry => entry.id)).toEqual([
      "publications-year-2026",
      "publications-year-2025",
      "publications-year-2024"
    ]);
  });

  it("includes every contract area in the base registry", () => {
    const ids = buildNavigationIndex().map(entry => entry.id);

    for (const required of [
      "home",
      "about",
      "about-mission",
      "about-history",
      "about-values",
      "about-aims",
      "about-team",
      "about-documents",
      "projects",
      "projects-featured",
      "projects-all",
      "publications",
      "events",
      "events-upcoming",
      "events-past",
      "events-calendar",
      "support",
      "contact",
      "home-mission",
      "home-upcoming",
      "home-featured",
      "home-explore"
    ]) {
      expect(ids, required).toContain(required);
    }
  });

  it("every registry id has title and description keys in all catalogues", () => {
    for (const locale of ["en", "pl", "uk"] as const) {
      const translate = makeTranslate(locale);
      for (const entry of buildNavigationIndex({
        publicationYears: [2026]
      })) {
        // Year titles are the data digit itself (never chrome); only their
        // description resolves through the catalogue.
        if (entry.year === undefined) {
          const titleKey = `search.navEntries.${entry.id}.title`;
          const title = translate(titleKey);
          expect(title === titleKey, `${locale} ${entry.id} title`).toBe(false);
        }

        const descriptionKey = entry.year
          ? "search.navEntries.year.description"
          : `search.navEntries.${entry.id}.description`;
        const description = translate(descriptionKey);
        expect(
          description === descriptionKey,
          `${locale} ${entry.id} description`
        ).toBe(false);
      }
    }
  });
});
