<template>
  <!--
    T-029 — organization documents (`/:locale/admin/documents`).

    One page for list + create/edit/delete (the T-028 team-editor shape).
    Contract notes:
      * files are uploaded through the shared `useUpload` composable, which
        validates before transferring bytes and removes the object when the
        row insert fails;
      * only the storage PATH is persisted (never a public URL);
      * publish/unpublish is a single transactional transition, and the list is
        re-read after every awaited mutation (no optimistic rows).
  -->
  <div class="admin-documents">
    <p class="admin-documents__back">
      <RouterLink
        :to="`/${currentLocale}/admin`"
        class="admin-documents__back-link focus-ring"
      >
        {{ t("admin.documents.actions.back") }}
      </RouterLink>
    </p>

    <div class="admin-documents__header">
      <h1 class="admin-documents__heading">{{
        t("admin.documents.heading")
      }}</h1>
      <BkButton
        :label="t('admin.documents.actions.newDocument')"
        data-testid="documents-new"
        @click="startNew"
      />
    </div>

    <p class="admin-documents__intro">{{ t("admin.documents.intro") }}</p>

    <p v-if="loading" class="admin-documents__state" role="status">
      {{ t("content.loading") }}
    </p>

    <BkBanner
      v-else-if="loadError !== null"
      class="admin-documents__banner"
      rounded
      role="status"
      aria-live="polite"
      data-testid="documents-error"
    >
      {{ loadErrorMessage }}
    </BkBanner>

    <template v-else>
      <p
        v-if="documents.length === 0"
        class="admin-documents__state"
        data-testid="documents-empty"
      >
        {{ t("admin.documents.empty") }}
      </p>

      <table v-else class="admin-documents__table" data-testid="documents-list">
        <caption class="sr-only">{{ t("admin.documents.heading") }}</caption>
        <thead>
          <tr>
            <th scope="col">{{ t("admin.documents.translation.title") }}</th>
            <th scope="col">{{ t("admin.documents.fields.status") }}</th>
            <th scope="col">{{ t("admin.documents.fields.documentType") }}</th>
            <th scope="col">{{ t("admin.documents.fields.language") }}</th>
            <th scope="col">{{ t("admin.documents.actions.edit") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="document in documents" :key="document.id">
            <td>
              <span class="admin-documents__title">{{
                displayTitle(document)
              }}</span>
              <span class="admin-documents__slug">{{ document.slug }}</span>
            </td>
            <td>{{ t(`admin.documents.statuses.${document.status}`) }}</td>
            <td>{{ document.documentType }}</td>
            <td>{{
              document.language ? LOCALE_LABELS[document.language] : "—"
            }}</td>
            <td class="admin-documents__row-actions">
              <BkButton
                variant="flat"
                :label="t('admin.documents.actions.edit')"
                :data-testid="`documents-edit-${document.slug}`"
                @click="startEdit(document)"
              />
              <BkButton
                variant="outline"
                :label="
                  document.status === 'published'
                    ? t('admin.documents.actions.unpublish')
                    : t('admin.documents.actions.publish')
                "
                :disable="pending !== null"
                :data-testid="`documents-toggle-${document.slug}`"
                @click="togglePublished(document)"
              />
              <BkButton
                variant="flat"
                :label="t('admin.documents.actions.delete')"
                :disable="pending !== null"
                :data-testid="`documents-delete-${document.slug}`"
                @click="openDeleteDialog(document)"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <form
        v-if="editing !== null"
        novalidate
        class="admin-documents__form"
        @submit.prevent="save"
      >
        <h2 class="admin-documents__section-title">
          {{
            editing.id === null
              ? t("admin.documents.actions.newDocument")
              : t("admin.documents.actions.edit")
          }}
        </h2>

        <div class="admin-documents__grid">
          <BkInput
            v-model="editing.slug"
            :label="t('admin.documents.fields.slug')"
            :hint="t('admin.documents.fields.slugHint')"
            :error="errors.slug !== null"
            :error-message="slugErrorText"
            data-testid="document-slug"
          />

          <BkSelect
            v-model="editing.documentType"
            :options="typeOptions"
            emit-value
            map-options
            :label="t('admin.documents.fields.documentType')"
            :error="errors.documentType !== null"
            :error-message="t('admin.documents.errors.documentTypeRequired')"
            data-testid="document-type"
          />

          <BkSelect
            v-model="editing.language"
            :options="languageOptions"
            emit-value
            map-options
            :label="t('admin.documents.fields.language')"
            data-testid="document-language"
          />

          <BkSelect
            v-model="editing.status"
            :options="statusOptions"
            emit-value
            map-options
            :label="t('admin.documents.fields.status')"
            data-testid="document-status"
          />

          <BkInput
            v-model="editing.publicationDate"
            type="date"
            :label="t('admin.documents.fields.publicationDate')"
            :error="dateError"
            :error-message="t('admin.documents.errors.dateInvalid')"
            data-testid="document-date"
          />

          <BkInput
            v-model="sortOrderText"
            type="number"
            :label="t('admin.documents.fields.sortOrder')"
            :hint="t('admin.documents.fields.sortOrderHint')"
            data-testid="document-sort-order"
          />
        </div>

        <div class="admin-documents__file">
          <label class="admin-documents__label" for="document-file">
            {{ t("admin.documents.fields.file") }}
          </label>
          <input
            id="document-file"
            class="admin-documents__file-input"
            type="file"
            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            data-testid="document-file"
            @change="onFileChange"
          />
          <p class="admin-documents__hint">{{
            t("admin.documents.fields.fileHint")
          }}</p>
          <p v-if="selectedFile" class="admin-documents__hint">
            {{
              t("admin.documents.fields.fileSelected", {
                name: selectedFile.name
              })
            }}
          </p>
          <p v-else-if="editing.storagePath" class="admin-documents__hint">
            {{
              t("admin.documents.fields.currentFile", {
                name: basename(editing.storagePath)
              })
            }}
          </p>
          <p v-else class="admin-documents__hint">
            {{ t("admin.documents.fields.noFile") }}
          </p>
          <p
            v-if="errors.storagePath !== null"
            class="admin-documents__field-error"
          >
            {{ t("admin.documents.errors.fileRequired") }}
          </p>
        </div>

        <div class="admin-documents__tabs">
          <h3 class="admin-documents__section-title">
            {{ t("admin.documents.tabs.label") }}
          </h3>

          <AdminLocaleTabs
            :locales="SUPPORTED_LOCALES"
            :active="activeLocale"
            :label="t('admin.documents.tabs.label')"
            :tab-labels="tabLabels"
            :entries="completenessByLocale"
            :labels="DOCUMENT_LABELS"
            id-prefix="document"
            test-id-prefix="document"
            @update:active="activeLocale = $event"
          />

          <div
            :id="`document-panel-${activeLocale}`"
            role="tabpanel"
            :aria-labelledby="`document-tab-${activeLocale}`"
            tabindex="0"
            class="admin-documents__panel"
          >
            <BkInput
              v-model="activeTranslation.title"
              :label="t('admin.documents.translation.title')"
              :error="translationError()"
              :error-message="
                t('admin.documents.errors.translationTitleRequired')
              "
              data-testid="document-title"
            />
            <BkInput
              v-model="activeTranslation.description"
              type="textarea"
              autogrow
              :label="t('admin.documents.translation.description')"
              data-testid="document-description"
            />
          </div>
        </div>

        <div
          v-if="upload.stage.value !== 'idle'"
          class="admin-documents__progress"
          role="status"
          aria-live="polite"
        >
          <p class="admin-documents__hint">{{ uploadStageText }}</p>
          <progress
            :value="upload.progress.value"
            max="100"
            :aria-label="t('admin.upload.progressLabel')"
          />
        </div>

        <div class="admin-documents__actions">
          <BkButton
            type="submit"
            :label="
              pending === 'save'
                ? t('admin.documents.actions.saving')
                : t('admin.documents.actions.save')
            "
            :loading="pending === 'save'"
            :disable="pending !== null"
            data-testid="document-save"
          />
          <BkButton
            variant="flat"
            :label="t('admin.documents.actions.cancel')"
            :disable="pending !== null"
            data-testid="document-cancel"
            @click="cancelEdit"
          />
        </div>

        <p
          class="admin-documents__status"
          :class="{
            'admin-documents__status--error': statusKind === 'error',
            'admin-documents__status--success': statusKind === 'success'
          }"
          role="status"
          aria-live="polite"
          data-testid="document-status-message"
        >
          {{ statusMessage }}
        </p>
      </form>
    </template>

    <BkConfirmDialog
      v-model="deleteOpen"
      :title="t('admin.documents.deleteDialog.title')"
      :message="t('admin.documents.deleteDialog.message')"
      :confirm-label="t('admin.documents.deleteDialog.confirm')"
      :cancel-label="t('admin.documents.actions.cancel')"
      danger
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import type { SupabaseClient } from "@supabase/supabase-js";
import { computed, inject, nextTick, onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import AdminLocaleTabs from "@/components/admin/AdminLocaleTabs.vue";
import {
  BkBanner,
  BkButton,
  BkConfirmDialog,
  BkInput,
  BkSelect
} from "@/components/bk";
import {
  deleteDocument,
  fetchAdminDocuments,
  publishDocument,
  saveDocument,
  unpublishDocument,
  type AdminDocument
} from "@/features/admin/documents/api";
import {
  DOCUMENT_TYPE_KEYS,
  documentTranslationCompleteness,
  emptyDocumentForm,
  emptyDocumentTranslation,
  hasDocumentFormErrors,
  isDocumentDateValid,
  updateDocumentTranslation,
  validateDocumentForm,
  type DocumentFormErrors,
  type DocumentFormValues,
  type DocumentTranslationDraft
} from "@/features/admin/documents/documentForm";
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
const injected = inject(SUPABASE_CLIENT_KEY, null);
const client = computed(() => props.supabase ?? injected);

const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

const DOCUMENT_LABELS: CompletenessLabelKeys = {
  complete: "admin.documents.completeness.complete",
  notStarted: "admin.documents.completeness.notStarted",
  missing: "admin.documents.completeness.missing",
  field: field => `admin.documents.translation.${field}`
};

const documents = ref<readonly AdminDocument[]>([]);
const loading = ref(true);
const loadError = ref<"unavailable" | "failed" | null>(null);
const editing = ref<DocumentFormValues | null>(null);
const existing = ref<AdminDocument | null>(null);
const errors = ref<DocumentFormErrors>(
  validateDocumentForm(emptyDocumentForm(), { mode: "draft" })
);
const activeLocale = ref<Locale>(currentLocale.value);
const selectedFile = ref<File | null>(null);
const sortOrderText = ref("");
const deleteOpen = ref(false);
const documentToDelete = ref<AdminDocument | null>(null);
const pending = ref<"save" | "toggle" | "delete" | null>(null);
const statusMessage = ref("");
const statusKind = ref<"success" | "error" | null>(null);
const dateError = ref(false);

const upload = useUpload({
  supabase: client,
  bucket: PUBLIC_DOCUMENTS_BUCKET,
  folder: "documents"
});

const loadErrorMessage = computed(() =>
  loadError.value === "unavailable"
    ? t("admin.documents.errors.unavailable")
    : t("admin.documents.errors.loadFailed")
);

const typeOptions = computed(() =>
  DOCUMENT_TYPE_KEYS.map(type => ({
    label: t(`admin.documents.types.${type}`),
    value: type
  }))
);

const languageOptions = computed(() =>
  SUPPORTED_LOCALES.map(locale => ({
    label: LOCALE_LABELS[locale],
    value: locale
  }))
);

const statusOptions = computed(() =>
  (["draft", "published", "archived"] as const).map(status => ({
    label: t(`admin.documents.statuses.${status}`),
    value: status
  }))
);

const tabLabels = computed(
  () =>
    Object.fromEntries(
      SUPPORTED_LOCALES.map(locale => [
        locale,
        t(`admin.documents.tabs.${locale}`)
      ])
    ) as Record<Locale, string>
);

const activeTranslation = computed(
  () =>
    editing.value?.translations[activeLocale.value] ??
    emptyDocumentTranslation()
);

const completenessByLocale = computed(() => {
  const source = editing.value;
  const entries = source
    ? documentTranslationCompleteness(source)
    : SUPPORTED_LOCALES.map(locale => ({
        locale,
        complete: false,
        hasContent: false,
        missing: [] as const
      }));

  return Object.fromEntries(
    entries.map(entry => [entry.locale, entry])
  ) as Record<Locale, LocaleCompleteness>;
});

const slugErrorText = computed(() => {
  switch (errors.value.slug) {
    case "required":
      return t("admin.documents.errors.slugRequired");
    case "format":
      return t("admin.documents.errors.slugFormat");
    case "duplicate":
      return t("admin.documents.errors.slugDuplicate");
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

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

function displayTitle(document: AdminDocument): string {
  return document.translations[DEFAULT_LOCALE].title || document.slug;
}

function setStatusMessage(message: string, kind: "success" | "error"): void {
  statusMessage.value = message;
  statusKind.value = kind;
}

function translationError(): boolean {
  return errors.value.translations[activeLocale.value]?.title === "required";
}

function toFormValues(document: AdminDocument): DocumentFormValues {
  return {
    id: document.id,
    slug: document.slug,
    status: document.status,
    documentType: document.documentType,
    language: document.language ?? DEFAULT_LOCALE,
    publicationDate: document.publicationDate ?? "",
    sortOrder: document.sortOrder,
    storagePath: document.storagePath,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    translations: Object.fromEntries(
      SUPPORTED_LOCALES.map(locale => [
        locale,
        { ...document.translations[locale] }
      ])
    ) as Record<Locale, DocumentTranslationDraft>
  };
}

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;

  if (client.value === null) {
    loadError.value = "unavailable";
    loading.value = false;
    return;
  }

  const result = await fetchAdminDocuments(client.value);
  if (!result.ok) {
    loadError.value = "failed";
    loading.value = false;
    return;
  }

  documents.value = result.documents;
  loading.value = false;
}

function startNew(): void {
  editing.value = emptyDocumentForm();
  existing.value = null;
  activeLocale.value = currentLocale.value;
  selectedFile.value = null;
  sortOrderText.value = "";
  errors.value = validateDocumentForm(editing.value, {
    mode: "draft",
    isNew: true
  });
  setStatusMessage("", "success");
}

function startEdit(document: AdminDocument): void {
  editing.value = toFormValues(document);
  existing.value = document;
  activeLocale.value = currentLocale.value;
  selectedFile.value = null;
  sortOrderText.value = String(document.sortOrder);
  errors.value = validateDocumentForm(editing.value, { mode: "draft" });
  setStatusMessage("", "success");
}

function cancelEdit(): void {
  editing.value = null;
  existing.value = null;
  selectedFile.value = null;
  sortOrderText.value = "";
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  selectedFile.value = input.files?.[0] ?? null;
  if (editing.value && selectedFile.value) {
    editing.value = {
      ...editing.value,
      storagePath: "pending",
      mimeType: selectedFile.value.type,
      sizeBytes: selectedFile.value.size
    };
  }
}

function focusField(testId: string): void {
  document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.focus();
}

function focusFirstError(): void {
  if (errors.value.slug !== null) return focusField("document-slug");
  if (errors.value.documentType !== null) return focusField("document-type");
  if (dateError.value) return focusField("document-date");
  if (errors.value.storagePath !== null) return focusField("document-file");
  const locale = SUPPORTED_LOCALES.find(
    candidate => errors.value.translations[candidate]?.title === "required"
  );
  if (locale) {
    activeLocale.value = locale;
    void nextTick(() => focusField("document-title"));
  }
}

function messageForFailure(
  code: string | undefined,
  rejectionCode?: string
): string {
  if (code === "invalid-upload") {
    if (rejectionCode === "active-content")
      return t("admin.documents.errors.activeContent");
    if (rejectionCode === "file-too-large")
      return t("admin.documents.errors.fileTooLarge");
    if (
      rejectionCode === "unsupported-extension" ||
      rejectionCode === "unsupported-mime" ||
      rejectionCode === "mime-extension-mismatch"
    ) {
      return t("admin.documents.errors.unsupportedFile");
    }
    return t("admin.documents.errors.invalidUpload");
  }
  if (code === "upload-failed") return t("admin.documents.errors.uploadFailed");
  return t("admin.documents.errors.saveFailed");
}

async function save(): Promise<void> {
  if (!editing.value || client.value === null) return;

  const isNew = editing.value.id === null;
  const parsedSort =
    sortOrderText.value.trim() === "" ? null : Number(sortOrderText.value);

  errors.value = validateDocumentForm(editing.value, {
    mode: editing.value.status === "published" ? "publish" : "draft",
    isNew: isNew && selectedFile.value === null,
    currentDocumentId: editing.value.id
  });
  dateError.value = !isDocumentDateValid(editing.value.publicationDate);

  const invalidSort =
    parsedSort !== null && (!Number.isInteger(parsedSort) || parsedSort < 0);
  if (hasDocumentFormErrors(errors.value) || dateError.value || invalidSort) {
    if (errors.value.publish === "fallback-incomplete") {
      setStatusMessage(
        t("admin.documents.errors.publishFallbackIncomplete"),
        "error"
      );
    } else {
      setStatusMessage(t("admin.documents.errors.saveFailed"), "error");
    }
    focusFirstError();
    return;
  }

  pending.value = "save";
  try {
    const base = { ...editing.value, sortOrder: parsedSort };
    const persist = async (uploaded?: {
      path: string;
      mimeType: string;
      size: number;
    }) => {
      const next = uploaded
        ? {
            ...base,
            storagePath: uploaded.path,
            mimeType: uploaded.mimeType,
            sizeBytes: uploaded.size
          }
        : base;

      editing.value = next;
      const replaced =
        existing.value?.storagePath &&
        existing.value.storagePath !== next.storagePath
          ? [existing.value.storagePath]
          : [];

      return saveDocument(client.value!, next, {
        existingPublishedAt: existing.value?.publishedAt ?? null,
        replaceStoragePaths: replaced
      });
    };

    const outcome =
      selectedFile.value !== null
        ? await upload.uploadAndPersist(selectedFile.value, persist)
        : { ok: true as const, result: await persist() };

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

    if (!outcome.result.ok) {
      setStatusMessage(t("admin.documents.errors.saveFailed"), "error");
      return;
    }

    const savedId = outcome.result.id;
    selectedFile.value = null;
    await load();
    const reloaded = documents.value.find(document => document.id === savedId);
    if (reloaded) startEdit(reloaded);
    else cancelEdit();
    setStatusMessage(t("admin.documents.messages.saved"), "success");
  } finally {
    pending.value = null;
  }
}

async function togglePublished(document: AdminDocument): Promise<void> {
  if (client.value === null) return;

  pending.value = "toggle";
  try {
    const result =
      document.status === "published"
        ? await unpublishDocument(client.value, document.id)
        : await publishDocument(client.value, document.id);

    if (!result.ok) {
      setStatusMessage(t("admin.documents.errors.saveFailed"), "error");
      return;
    }

    await load();
    setStatusMessage(
      document.status === "published"
        ? t("admin.documents.messages.unpublished")
        : t("admin.documents.messages.published"),
      "success"
    );
  } finally {
    pending.value = null;
  }
}

function openDeleteDialog(document: AdminDocument): void {
  documentToDelete.value = document;
  deleteOpen.value = true;
}

async function confirmDelete(): Promise<void> {
  if (client.value === null || documentToDelete.value === null) return;

  pending.value = "delete";
  try {
    const result = await deleteDocument(
      client.value,
      documentToDelete.value.id,
      documentToDelete.value.storagePath
    );
    if (!result.ok) {
      setStatusMessage(t("admin.documents.errors.deleteFailed"), "error");
      return;
    }
    if (editing.value?.id === documentToDelete.value.id) cancelEdit();
    await load();
    setStatusMessage(t("admin.documents.messages.deleted"), "success");
  } finally {
    documentToDelete.value = null;
    pending.value = null;
  }
}

onMounted(load);
</script>

<style scoped>
.admin-documents__back {
  margin: 0 0 1rem;
  font-size: var(--font-size-small);
}

.admin-documents__back-link {
  color: var(--color-link);
  text-decoration: none;
}

.admin-documents__header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.admin-documents__heading {
  margin: 0;
  font-size: var(--font-size-h2);
  font-weight: 700;
}

.admin-documents__intro {
  max-width: 65ch;
  margin: 0 0 1.5rem;
  color: var(--color-text-muted);
}

.admin-documents__state {
  color: var(--color-text-muted);
}

.admin-documents__banner {
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-danger);
  border-radius: 0.375rem;
  background: var(--color-surface-raised);
  color: var(--color-danger);
  font-weight: 600;
}

.admin-documents__table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 2rem;
}

.admin-documents__table th,
.admin-documents__table td {
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  text-align: start;
  vertical-align: top;
}

.admin-documents__title {
  display: block;
  font-weight: 600;
}

.admin-documents__slug {
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.admin-documents__row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.admin-documents__form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 60rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
}

.admin-documents__grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
}

.admin-documents__section-title {
  margin: 0 0 0.75rem;
  font-size: 1.125rem;
  font-weight: 700;
}

.admin-documents__hint {
  margin: 0.25rem 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.admin-documents__label {
  display: block;
  margin-bottom: 0.375rem;
  font-weight: 600;
}

.admin-documents__file-input {
  font: inherit;
}

.admin-documents__field-error {
  margin: 0.25rem 0 0;
  color: var(--color-danger);
  font-weight: 600;
}

.admin-documents__panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 1.25rem;
  outline: none;
}

.admin-documents__progress {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.admin-documents__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.admin-documents__status {
  margin: 0;
  min-height: 1.25em;
  font-weight: 600;
}

.admin-documents__status--error {
  color: var(--color-danger);
}

.admin-documents__status--success {
  color: var(--color-success);
}
</style>
