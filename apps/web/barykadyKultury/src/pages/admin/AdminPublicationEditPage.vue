<template>
  <!--
    T-029 — publication create/edit
    (`/:locale/admin/publications/new` and `/:locale/admin/publications/:id`).

    Contract notes:
      * every mutation goes through `features/admin/publications` and the one
        shared `useUpload` composable — the page never builds a query or a
        storage URL;
      * NO optimistic UI: the lifecycle is only reflected after the awaited
        mutation resolves and the row is re-read;
      * URL xor files is validated here for immediate feedback and again in
        `save_publication_v1` (the database is the authority);
      * uploading happens through the shared composable, so a failed row insert
        removes the just-uploaded object (orphan cleanup proven by unit test).
  -->
  <div class="admin-publication-edit">
    <p class="admin-publication-edit__back">
      <RouterLink
        :to="listPath"
        class="admin-publication-edit__back-link focus-ring"
      >
        {{ t("admin.publications.actions.back") }}
      </RouterLink>
    </p>

    <p v-if="loading" class="admin-publication-edit__state" role="status">
      {{ t("content.loading") }}
    </p>

    <UiBanner
      v-else-if="loadError !== null"
      class="admin-publication-edit__banner"
      rounded
      role="status"
      aria-live="polite"
      data-testid="publication-load-error"
    >
      {{ loadErrorMessage }}
    </UiBanner>

    <AdminSubmitShell
      v-else
      mode="publication"
      submit-mode
      class="admin-publication-edit__form"
      :heading="
        isNew
          ? t('admin.publications.newPublication')
          : t('admin.publications.heading')
      "
      @submit="submit('save')"
    >
      <div class="admin-publication-edit__grid">
        <UiInput
          v-model="values.slug"
          :label="t('admin.publications.fields.slug')"
          :hint="t('admin.publications.fields.slugHint')"
          :error="errors.slug !== null"
          :error-message="slugErrorText"
          data-testid="publication-slug"
        />

        <UiSelect
          v-model="values.status"
          :options="statusOptions"
          emit-value
          map-options
          :label="t('admin.publications.fields.status')"
          data-testid="publication-status"
        />

        <UiSelect
          v-model="values.language"
          :options="languageOptions"
          emit-value
          map-options
          :label="t('admin.publications.fields.language')"
          data-testid="publication-language"
        />

        <UiInput
          v-model="values.publicationDate"
          type="date"
          :label="t('admin.publications.fields.publicationDate')"
          :error="dateError"
          :error-message="t('admin.publications.errors.dateInvalid')"
          data-testid="publication-date"
        />
      </div>

      <UiInput
        v-model="values.externalUrl"
        type="url"
        :label="t('admin.publications.fields.externalUrl')"
        :hint="t('admin.publications.fields.externalUrlHint')"
        :error="errors.externalUrl !== null || errors.action === 'both'"
        :error-message="
          errors.externalUrl !== null
            ? t('admin.publications.errors.externalUrlInvalid')
            : t('admin.publications.errors.actionBoth')
        "
        data-testid="publication-external-url"
      />

      <template #publication-extra>
        <fieldset class="admin-publication-edit__files">
          <legend class="admin-publication-edit__section-title">
            {{ t("admin.publications.fields.files") }}
          </legend>
          <p class="admin-publication-edit__hint">
            {{ t("admin.publications.fields.filesHint") }}
          </p>

          <div
            v-for="locale in SUPPORTED_LOCALES"
            :key="locale"
            class="admin-publication-edit__file-row"
            :data-testid="`publication-file-row-${locale}`"
          >
            <p class="admin-publication-edit__file-language">
              {{ LOCALE_LABELS[locale] }}
            </p>

            <UiInput
              v-model="fileLabels[locale]"
              :label="t('admin.publications.fields.label')"
              :hint="t('admin.publications.fields.labelHint')"
              :data-testid="`publication-file-label-${locale}`"
            />

            <p
              v-if="selectedFiles[locale]"
              class="admin-publication-edit__hint"
            >
              {{
                t("admin.publications.fields.fileSelected", {
                  name: selectedFiles[locale]?.name ?? ""
                })
              }}
            </p>
            <p v-else-if="fileFor(locale)" class="admin-publication-edit__hint">
              {{
                t("admin.publications.fields.currentFile", {
                  name: basename(fileFor(locale)!.storagePath)
                })
              }}
            </p>
            <p v-else class="admin-publication-edit__hint">
              {{ t("admin.publications.fields.noFile") }}
            </p>

            <div class="admin-publication-edit__file-actions">
              <label
                class="admin-publication-edit__label"
                :for="`publication-file-${locale}`"
              >
                {{ t("admin.publications.fields.chooseFile") }}
              </label>
              <input
                :id="`publication-file-${locale}`"
                class="admin-publication-edit__file"
                type="file"
                accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                :data-testid="`publication-file-${locale}`"
                @change="onFileChange(locale, $event)"
              />
              <UiBtn
                v-if="fileFor(locale)"
                variant="flat"
                :label="t('admin.publications.fields.removeFile')"
                :data-testid="`publication-file-remove-${locale}`"
                @click="removeFile(locale)"
              />
            </div>
          </div>
        </fieldset>
      </template>

      <div class="admin-publication-edit__tabs">
        <h2 class="admin-publication-edit__section-title">
          {{ t("admin.publications.tabs.label") }}
        </h2>

        <AdminLocaleTabs
          :locales="SUPPORTED_LOCALES"
          :active="activeLocale"
          :label="t('admin.publications.tabs.label')"
          :tab-labels="tabLabels"
          :entries="completenessByLocale"
          :labels="PUBLICATION_LABELS"
          id-prefix="publication"
          test-id-prefix="publication"
          @update:active="activeLocale = $event"
        />

        <div
          :id="`publication-panel-${activeLocale}`"
          role="tabpanel"
          :aria-labelledby="`publication-tab-${activeLocale}`"
          tabindex="0"
          class="admin-publication-edit__panel"
        >
          <UiInput
            v-model="activeTranslation.title"
            :label="t('admin.publications.translation.title')"
            :error="translationError()"
            :error-message="
              t('admin.publications.errors.translationTitleRequired')
            "
            data-testid="publication-title"
          />
          <UiInput
            v-model="activeTranslation.abstract"
            type="textarea"
            autogrow
            :label="t('admin.publications.translation.abstract')"
            data-testid="publication-abstract"
          />
          <UiInput
            v-model="activeTranslation.authors"
            :label="t('admin.publications.translation.authors')"
            data-testid="publication-authors"
          />
        </div>
      </div>

      <div
        v-if="upload.stage.value !== 'idle'"
        class="admin-publication-edit__progress"
        role="status"
        aria-live="polite"
      >
        <p class="admin-publication-edit__hint">{{ uploadStageText }}</p>
        <progress
          :value="upload.progress.value"
          max="100"
          :aria-label="t('admin.upload.progressLabel')"
        />
      </div>

      <div class="admin-publication-edit__actions">
        <UiBtn
          type="submit"
          :label="
            pending === 'save'
              ? t('admin.publications.actions.saving')
              : t('admin.publications.actions.save')
          "
          :loading="pending === 'save'"
          :disable="pending !== null"
          data-testid="publication-save"
        />
        <UiBtn
          v-if="values.status !== 'published'"
          variant="outline"
          :label="
            pending === 'publish'
              ? t('admin.publications.actions.publishing')
              : t('admin.publications.actions.publish')
          "
          :disable="pending !== null"
          data-testid="publication-publish"
          @click="submit('publish')"
        />
        <UiBtn
          v-else
          variant="outline"
          :label="
            pending === 'unpublish'
              ? t('admin.publications.actions.unpublishing')
              : t('admin.publications.actions.unpublish')
          "
          :disable="pending !== null"
          data-testid="publication-unpublish"
          @click="unpublish"
        />
        <UiBtn
          v-if="!isNew"
          variant="flat"
          :label="
            pending === 'delete'
              ? t('admin.publications.actions.deleting')
              : t('admin.publications.actions.delete')
          "
          :disable="pending !== null"
          data-testid="publication-delete"
          @click="openDeleteDialog"
        />
      </div>

      <p
        class="admin-publication-edit__status"
        :class="{
          'admin-publication-edit__status--error': statusKind === 'error',
          'admin-publication-edit__status--success': statusKind === 'success'
        }"
        role="status"
        aria-live="polite"
        data-testid="publication-status-message"
      >
        {{ statusMessage }}
      </p>
    </AdminSubmitShell>

    <UiConfirmDialog
      v-model="deleteOpen"
      :title="t('admin.publications.deleteDialog.title')"
      :message="t('admin.publications.deleteDialog.message')"
      :confirm-label="t('admin.publications.deleteDialog.confirm')"
      :cancel-label="t('admin.publications.actions.cancel')"
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

import AdminLocaleTabs from "@/components/admin/AdminLocaleTabs.vue";
import AdminSubmitShell from "@/components/admin/AdminSubmitShell.vue";
import {
  UiBanner,
  UiBtn,
  UiConfirmDialog,
  UiInput,
  UiSelect
} from "@/components/ui";
import {
  deletePublication,
  fetchAdminPublication,
  publicationFilesFromAdmin,
  publishPublication,
  savePublication,
  unpublishPublication,
  type AdminPublication
} from "@/features/admin/publications/api";
import {
  emptyPublicationForm,
  hasPublicationFormErrors,
  isPublicationDateValid,
  publicationTranslationCompleteness,
  removePublicationFile,
  updatePublicationTranslation,
  upsertPublicationFile,
  validatePublicationForm,
  type PublicationFileDraft,
  type PublicationFormErrors,
  type PublicationFormValues,
  type PublicationTranslationDraft
} from "@/features/admin/publications/publicationForm";
import type {
  CompletenessLabelKeys,
  LocaleCompleteness
} from "@/features/admin/shared/completeness";
import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import { PUBLIC_DOCUMENTS_BUCKET } from "@/features/files/buckets";
import { useUpload } from "@/features/files/useUpload";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type Locale
} from "@/features/i18n/locales";
import type { Database } from "@/types/database.types";

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

const publicationId = computed<string | null>(() => {
  const { id } = route.params as { id?: unknown };
  return typeof id === "string" && id !== "new" ? id : null;
});

const isNew = computed(() => publicationId.value === null);

const PUBLICATION_LABELS: CompletenessLabelKeys = {
  complete: "admin.publications.completeness.complete",
  notStarted: "admin.publications.completeness.notStarted",
  missing: "admin.publications.completeness.missing",
  field: field => `admin.publications.translation.${field}`
};

const values = ref<PublicationFormValues>(emptyPublicationForm());
const errors = ref<PublicationFormErrors>(
  validatePublicationForm(emptyPublicationForm(), { mode: "draft" })
);
const existing = ref<AdminPublication | null>(null);
const activeLocale = ref<Locale>(currentLocale.value);
const fileLabels = ref<Record<Locale, string>>({
  en: "",
  pl: "",
  uk: ""
});
const selectedFiles = ref<Partial<Record<Locale, File>>>({});
const deleteOpen = ref(false);
const loading = ref(true);
const loadError = ref<"not-found" | "unavailable" | "failed" | null>(null);
const pending = ref<"save" | "publish" | "unpublish" | "delete" | null>(null);
const statusMessage = ref("");
const statusKind = ref<"success" | "error" | null>(null);
const dateError = ref(false);

const upload = useUpload({
  supabase: client,
  bucket: PUBLIC_DOCUMENTS_BUCKET,
  folder: "publications"
});

const listPath = computed(() => `/${currentLocale.value}/admin/publications`);

const activeTranslation = computed(
  () => values.value.translations[activeLocale.value]
);

const statusOptions = computed(() =>
  (["draft", "published", "archived"] as const).map(status => ({
    label: t(`admin.publications.statuses.${status}`),
    value: status
  }))
);

const languageOptions = computed(() => [
  { label: t("admin.publications.fields.languageNone"), value: null },
  ...SUPPORTED_LOCALES.map(locale => ({
    label: LOCALE_LABELS[locale],
    value: locale
  }))
]);

const tabLabels = computed(
  () =>
    Object.fromEntries(
      SUPPORTED_LOCALES.map(locale => [
        locale,
        t(`admin.publications.tabs.${locale}`)
      ])
    ) as Record<Locale, string>
);

const completenessByLocale = computed(() => {
  const entries = publicationTranslationCompleteness(values.value);
  return Object.fromEntries(
    entries.map(entry => [entry.locale, entry])
  ) as Record<Locale, LocaleCompleteness>;
});

const loadErrorMessage = computed(() => {
  switch (loadError.value) {
    case "not-found":
      return t("admin.publications.errors.notFound");
    case "unavailable":
      return t("admin.publications.errors.unavailable");
    default:
      return t("admin.publications.errors.loadFailed");
  }
});

const slugErrorText = computed(() => {
  switch (errors.value.slug) {
    case "required":
      return t("admin.publications.errors.slugRequired");
    case "format":
      return t("admin.publications.errors.slugFormat");
    case "duplicate":
      return t("admin.publications.errors.slugDuplicate");
    default:
      return "";
  }
});

const uploadStageText = computed(() => {
  switch (upload.stage.value) {
    case "validating":
      return t("admin.upload.validating");
    case "uploading":
      return t("admin.upload.uploading");
    case "persisting":
      return t("admin.upload.persisting");
    default:
      return "";
  }
});

function fileFor(locale: Locale): PublicationFileDraft | null {
  return values.value.files.find(file => file.locale === locale) ?? null;
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

function setStatusMessage(message: string, kind: "success" | "error"): void {
  statusMessage.value = message;
  statusKind.value = kind;
}

function translationError(): boolean {
  return errors.value.translations[activeLocale.value]?.title === "required";
}

function toFormValues(publication: AdminPublication): PublicationFormValues {
  return {
    id: publication.id,
    slug: publication.slug,
    status: publication.status,
    language: publication.language,
    publicationDate: publication.publicationDate ?? "",
    externalUrl: publication.externalUrl ?? "",
    sortOrder: publication.sortOrder,
    translations: Object.fromEntries(
      SUPPORTED_LOCALES.map(locale => [
        locale,
        { ...publication.translations[locale] }
      ])
    ) as Record<Locale, PublicationTranslationDraft>,
    files: publicationFilesFromAdmin(publication)
  };
}

function syncLabels(publication: AdminPublication | null): void {
  fileLabels.value = Object.fromEntries(
    SUPPORTED_LOCALES.map(locale => [
      locale,
      publication?.files.find(file => file.locale === locale)?.label ?? ""
    ])
  ) as Record<Locale, string>;
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
    values.value = emptyPublicationForm();
    syncLabels(null);
    loading.value = false;
    return;
  }

  const result = await fetchAdminPublication(
    client.value,
    publicationId.value ?? ""
  );
  if (!result.ok) {
    loadError.value =
      result.code === "not-found" || result.code === "unavailable"
        ? result.code
        : "failed";
    loading.value = false;
    return;
  }

  existing.value = result.publication;
  values.value = toFormValues(result.publication);
  syncLabels(result.publication);
  loading.value = false;
}

function onFileChange(locale: Locale, event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (file) {
    selectedFiles.value = { ...selectedFiles.value, [locale]: file };
  }
}

function removeFile(locale: Locale): void {
  values.value = removePublicationFile(values.value, locale);
  const next = { ...selectedFiles.value };
  delete next[locale];
  selectedFiles.value = next;
}

function focusField(testId: string): void {
  document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.focus();
}

function focusFirstError(): void {
  if (errors.value.slug !== null) return focusField("publication-slug");
  if (dateError.value) return focusField("publication-date");
  if (errors.value.externalUrl !== null)
    return focusField("publication-external-url");
  if (errors.value.action === "both")
    return focusField("publication-external-url");
  const locale = SUPPORTED_LOCALES.find(
    candidate => errors.value.translations[candidate]?.title === "required"
  );
  if (locale) {
    activeLocale.value = locale;
    void nextTick(() => focusField("publication-title"));
  }
}

function messageForFailure(
  code: string | undefined,
  rejectionCode?: string
): string {
  if (code === "invalid-upload") {
    if (rejectionCode === "active-content") {
      return t("admin.publications.errors.activeContent");
    }
    if (rejectionCode === "file-too-large") {
      return t("admin.publications.errors.fileTooLarge");
    }
    if (
      rejectionCode === "unsupported-extension" ||
      rejectionCode === "unsupported-mime" ||
      rejectionCode === "mime-extension-mismatch"
    ) {
      return t("admin.publications.errors.unsupportedFile");
    }
    return t("admin.publications.errors.invalidUpload");
  }
  if (code === "upload-failed")
    return t("admin.publications.errors.uploadFailed");
  return t("admin.publications.errors.saveFailed");
}

async function submit(kind: "save" | "publish"): Promise<void> {
  if (client.value === null) {
    setStatusMessage(t("admin.publications.errors.unavailable"), "error");
    return;
  }

  const mode =
    kind === "publish" || values.value.status === "published"
      ? "publish"
      : "draft";

  errors.value = validatePublicationForm(values.value, {
    mode,
    currentPublicationId: publicationId.value
  });
  dateError.value = !isPublicationDateValid(values.value.publicationDate);

  if (hasPublicationFormErrors(errors.value) || dateError.value) {
    if (errors.value.action === "both") {
      setStatusMessage(t("admin.publications.errors.actionBoth"), "error");
    } else if (errors.value.action === "missing") {
      setStatusMessage(t("admin.publications.errors.actionMissing"), "error");
    } else if (errors.value.publish === "fallback-incomplete") {
      setStatusMessage(
        t("admin.publications.errors.publishFallbackIncomplete"),
        "error"
      );
    } else {
      setStatusMessage(t("admin.publications.errors.saveFailed"), "error");
    }
    focusFirstError();
    return;
  }

  pending.value = kind;

  try {
    const localesWithFiles = SUPPORTED_LOCALES.filter(
      locale => selectedFiles.value[locale] instanceof File
    );
    const files = localesWithFiles.map(locale => selectedFiles.value[locale]!);

    const persist = async (
      uploaded: readonly { path: string; mimeType: string; size: number }[]
    ) => {
      let next = values.value;
      localesWithFiles.forEach((locale, index) => {
        const object = uploaded[index];
        if (!object) return;
        next = upsertPublicationFile(next, {
          locale,
          label: fileLabels.value[locale],
          storagePath: object.path,
          mimeType: object.mimeType,
          sizeBytes: object.size
        });
      });
      values.value = next;

      const replaced = (existing.value?.files ?? [])
        .filter(
          old =>
            !next.files.some(current => current.storagePath === old.storagePath)
        )
        .map(old => old.storagePath);

      return savePublication(client.value!, next, {
        existingPublishedAt: existing.value?.publishedAt ?? null,
        replaceStoragePaths: replaced
      });
    };

    const outcome =
      files.length > 0
        ? await upload.uploadManyAndPersist(files, persist)
        : { ok: true as const, result: await persist([]) };

    if (!outcome.ok) {
      const cause = "cause" in outcome ? outcome.cause : null;
      const code =
        cause !== null && typeof cause === "object" && "code" in cause
          ? String((cause as { code?: unknown }).code)
          : outcome.code;
      if (code === "duplicate-slug") {
        errors.value = { ...errors.value, slug: "duplicate" };
      }
      setStatusMessage(messageForFailure(code, outcome.rejectionCode), "error");
      return;
    }

    const saved = outcome.result;
    if (!saved.ok) {
      setStatusMessage(t("admin.publications.errors.saveFailed"), "error");
      return;
    }

    if (kind === "publish") {
      const published = await publishPublication(client.value, saved.id);
      if (!published.ok) {
        setStatusMessage(t("admin.publications.errors.saveFailed"), "error");
        return;
      }
    }

    if (isNew.value) {
      await router.replace(
        `/${currentLocale.value}/admin/publications/${saved.id}`
      );
    }

    selectedFiles.value = {};
    await load();
    setStatusMessage(
      kind === "publish"
        ? t("admin.publications.messages.published")
        : t("admin.publications.messages.draftSaved"),
      "success"
    );
  } finally {
    pending.value = null;
  }
}

async function unpublish(): Promise<void> {
  if (client.value === null || publicationId.value === null) return;
  pending.value = "unpublish";
  try {
    const result = await unpublishPublication(
      client.value,
      publicationId.value
    );
    if (!result.ok) {
      setStatusMessage(t("admin.publications.errors.saveFailed"), "error");
      return;
    }
    await load();
    setStatusMessage(t("admin.publications.messages.unpublished"), "success");
  } finally {
    pending.value = null;
  }
}

function openDeleteDialog(): void {
  focusField("publication-delete");
  deleteOpen.value = true;
}

async function confirmDelete(): Promise<void> {
  if (client.value === null || publicationId.value === null) return;
  pending.value = "delete";
  try {
    const paths = (existing.value?.files ?? []).map(file => file.storagePath);
    const result = await deletePublication(
      client.value,
      publicationId.value,
      paths
    );
    if (!result.ok) {
      setStatusMessage(t("admin.publications.errors.deleteFailed"), "error");
      return;
    }
    await router.push(listPath.value);
  } finally {
    pending.value = null;
  }
}

onMounted(load);
</script>

<style scoped>
.admin-publication-edit__back {
  margin: 0 0 1rem;
  font-size: var(--font-size-small);
}

.admin-publication-edit__back-link {
  color: var(--color-link);
  text-decoration: none;
}

.admin-publication-edit__heading {
  margin: 0 0 1.5rem;
  font-size: var(--font-size-h2);
  font-weight: 700;
}

.admin-publication-edit__state,
.admin-publication-edit__hint {
  margin: 0.25rem 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.admin-publication-edit__banner {
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-danger);
  border-radius: 0.375rem;
  background: var(--color-surface-raised);
  color: var(--color-danger);
  font-weight: 600;
}

.admin-publication-edit__form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.admin-publication-edit__grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
}

.admin-publication-edit__files {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 0;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
}

.admin-publication-edit__file-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-block: 0.75rem;
  border-block-start: 1px solid var(--color-border);
}

.admin-publication-edit__file-row:first-of-type {
  border-block-start: 0;
}

.admin-publication-edit__file-language {
  margin: 0;
  font-weight: 700;
}

.admin-publication-edit__file-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.admin-publication-edit__label {
  font-weight: 600;
}

.admin-publication-edit__file {
  font: inherit;
}

.admin-publication-edit__section-title {
  margin: 0 0 0.75rem;
  font-size: 1.125rem;
  font-weight: 700;
}

.admin-publication-edit__panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 1.25rem;
  outline: none;
}

.admin-publication-edit__progress {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.admin-publication-edit__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.admin-publication-edit__status {
  margin: 0;
  min-height: 1.25em;
  font-weight: 600;
}

.admin-publication-edit__status--error {
  color: var(--color-danger);
}

.admin-publication-edit__status--success {
  color: var(--color-success);
}
</style>
