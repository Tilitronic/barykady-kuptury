import { defineBoot } from "#q-app";

import { i18n } from "@/features/i18n/i18nInstance";

/**
 * Installs the shared i18n instance on the Vue app.
 *
 * The instance lives in `@/features/i18n/i18nInstance` so the router locale
 * guard mutates the same locale the components consume (T-009).
 */
export default defineBoot(({ app }) => {
  app.use(i18n);
});
