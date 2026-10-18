/**
 * Add types (that are not auto-magically added by Quasar CLI already)
 * for your custom variables to avoid TypeScript errors, like dynamic
 * process.env variables or definitions in dotenv files configured ONLY
 * for the /quasar.config file itself.
 *
 * https://quasar.dev/quasar-cli-vite/handling-import-meta-env#type-inference
 *
 * @example
 * interface ImportMetaEnv {
 *   readonly MY_VAR: string;
 *   readonly MY_OTHER_VAR: string;
 * }
 */
interface ImportMetaEnv {
  /**
   * T-015: browser-safe Supabase project URL and publishable key. Both are
   * optional at build time; the boot client degrades when either is absent.
   * Only these two publishable values belong in the client bundle.
   */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /**
   * T-021: enables the E2E-only contact fixture seam when set to `"enabled"`.
   * The Playwright build opts in so `e2e/contact.spec.ts` can prove the
   * configured-rendering branch without editing the verified organization
   * config. Absent in production, where the seam stays inert.
   *
   * The value is deliberately non-numeric: Quasar regenerates
   * `.quasar/quasar.d.ts` from the ambient environment and types numeric-looking
   * values as `number`, which would make a string comparison a type error.
   */
  readonly VITE_CONTACT_FIXTURE?: string;
}

/**
 * T-008: Vite resolves static SVG imports as URL strings.
 * Declaring this module type prevents TypeScript from rejecting
 * `import src from '@/assets/brand/logo_red.svg'`.
 */
declare module "*.svg" {
  const src: string;
  export default src;
}
