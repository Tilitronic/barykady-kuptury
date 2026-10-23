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
}

/**
 * T-032: build-time flag injected by `build.define` in quasar.config.ts.
 * True only in the Playwright build; every shipped build sets it to false.
 */
declare const __BK_E2E_CONTACT_FIXTURE__: boolean;

/**
 * T-008: Vite resolves static SVG imports as URL strings.
 * Declaring this module type prevents TypeScript from rejecting
 * `import src from '@/assets/brand/logo_red.svg'`.
 */
declare module "*.svg" {
  const src: string;
  export default src;
}
