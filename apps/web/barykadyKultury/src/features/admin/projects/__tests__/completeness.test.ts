import { describe, expect, it } from "vitest";

import { formatCompletenessLabel } from "@/features/admin/projects/completeness";
import type { LocaleCompleteness } from "@/features/admin/projects/projectForm";
import type { Locale } from "@/features/i18n/locales";
import { createTestI18n } from "@/test-utils/mount";

/**
 * Spec axis: T-027 review finding #2 — the admin completeness indicator must
 * render LOCALIZED field names, not raw database keys (`title, summary, body`),
 * and the branching must live in one shared formatter used by both admin pages
 * (docs/PRODUCT_REQUIREMENTS.md §6: administrators see which translations are
 * missing; AGENTS.md rule 9: every user-facing string is localized en/pl/uk).
 */

const complete: LocaleCompleteness = {
  locale: "en",
  complete: true,
  hasContent: true,
  missing: []
};

const notStarted: LocaleCompleteness = {
  locale: "uk",
  complete: false,
  hasContent: false,
  missing: ["title", "summary", "body"]
};

/** Started but incomplete: title present, summary + body missing. */
const partial: LocaleCompleteness = {
  locale: "pl",
  complete: false,
  hasContent: true,
  missing: ["title", "body"]
};

function translate(locale: Locale) {
  return createTestI18n(locale).global.t;
}

describe("formatCompletenessLabel", () => {
  it("localizes the complete state in every catalogue", () => {
    expect(formatCompletenessLabel(complete, translate("en"))).toBe("Complete");
    expect(formatCompletenessLabel(complete, translate("pl"))).toBe(
      "Kompletna"
    );
    expect(formatCompletenessLabel(complete, translate("uk"))).toBe("Повний");
  });

  it("localizes the not-started state in every catalogue", () => {
    expect(formatCompletenessLabel(notStarted, translate("en"))).toBe(
      "Not started"
    );
    expect(formatCompletenessLabel(notStarted, translate("pl"))).toBe(
      "Nierozpoczęta"
    );
    expect(formatCompletenessLabel(notStarted, translate("uk"))).toBe(
      "Не розпочато"
    );
  });

  it("maps missing field keys to localized labels (en)", () => {
    expect(formatCompletenessLabel(partial, translate("en"))).toBe(
      "Missing: Title, Body"
    );
  });

  it("maps missing field keys to localized labels (pl)", () => {
    expect(formatCompletenessLabel(partial, translate("pl"))).toBe(
      "Brakuje: Tytuł, Treść"
    );
  });

  it("maps missing field keys to localized labels (uk)", () => {
    expect(formatCompletenessLabel(partial, translate("uk"))).toBe(
      "Відсутні: Заголовок, Текст"
    );
  });

  it("never leaks raw database keys into the user-facing string", () => {
    for (const locale of ["en", "pl", "uk"] as const) {
      const label = formatCompletenessLabel(partial, translate(locale));
      expect(label, locale).not.toMatch(/title|summary|body/u);
    }
  });
});
