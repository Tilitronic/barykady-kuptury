<template>
  <!--
    T-028 — site page preview (`/:locale/admin/pages/:pageKey/preview`).

    Renders the SAME body component as the public About page (`SitePageBody`)
    and resolves the translation with the same completeness/fallback policy, so
    an administrator reviews exactly what a visitor would get. The route is
    behind the admin guard and the `pages:write` capability, so drafts are
    never publicly reachable.
  -->
  <div class="admin-site-page-preview">
    <p class="admin-site-page-preview__back">
      <RouterLink
        :to="editPath"
        class="admin-site-page-preview__back-link focus-ring"
      >
        {{ t("admin.content.preview.back") }}
      </RouterLink>
    </p>

    <h1 class="admin-site-page-preview__heading">
      {{ t("admin.content.preview.title") }}
    </h1>

    <BkBanner
      class="admin-site-page-preview__banner"
      rounded
      role="note"
      data-testid="site-page-preview-banner"
    >
      {{ t("admin.content.preview.banner") }}
    </BkBanner>

    <p v-if="loading" class="admin-site-page-preview__state" role="status">
      {{ t("content.loading") }}
    </p>

    <BkBanner
      v-else-if="loadError !== null"
      class="admin-site-page-preview__banner"
      rounded
      role="status"
      aria-live="polite"
      data-testid="site-page-preview-error"
    >
      {{ loadErrorMessage }}
    </BkBanner>

    <template v-else-if="view !== null">
      <h2 class="admin-site-page-preview__page-title">{{ view.title }}</h2>
      <SitePageBody
        :body="view.body"
        :locale="currentLocale"
        :is-fallback="view.isFallback"
      />
    </template>

    <p
      v-else
      class="admin-site-page-preview__state"
      role="status"
      data-testid="site-page-preview-incomplete"
    >
      {{ t("admin.content.preview.incomplete") }}
    </p>
  </div>
</template>

<script setup lang="ts">
import type { SupabaseClient } from "@supabase/supabase-js";
import { computed, inject, onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import SitePageBody from "@/components/content/SitePageBody.vue";
import { BkBanner } from "@/components/bk";
import {
  fetchAdminSitePage,
  type AdminSitePage
} from "@/features/admin/content/api";
import {
  resolveSitePagePreview,
  type SitePagePreviewView
} from "@/features/admin/content/preview";
import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";
import type { Database } from "@/types/database.types";

const props = defineProps<{
  supabase?: SupabaseClient<Database> | null;
}>();

const { t } = useI18n();
const route = useRoute();
const injected = inject(SUPABASE_CLIENT_KEY, null);
const client = computed(() => props.supabase ?? injected);

const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

const pageKey = computed<string>(() => {
  const { pageKey } = route.params as { pageKey?: unknown };
  return typeof pageKey === "string" ? pageKey : "";
});

const page = ref<AdminSitePage | null>(null);
const loading = ref(true);
const loadError = ref<"not-found" | "unavailable" | "failed" | null>(null);

const editPath = computed(() => `/${currentLocale.value}/admin/pages`);

const view = computed<SitePagePreviewView | null>(() =>
  page.value === null
    ? null
    : resolveSitePagePreview(page.value, currentLocale.value)
);

const loadErrorMessage = computed(() =>
  loadError.value === "not-found"
    ? t("admin.content.errors.notFound")
    : t("admin.content.errors.loadFailed")
);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;

  if (client.value === null) {
    loadError.value = "unavailable";
    loading.value = false;
    return;
  }

  const result = await fetchAdminSitePage(client.value, pageKey.value);
  if (!result.ok) {
    loadError.value = result.code;
    loading.value = false;
    return;
  }

  page.value = result.page;
  loading.value = false;
}

onMounted(load);
</script>

<style scoped>
.admin-site-page-preview__back {
  margin: 0 0 1rem;
  font-size: var(--font-size-small);
}

.admin-site-page-preview__back-link {
  color: var(--color-link);
  text-decoration: none;
}

.admin-site-page-preview__back-link:hover {
  text-decoration: underline;
}

.admin-site-page-preview__heading {
  margin: 0 0 1rem;
  font-size: var(--font-size-h2);
  font-weight: 700;
}

.admin-site-page-preview__banner {
  display: block;
  margin-bottom: 1.5rem;
  padding: 0.75rem 1rem;
  border: 2px solid var(--color-accent);
  border-radius: 0.375rem;
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-weight: 600;
}

.admin-site-page-preview__page-title {
  max-width: 65ch;
  margin: 0 0 1.5rem;
  font-size: var(--font-size-h2);
}

.admin-site-page-preview__state {
  color: var(--color-text-muted);
}
</style>
