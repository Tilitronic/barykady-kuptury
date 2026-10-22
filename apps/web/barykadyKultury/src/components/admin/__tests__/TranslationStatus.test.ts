import { describe, expect, it } from "vitest";

import TranslationStatus from "@/components/admin/TranslationStatus.vue";
import type { CompletenessLabelKeys } from "@/features/admin/shared/completeness";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * T-028 gate fix — one shared presentation component for the per-locale
 * completeness verdict, so the project, site-page and team editors cannot
 * drift in markup or accessibility semantics.
 */

const LABELS: CompletenessLabelKeys = {
  complete: "admin.projects.completeness.complete",
  notStarted: "admin.projects.completeness.notStarted",
  missing: "admin.projects.completeness.missing",
  field: field => `admin.projects.translation.${field}`
};

describe("TranslationStatus", () => {
  it("renders the complete verdict as text (never color alone)", async () => {
    const wrapper = await mountWithPlugins(TranslationStatus, {
      props: {
        entry: { locale: "en", complete: true, hasContent: true, missing: [] },
        labels: LABELS
      }
    });

    expect(wrapper.text()).toBe("Complete");
  });

  it("renders the missing fields through localized field labels", async () => {
    const wrapper = await mountWithPlugins(TranslationStatus, {
      props: {
        entry: {
          locale: "pl",
          complete: false,
          hasContent: true,
          missing: ["title", "body"]
        },
        labels: LABELS
      }
    });

    expect(wrapper.text()).toBe("Missing: Title, Body");
  });
});
