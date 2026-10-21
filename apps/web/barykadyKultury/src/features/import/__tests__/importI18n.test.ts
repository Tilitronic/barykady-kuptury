import { describe, expect, it } from "vitest";

import en from "@/i18n/en";
import pl from "@/i18n/pl";
import uk from "@/i18n/uk";

/**
 * T-041 localization contract.
 *
 * The converter/worker boundary carries stable codes only; the admin UI must
 * always find a message for every code. Catalogue parity (EN/PL/UK) is covered
 * by the global i18n test; this test pins the import-specific code list.
 */
const ERROR_CODES = [
  "emptyFile",
  "fileTooLarge",
  "invalidSize",
  "invalidFileName",
  "unsupportedExtension",
  "unsupportedMime",
  "mimeExtensionMismatch",
  "activeContent",
  "odtDeferred",
  "docmRejected",
  "docxUnsafeZip",
  "docxMacros",
  "docxInvalid",
  "emptyDocument",
  "conversionFailed",
  "conversionTimeout"
] as const;

const ISSUE_CODES = [
  "rawHtmlDropped",
  "unsafeLink",
  "remoteImageStripped",
  "imageUnresolved",
  "nestedListFlattened",
  "unsupportedFormatting",
  "imageAltMissing",
  "imageUnsupported",
  "docxWarning"
] as const;

describe("import message catalogue", () => {
  it.each([
    ["en", en],
    ["pl", pl],
    ["uk", uk]
  ] as const)(
    "covers every error and issue code in %s",
    (_locale, catalogue) => {
      for (const code of ERROR_CODES) {
        expect(catalogue.import.errors).toHaveProperty(code);
      }
      for (const code of ISSUE_CODES) {
        expect(catalogue.import.warnings).toHaveProperty(code);
      }
    }
  );

  it("keeps the ODT and DOCM guidance actionable (save as DOCX)", () => {
    expect(en.import.errors.odtDeferred).toContain(".docx");
    expect(en.import.errors.docmRejected).toContain(".docx");
    expect(pl.import.errors.odtDeferred).toContain(".docx");
    expect(uk.import.errors.odtDeferred).toContain(".docx");
  });
});
