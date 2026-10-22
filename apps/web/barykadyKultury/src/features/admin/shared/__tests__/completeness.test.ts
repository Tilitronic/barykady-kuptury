import { describe, expect, it } from "vitest";

import {
  formatCompletenessLabel,
  type CompletenessLabelKeys,
  type LocaleCompleteness
} from "@/features/admin/shared/completeness";
import { createTestI18n } from "@/test-utils/mount";

/**
 * T-028 gate fix — the completeness formatter lives in the neutral
 * `features/admin/shared` module so no feature has to import a sibling
 * feature's utility. The behaviour is the same branch proven by T-027; this
 * suite pins the neutral seam and its caller-supplied label set.
 */

const entry: LocaleCompleteness = {
  locale: "pl",
  complete: false,
  hasContent: true,
  missing: ["title", "body"]
};

const CONTENT_LABELS: CompletenessLabelKeys = {
  complete: "admin.content.completeness.complete",
  notStarted: "admin.content.completeness.notStarted",
  missing: "admin.content.completeness.missing",
  field: field => `admin.content.translation.${field}`
};

describe("shared completeness formatter", () => {
  it("renders a caller-specific namespace", () => {
    const t = createTestI18n("en").global.t;

    expect(formatCompletenessLabel(entry, t, CONTENT_LABELS)).toBe(
      "Missing: Title, Body"
    );
  });

  it("localizes the verdict across catalogues", () => {
    expect(
      formatCompletenessLabel(
        entry,
        createTestI18n("pl").global.t,
        CONTENT_LABELS
      )
    ).toBe("Brakuje: Tytuł, Treść");
    expect(
      formatCompletenessLabel(
        entry,
        createTestI18n("uk").global.t,
        CONTENT_LABELS
      )
    ).toBe("Відсутні: Заголовок, Текст");
  });
});
