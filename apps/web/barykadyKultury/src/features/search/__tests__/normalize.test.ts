import { describe, expect, it } from "vitest";

import {
  normalizeSearchText,
  searchTextMatches,
  tokenizeSearchText
} from "@/features/search/normalize";

/**
 * Normalization is the shared vocabulary of both search sources (T-039). These
 * cases pin the three site languages: Polish diacritics (including the
 * non-decomposing ł), Cyrillic folding for Ukrainian, and punctuation.
 */
describe("normalizeSearchText", () => {
  it("lowercases and keeps plain words intact", () => {
    expect(normalizeSearchText("Projekty")).toBe("projekty");
  });

  it("folds Polish diacritics, including ł which NFKD does not decompose", () => {
    expect(normalizeSearchText("Wyróżnione projekty")).toBe(
      "wyroznione projekty"
    );
    expect(normalizeSearchText("Łódź")).toBe("lodz");
    expect(normalizeSearchText("Ćwiczenie żółwia")).toBe("cwiczenie zolwia");
  });

  it("folds Ukrainian Cyrillic letters and removes apostrophes", () => {
    expect(normalizeSearchText("Їжак")).toBe("іжак");
    expect(normalizeSearchText("п'ять")).toBe("пять");
    expect(normalizeSearchText("Ґанок")).toBe("ганок");
  });

  it("turns punctuation and anchors into token separators", () => {
    expect(normalizeSearchText("About #team!")).toBe("about team");
    expect(normalizeSearchText("projekty/wydarzenia")).toBe(
      "projekty wydarzenia"
    );
  });

  it("returns an empty string for blank or punctuation-only input", () => {
    expect(normalizeSearchText("   ")).toBe("");
    expect(normalizeSearchText("%%%")).toBe("");
  });
});

describe("tokenizeSearchText", () => {
  it("splits normalized text and collapses repeated separators", () => {
    expect(tokenizeSearchText("  Featured   projects  ")).toEqual([
      "featured",
      "projects"
    ]);
  });

  it("returns no tokens for an empty query", () => {
    expect(tokenizeSearchText("")).toEqual([]);
  });
});

describe("searchTextMatches", () => {
  it("matches every query token as a prefix of a candidate token", () => {
    expect(searchTextMatches("Featured projects", ["fea", "proj"])).toBe(true);
    expect(searchTextMatches("Łódź publications", ["lodz"])).toBe(true);
  });

  it("uses AND semantics across tokens", () => {
    expect(searchTextMatches("Featured projects", ["fea", "xyz"])).toBe(false);
  });

  it("does not match a blank query", () => {
    expect(searchTextMatches("Featured projects", [])).toBe(false);
  });
});
