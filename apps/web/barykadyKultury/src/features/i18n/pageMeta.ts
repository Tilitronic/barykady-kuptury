import { SUPPORTED_LOCALES } from "./locales";
import type { MessageKey } from "./messageKey";

/**
 * Per-route document metadata, expressed as catalogue keys so it stays typed and
 * translatable (docs/architecture.md §8). The guard resolves these against the
 * active locale.
 */
export interface LocalePageMeta {
  titleKey: MessageKey;
  descriptionKey: MessageKey;
}

const NOT_FOUND_META: LocalePageMeta = {
  titleKey: "notFound.title",
  descriptionKey: "notFound.description"
};

/**
 * Meta keyed by the locale-stripped path: the same page shares title and
 * description in every locale, and only the translation differs.
 */
const PAGE_META: Record<string, LocalePageMeta> = {
  "/": { titleKey: "home.title", descriptionKey: "home.description" },
  "/projects": {
    titleKey: "projects.title",
    descriptionKey: "projects.description"
  },
  "/404": NOT_FOUND_META
};

/** Matches a leading supported-locale segment (`/en`, `/pl`, `/uk`). */
const LOCALE_SEGMENT = new RegExp(
  `^/(?:${SUPPORTED_LOCALES.join("|")})(?=/|$)`
);

/** Removes a leading `/en`, `/pl` or `/uk` segment, if present. */
export function stripLocalePrefix(path: string): string {
  const match = LOCALE_SEGMENT.exec(path);
  if (!match) return path;

  const rest = path.slice(match[0].length);
  return rest === "" ? "/" : rest;
}

/**
 * Resolves route metadata from a path. Unknown paths fall back to the
 * not-found meta, which matches what the router renders for them.
 */
export function pageMetaForPath(path: string): LocalePageMeta {
  return PAGE_META[stripLocalePrefix(path)] ?? NOT_FOUND_META;
}

/**
 * Applies `document.title` and the description meta tag for the active route.
 * Creates the description tag when the shell did not provide one.
 */
export function applyPageMeta(
  doc: Document | null,
  meta: LocalePageMeta,
  translate: (key: MessageKey) => string
): void {
  if (!doc) return;

  doc.title = translate(meta.titleKey);

  let description = doc.querySelector('meta[name="description"]');
  if (!description) {
    description = doc.createElement("meta");
    description.setAttribute("name", "description");
    doc.head.appendChild(description);
  }
  description.setAttribute("content", translate(meta.descriptionKey));
}
