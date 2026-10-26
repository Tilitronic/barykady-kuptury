<template>
  <!--
    T-027 — draft preview (`/:locale/admin/projects/:id/preview`).

    Renders the SAME component the public detail page uses
    (`components/projects/ProjectDetailBody`), so what an administrator
    reviews is exactly what a visitor will get. A persistent banner states that
    the content is a draft, and the route itself is behind the admin guard
    (`requiresAdmin`) so it is never publicly reachable.
  -->
  <div class="admin-project-preview">
    <p class="admin-project-preview__back">
      <RouterLink
        :to="editPath"
        class="admin-project-preview__back-link focus-ring"
      >
        {{ t("admin.projects.preview.back") }}
      </RouterLink>
    </p>

    <h1 class="admin-project-preview__heading">
      {{ t("admin.projects.preview.title") }}
    </h1>

    <BkBanner
      class="admin-project-preview__banner"
      rounded
      role="note"
      data-testid="preview-banner"
    >
      {{ t("admin.projects.preview.banner") }}
    </BkBanner>

    <p v-if="loading" class="admin-project-preview__state" role="status">
      {{ t("content.loading") }}
    </p>

    <BkBanner
      v-else-if="loadError !== null"
      class="admin-project-preview__banner"
      rounded
      role="status"
      aria-live="polite"
      data-testid="preview-error"
    >
      {{ loadErrorMessage }}
    </BkBanner>

    <ProjectDetailBody
      v-else-if="view !== null"
      :project="view"
      :locale="currentLocale"
    />

    <!--
      No locale has a complete translation yet (title + summary + body), so the
      public page would render 404 content. The preview states that plainly
      instead of showing a half-translated draft as if it were publishable
      (docs/architecture.md §4).
    -->
    <p
      v-else
      class="admin-project-preview__state"
      role="status"
      data-testid="preview-incomplete"
    >
      {{ t("admin.projects.preview.incomplete") }}
    </p>
  </div>
</template>

<script setup lang="ts">
import type { SupabaseClient } from "@supabase/supabase-js";
import { computed, inject, onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import ProjectDetailBody from "@/components/projects/ProjectDetailBody.vue";
import { BkBanner } from "@/components/bk";
import {
  fetchAdminProject,
  type AdminProject
} from "@/features/admin/projects/api";
import { resolvePreviewProject } from "@/features/admin/projects/preview";
import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import { projectCoverUrl } from "@/features/projects/cover";
import type { ProjectSummaryView } from "@/features/projects/useProjects";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";
import type { Database } from "@/types/database.types";

/**
 * Read-only preview.
 *
 * The translation is resolved by `resolvePreviewProject`, which delegates to the
 * SAME shared selector the public detail page uses (`selectTranslation` with
 * `PROJECT_REQUIRED_FIELDS`). The preview therefore shows exactly the locale and
 * fallback a visitor would get — including the English fallback note when the
 * requested locale is incomplete (T-027 review finding #1).
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

const projectId = computed<string>(() => {
  const { id } = route.params as { id?: unknown };
  return typeof id === "string" ? id : "";
});

const project = ref<AdminProject | null>(null);
const loading = ref(true);
const loadError = ref<"not-found" | "unavailable" | "failed" | null>(null);

const editPath = computed(
  () => `/${currentLocale.value}/admin/projects/${projectId.value}`
);

const loadErrorMessage = computed(() =>
  loadError.value === "not-found"
    ? t("admin.projects.errors.notFound")
    : t("admin.projects.errors.loadFailed")
);

const view = computed<ProjectSummaryView | null>(() =>
  project.value === null
    ? null
    : resolvePreviewProject(
        project.value,
        currentLocale.value,
        projectCoverUrl(client.value, project.value.coverPath)
      )
);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;

  if (client.value === null) {
    loadError.value = "unavailable";
    loading.value = false;
    return;
  }

  const result = await fetchAdminProject(client.value, projectId.value);
  if (!result.ok) {
    loadError.value = result.code;
    loading.value = false;
    return;
  }

  project.value = result.project;
  loading.value = false;
}

onMounted(load);
</script>

<style scoped>
.admin-project-preview__back {
  margin: 0 0 1rem;
  font-size: var(--font-size-small);
}

.admin-project-preview__back-link {
  color: var(--color-link);
  text-decoration: none;
}

.admin-project-preview__back-link:hover {
  text-decoration: underline;
}

.admin-project-preview__heading {
  margin: 0 0 1rem;
  font-size: var(--font-size-h2);
  font-weight: 700;
}

/* Draft banner: bordered strip with text — the state never relies on color. */
.admin-project-preview__banner {
  display: block;
  margin-bottom: 1.5rem;
  padding: 0.75rem 1rem;
  border: 2px solid var(--color-accent);
  border-radius: 0.375rem;
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-weight: 600;
}

.admin-project-preview__state {
  color: var(--color-text-muted);
}
</style>
