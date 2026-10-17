import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import type { Component, Plugin } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";

import messages from "@/i18n";

type Locale = keyof typeof messages;

export interface MountOptions {
  /** Locale used by the test i18n instance. Defaults to English. */
  locale?: Locale;
  /** Extra Vue plugins registered after Pinia, i18n and the router. */
  plugins?: Plugin[];
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
export function mountWithPlugins(
  component: Component,
  options: MountOptions = {}
) {
  const { locale = "en", plugins = [] } = options;

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component }]
  });

  return mount(component, {
    global: {
      plugins: [createPinia(), createTestI18n(locale), router, ...plugins]
    }
  });
}
