import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Component, Plugin } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";

import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import messages from "@/i18n";
import type { Database } from "@/types/database.types";

type Locale = keyof typeof messages;

export interface MountOptions {
  /** Locale used by the test i18n instance. Defaults to English. */
  locale?: Locale;
  /** Extra Vue plugins registered after Pinia, i18n and the router. */
  plugins?: Plugin[];
  /** Fake Supabase client provided to the component tree. Defaults to null. */
  supabase?: SupabaseClient<Database> | null;
  /** Initial route path for the memory-history router. Defaults to "/". */
  initialRoute?: string;
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
 * Pinia, vue-i18n and a memory-history router whose single route renders the
 * component under test. Tests that need different router state can append
 * their own plugin patterns later without duplicating this setup.
 */
export async function mountWithPlugins(
  component: Component,
  options: MountOptions = {}
) {
  const {
    locale = "en",
    plugins = [],
    supabase = null,
    initialRoute = "/"
  } = options;

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:locale(.*)?", component }]
  });

  await router.push(initialRoute);
  await router.isReady();

  const supabasePlugin: Plugin = {
    install(app) {
      app.provide(SUPABASE_CLIENT_KEY, supabase);
    }
  };

  return mount(component, {
    global: {
      plugins: [
        createPinia(),
        createTestI18n(locale),
        supabasePlugin,
        router,
        ...plugins
      ]
    }
  });
}
