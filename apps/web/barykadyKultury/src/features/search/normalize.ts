/**
 * Search text normalization (T-039).
 *
 * Why this exists:
 *   The navigation index is matched in the browser, where visitors type
 *   "projekty", "Projekty" or "projekt" and expect the same Polish section.
 *   Postgres `lower()` handles case but not the orthographic differences the
 *   three site languages expose. A single normalization rule keeps navigation
 *   matching consistent with what visitors type (docs/tickets/T-039 §Search
 *   contract: "case-insensitive, diacritic-insensitive token/prefix match").
 *
 * Rules:
 *   - NFKD + combining-mark removal folds Latin diacritics (ą → a, ć → c,
 *     ż → z) and the composed Cyrillic letters (ї → і, й → и).
 *   - Stroked/ligature letters that do not decompose are mapped explicitly
 *     (Polish ł → l, æ → ae, ß → ss).
 *   - Ukrainian apostrophes are orthographic, not searchable: they are removed
 *     so "п'ять" and "пять" collapse to the same token.
 *   - Everything that is not a letter or digit becomes a separator. Punctuation
 *     can therefore never change which tokens a phrase produces.
 *
 * Deliberately NOT here: stemming/lemmatization. The DB contract is literal
 * substring search, and adding a JS stemmer would make navigation match words
 * the content search cannot (or vice versa). Documented as a known limitation.
 */

/** Letters that NFKD does not split into base letter + combining mark. */
const SPECIAL_LETTERS: Readonly<Record<string, string>> = {
  ł: "l",
  đ: "d",
  ð: "d",
  ø: "o",
  æ: "ae",
  œ: "oe",
  ß: "ss",
  þ: "th",
  ı: "i",
  // Ukrainian: г and ґ are distinct letters, but visitors routinely type the
  // plain г; folding them makes search forgiving without changing content.
  ґ: "г"
};

/** Typographic apostrophes used in Polish/Ukrainian text, plus ASCII `'`. */
const APOSTROPHES = /[\u0027\u0060\u00b4\u2018\u2019\u02bc]/g;

/** Unicode combining marks left after NFKD. */
const COMBINING_MARKS = /\p{M}+/gu;

/** Anything that is not a Unicode letter or number. */
const NON_WORD = /[^\p{L}\p{N}]+/gu;

/**
 * Folds text to a comparable lowercase, accent-free, punctuation-free form.
 * Exported so content and navigation matching share exactly one rule.
 */
export function normalizeSearchText(input: string): string {
  return (
    input
      .normalize("NFKD")
      .replace(COMBINING_MARKS, "")
      .toLowerCase()
      .replace(APOSTROPHES, "")
      // These are letters, so they must be folded *before* the non-word pass.
      .replace(
        /[łđðøæœßþıґ]/g,
        character => SPECIAL_LETTERS[character] ?? character
      )
      .replace(NON_WORD, " ")
      .trim()
  );
}

/** Normalized tokens; an empty/blank input yields no tokens. */
export function tokenizeSearchText(input: string): string[] {
  const normalized = normalizeSearchText(input);
  return normalized.length === 0 ? [] : normalized.split(" ");
}

/**
 * True when every query token is a prefix of some token in `text`.
 *
 * AND semantics: "proj fea" matches "Projects — Featured", while "proj xyz"
 * does not. Prefix matching lets a visitor find "Mission" by typing "mis",
 * which is the expected behaviour of an instant filter.
 */
export function searchTextMatches(
  text: string,
  queryTokens: readonly string[]
): boolean {
  if (queryTokens.length === 0) return false;

  const haystack = tokenizeSearchText(text);
  if (haystack.length === 0) return false;

  return queryTokens.every(token =>
    haystack.some(candidate => candidate.startsWith(token))
  );
}
