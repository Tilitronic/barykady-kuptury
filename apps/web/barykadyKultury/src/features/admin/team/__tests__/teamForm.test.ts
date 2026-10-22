import { describe, expect, it } from "vitest";

import {
  emptyTeamMemberForm,
  hasTeamMemberFormErrors,
  teamMemberTranslationsForSave,
  teamTranslationCompleteness,
  updateTeamTranslation,
  validateTeamMemberForm
} from "@/features/admin/team/teamForm";

/**
 * T-028 — team member form rules.
 *
 * Design authority:
 *   - docs/PRODUCT_REQUIREMENTS.md §4-About: name plus OPTIONAL role/bio and
 *     portrait; never fabricate missing fields.
 *   - docs/architecture.md §4: the name is locale-independent; role/bio are
 *     localized and both optional.
 *
 * "Complete" for a locale therefore means "a translator has supplied role or
 * bio"; an untouched locale is reported as not started instead of as an error,
 * because nothing is required.
 */

describe("team member form", () => {
  it("requires a locale-independent name", () => {
    const errors = validateTeamMemberForm(emptyTeamMemberForm());

    expect(errors.name).toBe("required");
    expect(hasTeamMemberFormErrors(errors)).toBe(true);
  });

  it("accepts a member with no role or bio", () => {
    const state = { ...emptyTeamMemberForm(), name: "Anna Kowalska" };

    expect(hasTeamMemberFormErrors(validateTeamMemberForm(state))).toBe(false);
  });

  it("reports locales with no localized text as not started", () => {
    const state = {
      ...emptyTeamMemberForm(),
      name: "Anna Kowalska",
      translations: {
        ...emptyTeamMemberForm().translations,
        en: { role: "Chair", bio: "" },
        pl: { role: "", bio: "" },
        uk: { role: "", bio: "Біографія" }
      }
    };

    const entries = teamTranslationCompleteness(state);

    expect(entries.find(entry => entry.locale === "en")).toMatchObject({
      complete: true,
      hasContent: true
    });
    expect(entries.find(entry => entry.locale === "pl")).toMatchObject({
      complete: false,
      hasContent: false,
      missing: []
    });
    expect(entries.find(entry => entry.locale === "uk")).toMatchObject({
      complete: true,
      hasContent: true
    });
  });

  it("preserves other locales when editing one", () => {
    const initial = {
      ...emptyTeamMemberForm(),
      translations: {
        ...emptyTeamMemberForm().translations,
        en: { role: "Chair", bio: "" }
      }
    };

    const next = updateTeamTranslation(initial, "pl", {
      role: "Przewodnicząca",
      bio: ""
    });

    expect(initial.translations.pl).toEqual({ role: "", bio: "" });
    expect(next.translations.en).toEqual({ role: "Chair", bio: "" });
    expect(next.translations.pl).toEqual({
      role: "Przewodnicząca",
      bio: ""
    });
  });

  it("always persists an English row so the public mapper can resolve a card", () => {
    const state = { ...emptyTeamMemberForm(), name: "Anna Kowalska" };

    expect(teamMemberTranslationsForSave(state)).toEqual([
      { locale: "en", role: null, bio: null }
    ]);
  });

  it("drops blank non-English locales and trims supplied text", () => {
    const state = {
      ...emptyTeamMemberForm(),
      name: "Anna Kowalska",
      translations: {
        ...emptyTeamMemberForm().translations,
        en: { role: " Chair ", bio: " Bio " },
        pl: { role: "   ", bio: "" },
        uk: { role: "", bio: "Біо" }
      }
    };

    expect(teamMemberTranslationsForSave(state)).toEqual([
      { locale: "en", role: "Chair", bio: "Bio" },
      { locale: "uk", role: null, bio: "Біо" }
    ]);
  });
});
