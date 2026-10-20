import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";

/**
 * Reader content-language resolution (T-040, D-27/D-38).
 *
 * Precedence is frozen: requested `?lang` (only when a readable translation
 * exists) → UI locale → English → the first available translation. The
 * resolver is pure so the URL-normalization decision and the selected locale
 * are testable without a router or Supabase.
 *
 * `shouldNormalize` is true only when the URL carries a `lang` value that is
 * not the resolved one. An absent `?lang` is the normal/default case and must
 * not be added to the URL; canonical/hreflang work (T-034) owns that policy.
 */
export interface ReaderLocaleInput {
  readonly requested: string | null | undefined;
  readonly uiLocale: Locale;
  readonly available: readonly Locale[];
}

export interface ReaderLocaleResolution {
  readonly locale: Locale;
  readonly shouldNormalize: boolean;
}

export function resolveReaderLocale(
  input: ReaderLocaleInput
): ReaderLocaleResolution {
  const requested = input.requested?.trim() ?? "";
  const requestedLocale = isLocale(requested) ? requested : null;
  const available = [...new Set(input.available)];

  const byRequest =
    requestedLocale && available.includes(requestedLocale)
      ? requestedLocale
      : null;
  const byUi = available.includes(input.uiLocale) ? input.uiLocale : null;
  const byEnglish = available.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : null;
  const fallback = byRequest ?? byUi ?? byEnglish ?? available[0] ?? null;

  // No readable translation at all: keep a valid Locale for the model/URL
  // while the composable reports `unsupported`.
  const locale = fallback ?? input.uiLocale;

  return {
    locale,
    shouldNormalize: requested !== "" && requested !== locale
  };
}
