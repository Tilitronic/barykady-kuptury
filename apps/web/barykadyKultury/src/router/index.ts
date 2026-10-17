import { defineRouter } from "#q-app";
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory
} from "vue-router";

import { getBrowserLanguages } from "@/features/i18n/browserLocale";
import { i18n } from "@/features/i18n/i18nInstance";
import { createLocaleGuard } from "@/features/i18n/localeGuard";
import { localeStore } from "@/features/i18n/localeStorage";

import { routes } from "./routes";

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default defineRouter((/* { store, ssrContext } */) => {
  const createHistory = import.meta.env.QUASAR_SERVER
    ? createMemoryHistory
    : import.meta.env.QUASAR_VUE_ROUTER_MODE === "history"
      ? createWebHistory
      : createWebHashHistory;

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(import.meta.env.QUASAR_VUE_ROUTER_BASE)
  });

  // Mirror the active locale onto document lang/dir, the i18n locale and the
  // route title/description (docs/DESIGN_SYSTEM.md §6, docs/architecture.md §8).
  // The guard is read-only with respect to the persisted choice.
  Router.beforeEach(
    createLocaleGuard({
      doc: typeof document === "undefined" ? null : document,
      store: localeStore,
      getLanguages: getBrowserLanguages,
      setLocale: locale => {
        i18n.global.locale.value = locale;
      },
      translate: key => i18n.global.t(key)
    })
  );

  return Router;
});
