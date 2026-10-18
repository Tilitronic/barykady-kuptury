import type { MessageKey } from "./messageKey";

/**
 * Per-route document metadata, expressed as catalogue keys so it stays typed and
 * translatable (docs/architecture.md §8). The navigation guard resolves these
 * against the active locale.
 */
export interface LocalePageMeta {
  titleKey: MessageKey;
  descriptionKey: MessageKey;
}

/**
 * Metadata for paths the router does not know (global 404, unknown locale
 * sub-paths). Real routes carry their own `meta.pageMeta`; the guard falls back
 * to this only when a route has none.
 */
export const NOT_FOUND_META: LocalePageMeta = {
  titleKey: "notFound.title",
  descriptionKey: "notFound.description"
};

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
