import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

/**
 * Vitest compiles the application sources directly instead of going through a
 * Quasar build, so the aliases the source relies on are declared here:
 *
 * - `@` points at `src`, matching `tsconfig.json` and the Quasar build.
 * - `app` is Quasar's shorthand for the application root.
 * - `#q-app` maps to Quasar's client runtime export, the runtime counterpart of
 *   the type-only path declared in `.quasar/tsconfig.json` (which points at the
 *   `.d.ts` entry and therefore cannot be imported at runtime).
 *
 * Everything else (Vue SFC compilation, happy-dom) is a deliberate test-only
 * concern and does not affect the production bundle.
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "#q-app": "@quasar/app-vite/client",
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      app: fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/__tests__/**/*.test.ts", "test/unit/**/*.test.ts"],
    restoreMocks: true,
    setupFiles: ["./test/unit/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,vue}"],
      exclude: ["src/**/__tests__/**", "src/test-utils/**"]
    }
  }
});
