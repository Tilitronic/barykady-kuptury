import { describe, expect, it } from "vitest";

import en from "@/i18n/en";
import pl from "@/i18n/pl";
import uk from "@/i18n/uk";

/**
 * Message-catalogue parity (T-009): every English key must exist in every
 * supported locale and no value may be blank. Parity is also enforced at
 * compile time via the `MessageSchema` type, but a runtime guard catches keys
 * added through unsafe casts or JS.
 */

type Catalogue = Record<string, unknown>;

function flattenKeys(catalogue: Catalogue, prefix = ""): string[] {
  return Object.entries(catalogue).flatMap(([key, value]) => {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    return typeof value === "object" && value !== null
      ? flattenKeys(value as Catalogue, path)
      : [path];
  });
}

function valueAt(catalogue: Catalogue, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, segment) =>
        typeof node === "object" && node !== null
          ? (node as Catalogue)[segment]
          : undefined,
      catalogue
    );
}

describe("message catalogue parity", () => {
  const englishKeys = flattenKeys(en as Catalogue).sort();

  it("provides every English key in Polish and Ukrainian", () => {
    expect(flattenKeys(pl as Catalogue).sort()).toEqual(englishKeys);
    expect(flattenKeys(uk as Catalogue).sort()).toEqual(englishKeys);
  });

  it("has no empty values in any catalogue", () => {
    for (const [locale, catalogue] of Object.entries({ en, pl, uk })) {
      for (const key of flattenKeys(catalogue as Catalogue)) {
        const value = valueAt(catalogue as Catalogue, key);
        expect(
          typeof value === "string" && value.trim().length > 0,
          `${locale}:${key} must be a non-empty string`
        ).toBe(true);
      }
    }
  });
});
