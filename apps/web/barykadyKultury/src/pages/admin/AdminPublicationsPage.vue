<template>
  <!--
    T-029 — publication list (`/:locale/admin/publications`).

    Reads through `features/admin/publications`, never raw SQL. RLS grants
    `publications:write` the full table (drafts included); anonymous readers
    only ever receive published rows. Explicit loading/empty/error states; no
    optimistic rows (T-027 pattern).
  -->
  <div class="admin-publications">
    <div class="admin-publications__header">
      <h1 class="admin-publications__heading">
        {{ t("admin.publications.heading") }}
      </h1>
      <RouterLink
        :to="newPath"
        class="admin-publications__new focus-ring"
        data-testid="publications-new"
      >
        {{ t("admin.publications.newPublication") }}
      </RouterLink>
    </div>

    <p class="admin-publications__intro">
      {{ t("admin.publications.intro") }}
    </p>

    <p v-if="loading" class="admin-publications__state" role="status">
      {{ t("content.loading") }}
    </p>

    <UiBanner
      v-else-if="loadError !== null"
      class="admin-publications__banner"
      rounded
      role="status"
      aria-live="polite"
      data-testid="publications-error"
    >
      <p class="admin-publications__banner-text">{{ errorMessage }}</p>
      <UiBtn
        variant="flat"
        :label="t('admin.publications.retry')"
        data-testid="publications-retry"
        @click="load"
      />
    </UiBanner>

    <p
      v-else-if="publications.length === 0"
      class="admin-publications__state"
      data-testid="publications-empty"
    >
      {{ t("admin.publications.empty") }}
    </p>

    <table
      v-else
      class="admin-publications__table"
      data-testid="publications-table"
    >
      <caption class="sr-only">{{ t("admin.publications.heading") }}</caption>
      <thead>
        <tr>
          <th scope="col">{{ t("admin.publications.heading") }}</th>
          <th scope="col">{{ t("admin.publications.fields.status") }}</th>
          <th scope="col">{{ t("admin.publications.fields.files") }}</th>
          <th scope="col">{{ t("admin.publications.updatedLabel") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="publication in publications" :key="publication.id">
          <td>
            <RouterLink
              :to="editPath(publication.id)"
              class="admin-publications__link focus-ring"
              :data-testid="`publications-row-${publication.slug}`"
            >
              {{ displayTitle(publication) }}
            </RouterLink>
            <span class="admin-publications__slug">{{ publication.slug }}</span>
          </td>
          <td>{{ t(`admin.publications.statuses.${publication.status}`) }}</td>
          <td class="admin-publications__files">
            <template v-if="publication.files.length > 0">
              <span
                v-for="file in publication.files"
                :key="file.locale"
                class="admin-publications__file"
              >
                {{ LOCALE_LABELS[file.locale] }}
              </span>
            </template>
            <template v-else-if="publication.externalUrl">
              {{ t("admin.publications.fields.externalUrl") }}
            </template>
            <template v-else>—</template>
          </td>
          <td>
            <time :datetime="publication.updatedAt">{{
              formatted(publication.updatedAt)
            }}</time>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { SupabaseClient } from "@supabase/supabase-js";
import { computed, inject, onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import { UiBanner, UiBtn } from "@/components/ui";
import {
  fetchAdminPublications,
  type AdminPublication
} from "@/features/admin/publications/api";
import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import { formatDate } from "@/features/i18n/format";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_LABELS,
  type Locale
} from "@/features/i18n/locales";
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

const publications = ref<readonly AdminPublication[]>([]);
const loading = ref(true);
const loadError = ref<"unavailable" | "failed" | null>(null);

const newPath = computed(
  () => `/${currentLocale.value}/admin/publications/new`
);

const errorMessage = computed(() =>
  loadError.value === "unavailable"
    ? t("admin.publications.errors.unavailable")
    : t("admin.publications.listFailed")
);

function editPath(id: string): string {
  return `/${currentLocale.value}/admin/publications/${id}`;
}

function displayTitle(publication: AdminPublication): string {
  return publication.translations[DEFAULT_LOCALE].title || publication.slug;
}

function formatted(value: string): string {
  return formatDate(new Date(value), currentLocale.value, {
    dateStyle: "medium"
  });
}

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;

  const result = await fetchAdminPublications(client.value);
  if (result.ok) {
    publications.value = result.publications;
  } else {
    publications.value = [];
    loadError.value = result.code === "unavailable" ? "unavailable" : "failed";
  }

  loading.value = false;
}

onMounted(load);
</script>

<style scoped>
.admin-publications__header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem 1rem;
}

.admin-publications__heading {
  margin: 0;
  font-size: var(--font-size-h2);
  font-weight: 700;
}

.admin-publications__new {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  background: var(--color-accent);
  color: var(--color-accent-text);
  font-weight: 600;
  text-decoration: none;
}

.admin-publications__intro {
  max-width: 65ch;
  margin: 0.5rem 0 1.5rem;
  color: var(--color-text-muted);
}

.admin-publications__banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-danger);
  border-radius: 0.375rem;
  background: var(--color-surface-raised);
}

.admin-publications__banner-text {
  margin: 0;
  color: var(--color-danger);
  font-weight: 600;
}

.admin-publications__state {
  color: var(--color-text-muted);
}

.admin-publications__table {
  width: 100%;
  border-collapse: collapse;
}

.admin-publications__table th,
.admin-publications__table td {
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  text-align: start;
  vertical-align: top;
}

.admin-publications__link {
  color: var(--color-link);
  font-weight: 600;
}

.admin-publications__slug {
  display: block;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.admin-publications__files {
  font-size: var(--font-size-small);
}

.admin-publications__file + .admin-publications__file::before {
  content: " · ";
}
</style>
