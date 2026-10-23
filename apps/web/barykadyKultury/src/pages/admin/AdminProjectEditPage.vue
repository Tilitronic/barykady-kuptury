<template>
  <!--
    T-027 — project create/edit (`/:locale/admin/projects/new` and `/:locale/admin/projects/:id`).

    Contract notes:
      * every mutation goes through `features/admin/projects` — this page never
        builds a query (T-027 review gate, docs/architecture.md §3);
      * NO optimistic UI: a status change is only reflected after the awaited
        mutation resolves and the row is re-read (docs/PRODUCT_REQUIREMENTS.md §6);
      * validation runs at the trust boundary (the form) and again in the
        database (RLS + constraints), and every failure is recoverable;
      * per-locale completeness is visible while editing (T-031 reuses it).
  -->
  <div class="admin-project-edit">
    <p class="admin-project-edit__back">
      <RouterLink
        :to="listPath"
        class="admin-project-edit__back-link focus-ring"
      >
        {{ t("admin.projects.actions.back") }}
      </RouterLink>
    </p>

    <h1 class="admin-project-edit__heading">
      {{ isNew ? t("admin.projects.newProject") : t("admin.projects.heading") }}
    </h1>

    <p v-if="loading" class="admin-project-edit__state" role="status">
      {{ t("content.loading") }}
    </p>

    <UiBanner
      v-else-if="loadError !== null"
      class="admin-project-edit__banner"
      rounded
      role="status"
      aria-live="polite"
      data-testid="project-load-error"
    >
      {{ loadErrorMessage }}
    </UiBanner>

    <form
      v-else
      novalidate
      class="admin-project-edit__form"
      @submit.prevent="submit('save')"
    >
      <!-- ── Root fields ─────────────────────────────────────────────────── -->
      <div class="admin-project-edit__grid">
        <UiInput
          v-model="values.slug"
          :label="t('admin.projects.fields.slug')"
          :hint="t('admin.projects.fields.slugHint')"
          :error="errors.slug !== null"
          :error-message="slugErrorText"
          data-testid="project-slug"
        />

        <UiSelect
          v-model="values.status"
          :options="statusOptions"
          emit-value
          map-options
          :label="t('admin.projects.fields.status')"
          data-testid="project-status"
        />

        <UiInput
          v-model="values.startDate"
          type="date"
          :label="t('admin.projects.fields.startDate')"
          :error="errors.startDate !== null"
          :error-message="t('admin.projects.errors.startDateInvalid')"
          data-testid="project-start-date"
        />

        <UiInput
          v-model="values.endDate"
          type="date"
          :label="t('admin.projects.fields.endDate')"
          :error="errors.endDate !== null"
          :error-message="t('admin.projects.errors.endDateBeforeStart')"
          data-testid="project-end-date"
        />
      </div>

      <div class="admin-project-edit__featured">
        <UiCheckbox
          v-model="values.featured"
          :label="t('admin.projects.fields.featured')"
          data-testid="project-featured"
        />
        <p class="admin-project-edit__hint">
          {{ t("admin.projects.fields.featuredHint") }}
        </p>
      </div>

      <div class="admin-project-edit__cover">
        <label class="admin-project-edit__label" for="project-cover">
          {{ t("admin.projects.fields.cover") }}
        </label>
        <input
          id="project-cover"
          class="admin-project-edit__file"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          data-testid="project-cover"
          @change="onCoverChange"
        />
        <p class="admin-project-edit__hint">
          {{ t("admin.projects.fields.coverHint") }}
        </p>
        <p v-if="coverName !== ''" class="admin-project-edit__hint">
          {{ t("admin.projects.fields.coverSelected", { name: coverName }) }}
        </p>
        <p
          v-else-if="values.coverPath !== null"
          class="admin-project-edit__hint"
        >
          {{ t("admin.projects.fields.coverCurrent") }}
        </p>
      </div>

      <!-- ── Per-locale tabs ─────────────────────────────────────────────── -->
      <div class="admin-project-edit__tabs">
        <h2 class="admin-project-edit__section-title">
          {{ t("admin.projects.tabs.label") }}
        </h2>

        <div
          class="admin-project-edit__tablist"
          role="tablist"
          :aria-label="t('admin.projects.tabs.label')"
          @keydown="onTabKeydown"
        >
          <button
            v-for="locale in SUPPORTED_LOCALES"
            :id="`project-tab-${locale}`"
            :key="locale"
            type="button"
            role="tab"
            class="admin-project-edit__tab focus-ring"
            :class="{
              'admin-project-edit__tab--active': activeLocale === locale
            }"
            :aria-selected="activeLocale === locale"
            :aria-controls="`project-panel-${locale}`"
            :tabindex="activeLocale === locale ? 0 : -1"
            :data-testid="`project-tab-${locale}`"
            @click="activeLocale = locale"
          >
            {{ t(`admin.projects.tabs.${locale}`) }}
            <TranslationStatus
              class="admin-project-edit__tab-state"
              :entry="completenessByLocale[locale]"
              :labels="PROJECT_COMPLETENESS_LABELS"
            />
          </button>
        </div>

        <div
          :id="`project-panel-${activeLocale}`"
          role="tabpanel"
          :aria-labelledby="`project-tab-${activeLocale}`"
          tabindex="0"
          class="admin-project-edit__panel"
        >
          <UiInput
            v-model="activeTranslation.title"
            :label="t('admin.projects.translation.title')"
            :error="translationError('title')"
            :error-message="t('admin.projects.errors.translationTitleRequired')"
            data-testid="project-title"
          />

          <UiInput
            v-model="activeTranslation.summary"
            type="textarea"
            autogrow
            :label="t('admin.projects.translation.summary')"
            data-testid="project-summary"
          />

          <UiInput
            v-model="activeTranslation.body"
            type="textarea"
            autogrow
            :label="t('admin.projects.translation.body')"
            :hint="t('admin.projects.translation.bodyHint')"
            data-testid="project-body"
          />
        </div>
      </div>

      <!-- ── Actions ─────────────────────────────────────────────────────── -->
      <div class="admin-project-edit__actions">
        <UiBtn
          type="submit"
          :label="
            pending === 'save'
              ? t('admin.projects.actions.saving')
              : t('admin.projects.actions.save')
          "
          :loading="pending === 'save'"
          :disable="pending !== null"
          data-testid="project-save"
        />

        <UiBtn
          v-if="values.status !== 'published'"
          variant="outline"
          :label="
            pending === 'publish'
              ? t('admin.projects.actions.publishing')
              : t('admin.projects.actions.publish')
          "
          :disable="pending !== null"
          data-testid="project-publish"
          @click="submit('publish')"
        />
        <UiBtn
          v-else
          variant="outline"
          :label="
            pending === 'unpublish'
              ? t('admin.projects.actions.unpublishing')
              : t('admin.projects.actions.unpublish')
          "
          :disable="pending !== null"
          data-testid="project-unpublish"
          @click="unpublish"
        />

        <UiBtn
          v-if="values.status !== 'archived'"
          variant="flat"
          :label="
            pending === 'archive'
              ? t('admin.projects.actions.archiving')
              : t('admin.projects.actions.archive')
          "
          :disable="pending !== null || isNew"
          data-testid="project-archive"
          @click="archive"
        />

        <UiBtn
          v-if="!isNew"
          variant="flat"
          :label="t('admin.projects.actions.preview')"
          :disable="pending !== null"
          data-testid="project-preview"
          @click="openPreview"
        />

        <UiBtn
          v-if="!isNew"
          variant="flat"
          :label="
            pending === 'delete'
              ? t('admin.projects.actions.deleting')
              : t('admin.projects.actions.delete')
          "
          :disable="pending !== null"
          data-testid="project-delete"
          @click="openDeleteDialog"
        />
      </div>

      <!--
        Single polite live region for the mutation outcome. It persists in the
        DOM so the first announcement is reliable and the text (never color
        alone) carries the meaning (DESIGN_SYSTEM.md §6).
      -->
      <p
        class="admin-project-edit__status"
        :class="{
          'admin-project-edit__status--error': statusKind === 'error',
          'admin-project-edit__status--success': statusKind === 'success'
        }"
        role="status"
        aria-live="polite"
        data-testid="project-status-message"
      >
        {{ statusMessage }}
      </p>
    </form>

    <UiConfirmDialog
      v-model="deleteOpen"
      :title="t('admin.projects.deleteDialog.title')"
      :message="t('admin.projects.deleteDialog.message')"
      :confirm-label="t('admin.projects.deleteDialog.confirm')"
      :cancel-label="t('admin.projects.actions.cancel')"
      danger
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import type { SupabaseClient } from "@supabase/supabase-js";
import { computed, inject, nextTick, onMounted, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import TranslationStatus from "@/components/admin/TranslationStatus.vue";
import {
  UiBanner,
  UiBtn,
  UiCheckbox,
  UiConfirmDialog,
  UiInput,
  UiSelect
} from "@/components/ui";
import {
  archiveProject,
  deleteProject,
  fetchAdminProject,
  publishProject,
  saveProject,
  unpublishProject,
  type AdminProject
} from "@/features/admin/projects/api";
import { PROJECT_COMPLETENESS_LABELS } from "@/features/admin/projects/completeness";
import type { LocaleCompleteness } from "@/features/admin/shared/completeness";
import {
  emptyProjectForm,
  hasFormErrors,
  translationCompleteness,
  validateProjectForm,
  type ProjectFormErrors,
  type ProjectFormValues
} from "@/features/admin/projects/projectForm";
import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import { PUBLIC_MEDIA_BUCKET } from "@/features/files/buckets";
import { useUpload } from "@/features/files/useUpload";
import {
  DEFAULT_LOCALE,
  isLocale,
  SUPPORTED_LOCALES,
  type Locale
} from "@/features/i18n/locales";
import type { Database } from "@/types/database.types";

/**
 * The editor.
 *
 * Status is a first-class field *and* has explicit lifecycle actions: "Save"
 * persists the selected status (running the publish gate when that status is
 * published), while Publish/Unpublish/Archive are single-purpose transitions.
 * A published project can never be saved without a complete fallback locale —
 * the same rule the public read path relies on.
 */
const props = defineProps<{
  supabase?: SupabaseClient<Database> | null;
}>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const injected = inject(SUPABASE_CLIENT_KEY, null);
const client = computed(() => props.supabase ?? injected);

const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

const projectId = computed<string | null>(() => {
  const { id } = route.params as { id?: unknown };
  return typeof id === "string" && id !== "new" ? id : null;
});

const isNew = computed(() => projectId.value === null);

const values = ref<ProjectFormValues>(emptyProjectForm());
const errors = ref<ProjectFormErrors>(
  validateProjectForm(emptyProjectForm(), { mode: "draft" })
);
const existing = ref<AdminProject | null>(null);
const activeLocale = ref<Locale>(currentLocale.value);
const coverFile = ref<File | null>(null);
const deleteOpen = ref(false);

/**
 * Shared T-029 upload seam. Cover uploads previously lived in
 * `features/admin/projects/api`; the composable is now the single
 * validate → upload → cleanup implementation for covers, portraits,
 * publications and documents.
 */
const coverUpload = useUpload({
  supabase: client,
  bucket: PUBLIC_MEDIA_BUCKET,
  folder: "projects",
  accept: "image"
});

const loading = ref(true);
const loadError = ref<"not-found" | "unavailable" | "failed" | null>(null);
const pending = ref<
  "save" | "publish" | "unpublish" | "archive" | "delete" | null
>(null);
const statusMessage = ref("");
const statusKind = ref<"success" | "error" | null>(null);

const listPath = computed(() => `/${currentLocale.value}/admin/projects`);
const previewPath = computed(
  () =>
    `/${currentLocale.value}/admin/projects/${projectId.value ?? ""}/preview`
);

const activeTranslation = computed(
  () => values.value.translations[activeLocale.value]
);

const completeness = computed(() => translationCompleteness(values.value));

/** Shared presentation component expects a locale-keyed map. */
const completenessByLocale = computed(
  () =>
    Object.fromEntries(
      completeness.value.map(entry => [entry.locale, entry])
    ) as Record<Locale, LocaleCompleteness>
);

const statusOptions = computed(() =>
  (["draft", "published", "archived"] as const).map(status => ({
    label: t(`admin.projects.statuses.${status}`),
    value: status
  }))
);

const loadErrorMessage = computed(() => {
  switch (loadError.value) {
    case "not-found":
      return t("admin.projects.errors.notFound");
    case "unavailable":
      return t("admin.projects.errors.unavailable");
    default:
      return t("admin.projects.errors.loadFailed");
  }
});

const slugErrorText = computed(() => {
  switch (errors.value.slug) {
    case "required":
      return t("admin.projects.errors.slugRequired");
    case "format":
      return t("admin.projects.errors.slugFormat");
    case "duplicate":
      return t("admin.projects.errors.slugDuplicate");
    default:
      return "";
  }
});

const coverName = computed(() => coverFile.value?.name ?? "");

function toFormValues(project: AdminProject): ProjectFormValues {
  return {
    slug: project.slug,
    status: project.status,
    featured: project.featured,
    startDate: project.startDate ?? "",
    endDate: project.endDate ?? "",
    coverPath: project.coverPath,
    translations: Object.fromEntries(
      SUPPORTED_LOCALES.map(locale => [
        locale,
        { ...project.translations[locale] }
      ])
    ) as ProjectFormValues["translations"]
  };
}

function translationError(field: "title"): boolean {
  return errors.value.translations[activeLocale.value]?.[field] === "required";
}

function setStatusMessage(message: string, kind: "success" | "error"): void {
  statusMessage.value = message;
  statusKind.value = kind;
}

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;

  if (client.value === null) {
    loadError.value = "unavailable";
    loading.value = false;
    return;
  }

  if (isNew.value) {
    values.value = emptyProjectForm();
    loading.value = false;
    return;
  }

  const result = await fetchAdminProject(client.value, projectId.value ?? "");
  if (!result.ok) {
    loadError.value = result.code;
    loading.value = false;
    return;
  }

  existing.value = result.project;
  values.value = toFormValues(result.project);
  loading.value = false;
}

function onCoverChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  coverFile.value = input.files?.[0] ?? null;
}

function onTabKeydown(event: KeyboardEvent): void {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;

  event.preventDefault();
  const index = SUPPORTED_LOCALES.indexOf(activeLocale.value);
  const delta = event.key === "ArrowRight" ? 1 : -1;
  const next =
    SUPPORTED_LOCALES[
      (index + delta + SUPPORTED_LOCALES.length) % SUPPORTED_LOCALES.length
    ];
  if (!next) return;

  activeLocale.value = next;
  void nextTick(() => {
    document.getElementById(`project-tab-${next}`)?.focus();
  });
}

/**
 * Focus a field by its `data-testid`. Quasar owns the native input id, so the
 * stable hook the app and its E2E tests share is the test id (the same one the
 * `UiInput` wrappers forward to the real control).
 */
function focusField(testId: string): void {
  document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.focus();
}

/** Moves the keyboard to the first problem instead of leaving it on the button. */
function focusFirstError(): void {
  if (errors.value.slug !== null) {
    focusField("project-slug");
    return;
  }
  if (errors.value.startDate !== null) {
    focusField("project-start-date");
    return;
  }
  if (errors.value.endDate !== null) {
    focusField("project-end-date");
    return;
  }

  const locale = SUPPORTED_LOCALES.find(
    candidate => errors.value.translations[candidate]?.title === "required"
  );
  if (locale) {
    activeLocale.value = locale;
    void nextTick(() => {
      focusField("project-title");
    });
  }
}

/**
 * Save or publish. Publishing is deliberately two awaited steps (persist the
 * content, then flip the lifecycle) so a failure between them leaves a valid
 * draft rather than a half-published row — and the user sees exactly which
 * step failed.
 */
async function submit(kind: "save" | "publish"): Promise<void> {
  setStatusMessage("", "success");
  statusKind.value = null;

  if (client.value === null) {
    setStatusMessage(t("admin.projects.errors.unavailable"), "error");
    return;
  }

  const mode =
    kind === "publish" || values.value.status === "published"
      ? "publish"
      : "draft";

  errors.value = validateProjectForm(values.value, {
    mode,
    currentProjectId: projectId.value
  });

  if (hasFormErrors(errors.value)) {
    setStatusMessage(
      errors.value.publish === "fallback-incomplete"
        ? t("admin.projects.errors.publishFallbackIncomplete")
        : t("admin.projects.errors.saveFailed"),
      "error"
    );
    focusFirstError();
    return;
  }

  pending.value = kind;

  try {
    const previousCover = values.value.coverPath;
    let uploadedCover: string | null = null;

    if (coverFile.value !== null) {
      const upload = await coverUpload.upload(coverFile.value);
      if (!upload.ok) {
        setStatusMessage(
          upload.code === "not-an-image"
            ? t("admin.projects.errors.notAnImage")
            : t("admin.projects.errors.uploadFailed"),
          "error"
        );
        return;
      }
      uploadedCover = upload.path;
      values.value.coverPath = upload.path;
    }

    // Publish only after the content write succeeds; keep an already-published
    // row published so a content edit never briefly unpublishes it.
    const saveStatus =
      kind === "publish"
        ? values.value.status === "published"
          ? "published"
          : "draft"
        : values.value.status;

    const saved = await saveProject(
      client.value,
      { ...values.value, status: saveStatus },
      {
        id: projectId.value,
        existingFeaturedRank: existing.value?.featuredRank ?? null,
        existingPublishedAt: existing.value?.publishedAt ?? null
      }
    );

    if (!saved.ok) {
      errors.value = {
        ...errors.value,
        slug: saved.code === "duplicate-slug" ? "duplicate" : errors.value.slug
      };
      setStatusMessage(
        saved.code === "duplicate-slug"
          ? t("admin.projects.errors.slugDuplicate")
          : t("admin.projects.errors.saveFailed"),
        "error"
      );
      if (saved.code === "duplicate-slug") focusFirstError();
      // Never leave a just-uploaded cover orphaned by a failed row write.
      if (uploadedCover !== null) await coverUpload.remove(uploadedCover);
      return;
    }

    // A replaced cover is unreachable once the row points at the new object.
    if (uploadedCover !== null && previousCover !== null) {
      await coverUpload.remove(previousCover);
    }

    if (kind === "publish") {
      const published = await publishProject(client.value, saved.id);
      if (!published.ok) {
        setStatusMessage(t("admin.projects.errors.saveFailed"), "error");
        return;
      }
    }

    if (isNew.value) {
      await router.replace(
        `/${currentLocale.value}/admin/projects/${saved.id}`
      );
    }

    await load();
    setStatusMessage(
      kind === "publish"
        ? t("admin.projects.messages.published")
        : t("admin.projects.messages.draftSaved"),
      "success"
    );
  } finally {
    pending.value = null;
  }
}

async function unpublish(): Promise<void> {
  if (client.value === null || projectId.value === null) return;
  pending.value = "unpublish";
  try {
    const result = await unpublishProject(client.value, projectId.value);
    if (!result.ok) {
      setStatusMessage(t("admin.projects.errors.saveFailed"), "error");
      return;
    }
    await load();
    setStatusMessage(t("admin.projects.messages.unpublished"), "success");
  } finally {
    pending.value = null;
  }
}

async function archive(): Promise<void> {
  if (client.value === null || projectId.value === null) return;
  pending.value = "archive";
  try {
    const result = await archiveProject(client.value, projectId.value);
    if (!result.ok) {
      setStatusMessage(t("admin.projects.errors.saveFailed"), "error");
      return;
    }
    await load();
    setStatusMessage(t("admin.projects.messages.archived"), "success");
  } finally {
    pending.value = null;
  }
}

/**
 * Opens the confirmation and makes the trigger the focus-return target.
 *
 * Quasar's QBtn does not always take focus on click, so relying on
 * `document.activeElement` would sometimes return focus to `<body>`. Focusing
 * the trigger explicitly makes the restore deterministic (and matches the
 * keyboard flow, where the trigger is already focused).
 */
function openDeleteDialog(): void {
  focusField("project-delete");
  deleteOpen.value = true;
}

async function confirmDelete(): Promise<void> {
  if (client.value === null || projectId.value === null) return;
  pending.value = "delete";
  try {
    const result = await deleteProject(client.value, projectId.value);
    if (!result.ok) {
      setStatusMessage(t("admin.projects.errors.deleteFailed"), "error");
      return;
    }
    await router.push(listPath.value);
  } finally {
    pending.value = null;
  }
}

async function openPreview(): Promise<void> {
  await router.push(previewPath.value);
}

onMounted(load);
</script>

<style scoped>
.admin-project-edit__back {
  margin: 0 0 1rem;
  font-size: var(--font-size-small);
}

.admin-project-edit__back-link {
  color: var(--color-link);
  text-decoration: none;
}

.admin-project-edit__back-link:hover {
  text-decoration: underline;
}

.admin-project-edit__heading {
  margin: 0 0 1.5rem;
  font-size: var(--font-size-h2);
  font-weight: 700;
}

.admin-project-edit__state {
  color: var(--color-text-muted);
}

.admin-project-edit__banner {
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-danger);
  border-radius: 0.375rem;
  background: var(--color-surface-raised);
  color: var(--color-danger);
  font-weight: 600;
}

.admin-project-edit__form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.admin-project-edit__grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
}

.admin-project-edit__hint {
  margin: 0.25rem 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.admin-project-edit__label {
  display: block;
  margin-bottom: 0.375rem;
  font-weight: 600;
}

.admin-project-edit__file {
  font: inherit;
}

.admin-project-edit__section-title {
  margin: 0 0 0.75rem;
  font-size: 1.125rem;
  font-weight: 700;
}

.admin-project-edit__tablist {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  border-bottom: 1px solid var(--color-border);
}

.admin-project-edit__tab {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.5rem 0.875rem;
  border: none;
  border-bottom: 3px solid transparent;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

/* Active tab: a thick underline in addition to the label — never color alone. */
.admin-project-edit__tab--active {
  border-bottom-color: var(--color-accent);
}

.admin-project-edit__tab-state {
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  font-weight: 400;
}

.admin-project-edit__panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 1.25rem;
  outline: none;
}

.admin-project-edit__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.admin-project-edit__status {
  margin: 0;
  min-height: 1.25em;
  font-weight: 600;
}

.admin-project-edit__status--error {
  color: var(--color-danger);
}

.admin-project-edit__status--success {
  color: var(--color-success);
}
</style>
