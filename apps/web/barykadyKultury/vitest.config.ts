import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

/**
 * Vitest compiles the application sources directly instead of going through a
 * Quasar build, so the aliases the source relies on are declared here:
 *
 * - `@` points at `src`, matching `tsconfig.json` and the Quasar build.
 * - `app` is Quasar's shorthand for the application root.
 * - `#q-app` maps to the `@quasar/app-vite` runtime wrapper module. This mirrors
 *   Quasar's own alias (`quasar-config-file.js`: `'#q-app': '@quasar/app-vite'`)
 *   whose package root resolves to `exports/wrappers.js`. Pointing it at the
 *   package's `/client` sub-path would resolve to a declaration file only.
 * - `^quasar$` maps to Quasar's **client** build. Without it Node resolution
 *   picks `quasar/dist/quasar.server.prod.js` (the `ssr` export condition wins
 *   under Vitest), whose plugin install aborts with "SSR server build was
 *   installed without an ssrContext" the moment a component test mounts
 *   anything that uses a Quasar component (T-024: `QSkeleton` on the Events
 *   page). The regex anchors the alias to the package root so sub-paths like
 *   `quasar/extras` keep their normal resolution.
 *
 * Everything else (Vue SFC compilation, happy-dom) is a deliberate test-only
 * concern and does not affect the production bundle.
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      // Array form: only here can `^quasar$` be a real RegExp — the object
      // form treats keys as string prefixes, which would also rewrite the
      // `quasar/extras` sub-path.
      {
        find: /^quasar$/,
        replacement: fileURLToPath(
          new URL(
            "./node_modules/quasar/dist/quasar.client.js",
            import.meta.url
          )
        )
      },
      { find: "#q-app", replacement: "@quasar/app-vite" },
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url))
      },
      {
        find: "app",
        replacement: fileURLToPath(new URL("./src", import.meta.url))
      }
    ]
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/__tests__/**/*.test.ts", "test/unit/**/*.test.ts"],
    restoreMocks: true,
    setupFiles: ["./test/unit/setup.ts"],
    // `quasar` must go through Vite's resolver, not Node's: the package's
    // `ssr` export condition would otherwise load quasar.server.prod.js (which
    // aborts plugin install without an ssrContext) and the `^quasar$` alias
    // above would never apply to it.
    server: {
      deps: {
        inline: ["quasar"]
      }
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,vue}"],
      exclude: [
        "src/**/__tests__/**",
        "src/test-utils/**",
        // Bootstrap wiring executed by Quasar, not unit-testable logic. The v8
        // remapper also cannot parse their type-only syntax when they are never
        // transformed by a test import, which would silently drop them anyway.
        "src/boot/**",
        "src/stores/**"
      ]
    }
  }
});
