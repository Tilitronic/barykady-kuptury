import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { Quasar } from "quasar";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Component, Plugin } from "vue";
import { createI18n } from "vue-i18n";
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw
} from "vue-router";

import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import messages from "@/i18n";
import type { Database } from "@/types/database.types";

type Locale = keyof typeof messages;

export interface MountOptions {
  /** Locale used by the test i18n instance. Defaults to English. */
  locale?: Locale;
  /** Props for the component under test (presentational components). */
  props?: Record<string, unknown>;
  /**
   * Slot content for the component under test, as raw HTML strings
   * (presentational components; T-025 SectionShell). Passed straight to
   * @vue/test-utils.
   */
  slots?: Record<string, string>;
  /** Extra Vue plugins registered after Pinia, i18n and the router. */
  plugins?: Plugin[];
  /** Fake Supabase client provided to the component tree. Defaults to null. */
  supabase?: SupabaseClient<Database> | null;
  /** Initial route path for the memory-history router. Defaults to "/". */
  initialRoute?: string;
  /**
   * Explicit route records for tests whose component reads named/typed route
   * params (e.g. the documents reader's `:slug`). Defaults to a single
   * catch-all that renders the component and exposes only `:locale`.
   */
  routes?: RouteRecordRaw[];
}

/**
 * Builds an i18n instance over the app's real message catalogues so tests
 * exercise the same translations the application ships.
 */
export function createTestI18n(locale: Locale = "en") {
  return createI18n({
    legacy: false,
    locale,
    messages
  });
}

/**
 * Mounts a component with the plugins every application component may assume:
 * Pinia, vue-i18n, the Quasar plugin (the app installs it globally — any
 * component may therefore reach for Quasar primitives like QItem), and a
 * memory-history router whose single route renders the component under test.
 * Tests that need different router state can append their own plugin patterns
 * later without duplicating this setup.
 */
export async function mountWithPlugins(
  component: Component,
  options: MountOptions = {}
) {
  const {
    locale = "en",
    props = {},
    slots,
    plugins = [],
    supabase = null,
    initialRoute = "/",
    routes
  } = options;

  const router = createRouter({
    history: createMemoryHistory(),
    routes: routes ?? [{ path: "/:locale(.*)?", component }]
  });

  await router.push(initialRoute);
  await router.isReady();

  const supabasePlugin: Plugin = {
    install(app) {
      app.provide(SUPABASE_CLIENT_KEY, supabase);
    }
  };

  return mount(component, {
    props,
    // VTU types `slots` as a required object shape; only pass it when the
    // test actually provides slot content.
    ...(slots ? { slots } : {}),
    global: {
      plugins: [
        createPinia(),
        createTestI18n(locale),
        supabasePlugin,
        router,
        Quasar,
        ...plugins
      ]
    }
  });
}
