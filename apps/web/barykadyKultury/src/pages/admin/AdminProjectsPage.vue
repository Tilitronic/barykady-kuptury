<template>
  <!--
    T-027 — admin project list (`/:locale/admin/projects`).

    Reads through the feature data-access module (`features/admin/projects`),
    never raw SQL. RLS grants an admin the full table (drafts included) while
    anonymous callers only ever receive published rows (T-013). Explicit
    loading / empty / error states (docs/TESTING.md §2); no optimistic rows.
  -->
  <div class="admin-projects">
    <div class="admin-projects__header">
      <h1 class="admin-projects__heading">{{ t("admin.projects.heading") }}</h1>
      <RouterLink
        :to="newProjectPath"
        class="admin-projects__new focus-ring"
        data-testid="projects-new"
      >
        {{ t("admin.projects.newProject") }}
      </RouterLink>
    </div>

    <p class="admin-projects__intro">{{ t("admin.projects.intro") }}</p>

    <div class="admin-projects__filter">
      <UiSelect
        v-model="statusFilter"
        :options="filterOptions"
        emit-value
        map-options
        :label="t('admin.projects.filterLabel')"
        data-testid="projects-filter"
        @update:model-value="load"
      />
    </div>

    <UiBanner
      v-if="loadError !== null"
      class="admin-projects__banner"
      rounded
      role="status"
      aria-live="polite"
      data-testid="projects-error"
    >
      <p class="admin-projects__banner-text">{{ errorMessage }}</p>
      <UiBtn
        variant="flat"
        :label="t('admin.projects.retry')"
        data-testid="projects-retry"
        @click="load"
      />
    </UiBanner>

    <p v-else-if="loading" class="admin-projects__state" role="status">
      {{ t("content.loading") }}
    </p>

    <p
      v-else-if="projects.length === 0"
      class="admin-projects__state"
      data-testid="projects-empty"
    >
      {{ t("admin.projects.empty") }}
    </p>

    <table v-else class="admin-projects__table" data-testid="projects-table">
      <caption class="sr-only">{{ t("admin.projects.heading") }}</caption>
      <thead>
        <tr>
          <th scope="col">{{ t("admin.projects.heading") }}</th>
          <th scope="col">{{ t("admin.projects.fields.status") }}</th>
          <th scope="col">{{ t("admin.projects.completeness.label") }}</th>
          <th scope="col">{{ t("admin.projects.updatedLabel") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="project in projects" :key="project.id">
          <td>
            <RouterLink
              :to="editPath(project.id)"
              class="admin-projects__link focus-ring"
              :data-testid="`projects-row-${project.slug}`"
            >
              {{ displayTitle(project) }}
            </RouterLink>
            <span class="admin-projects__slug">{{ project.slug }}</span>
          </td>
          <td>
            {{ t(`admin.projects.statuses.${project.status}`) }}
          </td>
          <td>
            <ul class="admin-projects__locales">
              <li
                v-for="entry in translationCompleteness(project)"
                :key="entry.locale"
              >
                <span class="admin-projects__locale-code">
                  {{ entry.locale.toUpperCase() }}
                </span>
                <span class="admin-projects__locale-state">
                  {{ formatCompletenessLabel(entry, t) }}
                </span>
              </li>
            </ul>
          </td>
          <td>
            <time :datetime="project.updatedAt">{{
              formatted(project.updatedAt)
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

import { UiBanner, UiBtn, UiSelect } from "@/components/ui";
import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import {
  fetchAdminProjects,
  type AdminProject
} from "@/features/admin/projects/api";
import { formatCompletenessLabel } from "@/features/admin/projects/completeness";
import {
  translationCompleteness,
  type ProjectStatus
} from "@/features/admin/projects/projectForm";
import { formatDate } from "@/features/i18n/format";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";
import type { Database } from "@/types/database.types";

/**
 * The listing mirrors the public listing's data shape but reads the admin
 * module so drafts/archived rows are included for authorized admins. The
 * status filter is applied in the query, not by filtering a full download.
 */
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

type Filter = ProjectStatus | "all";

const statusFilter = ref<Filter>("all");
const projects = ref<readonly AdminProject[]>([]);
const loading = ref(true);
const loadError = ref<"unavailable" | "failed" | null>(null);

const filterOptions = computed(() => [
  { label: t("admin.projects.filterAll"), value: "all" },
  { label: t("admin.projects.statuses.draft"), value: "draft" },
  { label: t("admin.projects.statuses.published"), value: "published" },
  { label: t("admin.projects.statuses.archived"), value: "archived" }
]);

const errorMessage = computed(() =>
  loadError.value === "unavailable"
    ? t("admin.projects.errors.unavailable")
    : t("admin.projects.listFailed")
);

const newProjectPath = computed(
  () => `/${currentLocale.value}/admin/projects/new`
);

function editPath(id: string): string {
  return `/${currentLocale.value}/admin/projects/${id}`;
}

/** The fallback (English) title is the admin's stable identifier for a row. */
function displayTitle(project: AdminProject): string {
  return project.translations[DEFAULT_LOCALE].title || project.slug;
}

function formatted(value: string): string {
  return formatDate(new Date(value), currentLocale.value, {
    dateStyle: "medium"
  });
}

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;

  const result = await fetchAdminProjects(client.value, {
    status: statusFilter.value === "all" ? null : statusFilter.value
  });

  if (result.ok) {
    projects.value = result.projects;
  } else {
    projects.value = [];
    loadError.value = result.code === "unavailable" ? "unavailable" : "failed";
  }

  loading.value = false;
}

onMounted(load);
</script>

<style scoped>
.admin-projects__header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem 1rem;
}

.admin-projects__heading {
  margin: 0;
  font-size: var(--font-size-h2);
  font-weight: 700;
}

.admin-projects__new {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  background: var(--color-accent);
  color: var(--color-accent-text);
  font-weight: 600;
  text-decoration: none;
}

.admin-projects__intro {
  margin: 0.5rem 0 1.5rem;
  max-width: 65ch;
  color: var(--color-text-muted);
}

.admin-projects__filter {
  max-width: 20rem;
  margin-bottom: 1.5rem;
}

.admin-projects__banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-danger);
  border-radius: 0.375rem;
  background: var(--color-surface-raised);
}

.admin-projects__banner-text {
  margin: 0;
  color: var(--color-danger);
  font-weight: 600;
}

.admin-projects__state {
  color: var(--color-text-muted);
}

.admin-projects__table {
  width: 100%;
  border-collapse: collapse;
}

.admin-projects__table th,
.admin-projects__table td {
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  text-align: start;
  vertical-align: top;
}

.admin-projects__link {
  color: var(--color-link);
  font-weight: 600;
}

.admin-projects__slug {
  display: block;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.admin-projects__locales {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--font-size-small);
}

.admin-projects__locale-code {
  font-weight: 700;
}

.admin-projects__locale-state {
  color: var(--color-text-muted);
}
</style>
