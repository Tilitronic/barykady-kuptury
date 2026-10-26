<template>
  <div class="admin-import">
    <h1 class="admin-import__heading">{{ t("admin.import.heading") }}</h1>
    <p class="admin-import__intro">{{ t("admin.import.intro") }}</p>

    <BkCard
      flat
      bordered
      class="admin-import__card admin-import__card--lead"
      data-testid="import-google-connection"
    >
      <BkCardSection>
        <h2 class="admin-import__section-title">
          {{ t("admin.import.google.connectionHeading") }}
        </h2>
        <p
          v-if="connection?.connected === true"
          class="admin-import__body admin-import__body--tight"
          data-testid="import-google-connected"
        >
          {{
            t("admin.import.google.connectedAs", {
              email: connection.googleEmail ?? ""
            })
          }}
        </p>
        <p v-else class="admin-import__body admin-import__body--tight">
          {{ t("admin.import.google.connectionRequired") }}
        </p>
        <p class="admin-import__hint">
          {{ t("admin.import.google.folderHint") }}
        </p>
        <BkButton
          v-if="connection?.connected === true"
          variant="flat"
          :label="t('admin.import.google.disconnect')"
          :disable="connectionPending"
          data-testid="import-google-disconnect"
          @click="disconnect"
        />
        <BkButton
          v-else
          variant="secondary"
          :label="
            needsReconnect
              ? t('admin.import.google.reconnect')
              : t('admin.import.google.connect')
          "
          :loading="connectionPending"
          data-testid="import-google-connect"
          @click="connect"
        />
      </BkCardSection>
    </BkCard>

    <BkForm class="admin-import__form" greedy @submit="runGoogle('apply')">
      <div class="admin-import__grid">
        <div class="admin-import__field admin-import__field--half">
          <BkSelect
            v-model="kind"
            :options="kindOptions"
            emit-value
            map-options
            :label="t('admin.import.fields.kind')"
            data-testid="import-kind"
          />
        </div>

        <div class="admin-import__field admin-import__field--half">
          <BkSelect
            v-model="locale"
            :options="localeOptions"
            emit-value
            map-options
            :label="t('admin.import.fields.locale')"
            data-testid="import-locale"
          />
        </div>

        <div class="admin-import__field">
          <BkInput
            v-model="title"
            :label="t('admin.import.fields.title')"
            :hint="t('admin.import.fields.titleHint')"
            :error="fieldError === 'title'"
            :error-message="t('admin.import.errors.titleRequired')"
            data-testid="import-title"
            @update:model-value="fieldError = null"
          />
        </div>

        <div class="admin-import__field">
          <BkInput
            v-model="description"
            type="textarea"
            autogrow
            :label="t('admin.import.fields.description')"
            data-testid="import-description"
          />
        </div>

        <div
          v-if="kind === 'document'"
          class="admin-import__field admin-import__field--half"
        >
          <BkInput
            v-model="documentType"
            :label="t('admin.import.fields.documentType')"
            data-testid="import-document-type"
          />
        </div>

        <div class="admin-import__field admin-import__field--half">
          <BkInput
            v-model="slug"
            :label="t('admin.import.fields.slug')"
            :hint="t('admin.import.fields.slugHint')"
            :error="fieldError === 'slug'"
            :error-message="t('admin.import.errors.slugRequired')"
            data-testid="import-slug"
            @update:model-value="fieldError = null"
          />
        </div>

        <div class="admin-import__field">
          <BkButton
            type="button"
            variant="primary"
            :label="t('admin.import.google.picker')"
            :loading="pickerPending"
            :disable="pickerPending"
            data-testid="import-picker"
            @click="pickDocument"
          />
          <p class="admin-import__hint admin-import__hint--tight">
            {{ t("admin.import.google.pickerHint") }}
          </p>
        </div>

        <div class="admin-import__field">
          <BkInput
            v-model="googleFileId"
            :label="t('admin.import.google.manualLabel')"
            :hint="t('admin.import.google.manualHint')"
            data-testid="import-google-id"
          />
        </div>

        <div class="admin-import__field">
          <BkCheckbox
            v-model="allowOriginalDownload"
            :label="t('admin.import.fields.allowOriginalDownload')"
          />
          <p class="admin-import__hint admin-import__hint--tight">
            {{ t("admin.import.fields.allowOriginalDownloadHint") }}
          </p>
        </div>
      </div>

      <div class="admin-import__actions">
        <BkButton
          variant="flat"
          :label="t('admin.import.google.check')"
          :disable="googlePending"
          data-testid="import-check"
          @click="runGoogle('preview')"
        />
        <BkButton
          type="submit"
          :label="googleApplyLabel"
          :loading="googlePending"
          data-testid="import-apply"
        />
      </div>
    </BkForm>

    <BkBanner
      v-if="message !== ''"
      class="admin-import__status"
      :class="
        messageKind === 'error'
          ? 'admin-import__status--error'
          : 'admin-import__status--success'
      "
      rounded
      role="status"
      aria-live="polite"
      data-testid="import-status"
    >
      {{ message }}
    </BkBanner>

    <BkCard
      v-if="job !== null || syncSummary !== null"
      flat
      bordered
      class="admin-import__card admin-import__card--follow"
    >
      <BkCardSection>
        <h2 class="admin-import__card-title">
          {{ t("admin.import.sync.heading") }}
        </h2>
        <p v-if="job !== null" class="admin-import__body">
          {{ jobStatusLabel }}
        </p>
        <p
          v-if="job !== null && job.entityId !== null"
          class="admin-import__body"
        >
          {{
            t("admin.import.sync.lastSynced", {
              time: lastSyncedAt ?? t("admin.import.sync.never")
            })
          }}
        </p>
      </BkCardSection>

      <BkCardSection v-if="syncSummary !== null">
        <h3 class="admin-import__section-title">
          {{ t("admin.import.sync.diffHeading") }}
        </h3>
        <BkList dense>
          <BkItem>
            <BkItemSection>
              {{
                t("admin.import.sync.blocks", {
                  previous: syncSummary.previousBlocks,
                  next: syncSummary.nextBlocks
                })
              }}
            </BkItemSection>
          </BkItem>
          <BkItem>
            <BkItemSection>
              {{
                t("admin.import.sync.headings", {
                  count: syncSummary.nextHeadings.length
                })
              }}
            </BkItemSection>
          </BkItem>
          <BkItem>
            <BkItemSection>
              {{
                t("admin.import.sync.images", { count: syncSummary.imageCount })
              }}
            </BkItemSection>
          </BkItem>
          <BkItem>
            <BkItemSection>
              {{
                t("admin.import.sync.tables", { count: syncSummary.tableCount })
              }}
            </BkItemSection>
          </BkItem>
          <BkItem v-if="syncSummary.addedHeadings.length > 0">
            <BkItemSection>
              {{
                t("admin.import.sync.added", {
                  items: syncSummary.addedHeadings.join(", ")
                })
              }}
            </BkItemSection>
          </BkItem>
          <BkItem v-if="syncSummary.removedHeadings.length > 0">
            <BkItemSection>
              {{
                t("admin.import.sync.removed", {
                  items: syncSummary.removedHeadings.join(", ")
                })
              }}
            </BkItemSection>
          </BkItem>
        </BkList>
      </BkCardSection>
    </BkCard>

    <BkCard
      v-if="latestRun !== null"
      flat
      bordered
      class="admin-import__card admin-import__card--follow"
      data-testid="schedule-run"
    >
      <BkCardSection>
        <h2 class="admin-import__card-title">
          {{ t("admin.import.schedule.heading") }}
        </h2>
        <p class="admin-import__body">
          {{ t("admin.import.schedule.description") }}
        </p>
        <p class="admin-import__body">
          {{ t("admin.import.schedule.lastRun") }}:
          {{ new Date(latestRun.startedAt).toLocaleString() }}
        </p>
        <BkList dense>
          <BkItem>
            <BkItemSection>
              {{
                t("admin.import.schedule.checked", { count: latestRun.checked })
              }}
            </BkItemSection>
          </BkItem>
          <BkItem>
            <BkItemSection>
              {{
                t("admin.import.schedule.updated", { count: latestRun.updated })
              }}
            </BkItemSection>
          </BkItem>
          <BkItem>
            <BkItemSection>
              {{
                t("admin.import.schedule.failed", { count: latestRun.failed })
              }}
            </BkItemSection>
          </BkItem>
          <BkItem>
            <BkItemSection>
              {{
                t("admin.import.schedule.skipped", { count: latestRun.skipped })
              }}
            </BkItemSection>
          </BkItem>
        </BkList>
      </BkCardSection>
    </BkCard>
  </div>
</template>

<script setup lang="ts">
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BkBanner,
  BkButton,
  BkCard,
  BkCardSection,
  BkCheckbox,
  BkForm,
  BkInput,
  BkItem,
  BkItemSection,
  BkList,
  BkSelect
} from "@/components/bk";
import { computed, inject, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import {
  fetchLatestSyncRun,
  fetchSourceSyncedAt,
  type SyncRun
} from "@/features/import/contentSyncRuns";
import {
  disconnectGoogleConnection,
  getGoogleConnectionStatus,
  getGooglePickerSession,
  startGoogleConnection,
  type GoogleConnectionStatus
} from "@/features/import/googleConnectionClient";
import {
  openGooglePicker,
  type GooglePickerDocument
} from "@/features/import/googlePicker";
import {
  startGoogleSync,
  waitForSyncJob
} from "@/features/import/googleSyncClient";
import type { SyncDiffSummary } from "@/features/import/syncDiff";
import type { SyncJob, SyncJobRequest } from "@/features/import/syncJobs";
import { SUPPORTED_LOCALES, type Locale } from "@/features/i18n/locales";
import type { Database } from "@/types/database.types";

/**
 * T-041 S5 (v1 scope) — Google Docs import/sync admin route.
 *
 * Styling lives in the scoped SCSS block below as BEM rules over the bk/ seam.
 * The previous "no bespoke admin CSS" shortcut produced 66 Quasar utility
 * tokens; T-049 forbids class-to-style syntax, so spacing/typography are now
 * expressed with our tokens instead of utilities. The route is
 * lazy-split, so none of this (or the import stack) enters the public entry
 * chunk. Manual file upload is deliberately absent in v1; the Google export
 * path runs the same server-side DOCX converter.
 */
const props = defineProps<{
  startGoogle?: typeof startGoogleSync;
  waitForJob?: typeof waitForSyncJob;
  getConnection?: typeof getGoogleConnectionStatus;
  startConnection?: typeof startGoogleConnection;
  disconnectConnection?: typeof disconnectGoogleConnection;
  getPickerSession?: typeof getGooglePickerSession;
  openPicker?: (
    config: Parameters<typeof openGooglePicker>[0]
  ) => Promise<GooglePickerDocument | null>;
  supabase?: SupabaseClient<Database> | null;
}>();

const { t } = useI18n();
const injectedSupabase = inject(SUPABASE_CLIENT_KEY, null);
const client = computed(() => props.supabase ?? injectedSupabase);

const kindOptions = [
  { label: t("admin.import.fields.document"), value: "document" },
  { label: t("admin.import.fields.publication"), value: "publication" }
];
const localeOptions = SUPPORTED_LOCALES.map(value => ({
  label: value.toUpperCase(),
  value
}));

const kind = ref<"document" | "publication">("document");
const locale = ref<Locale>("en");
const title = ref("");
const description = ref("");
const documentType = ref("report");
const slug = ref("");
const googleFileId = ref("");
const allowOriginalDownload = ref(false);
const googlePending = ref(false);
const message = ref("");
const messageKind = ref<"error" | "success" | null>(null);
const fieldError = ref<"title" | "slug" | null>(null);
const job = ref<SyncJob | null>(null);
const syncSummary = ref<SyncDiffSummary | null>(null);
const importedEntityId = ref<string | null>(null);
const latestRun = ref<SyncRun | null>(null);
const lastSyncedAt = ref<string | null>(null);
const connection = ref<GoogleConnectionStatus | null>(null);
const connectionPending = ref(false);
const pickerPending = ref(false);

const needsReconnect = computed(
  () => connection.value?.consentStatus === "reconsent_required"
);

async function loadConnection(): Promise<void> {
  if (client.value === null) return;
  const load = props.getConnection ?? getGoogleConnectionStatus;
  try {
    connection.value = await load(client.value);
  } catch {
    connection.value = null;
  }
}

onMounted(() => {
  if (client.value === null) return;
  void loadConnection();
  void fetchLatestSyncRun(client.value)
    .then(run => {
      latestRun.value = run;
    })
    .catch(() => undefined);
});

const googleApplyLabel = computed(() =>
  importedEntityId.value === null
    ? t("admin.import.google.import")
    : t("admin.import.google.syncNow")
);

const jobStatusLabel = computed(() => {
  if (job.value === null) return "";
  switch (job.value.status) {
    case "queued":
      return t("admin.import.sync.jobQueued");
    case "running":
      return t("admin.import.sync.jobRunning");
    case "succeeded":
      return t("admin.import.sync.jobSucceeded");
    case "unchanged":
      return t("admin.import.sync.jobUnchanged");
    case "blocked":
      return t("admin.import.sync.jobBlocked");
    case "failed":
      return t("admin.import.sync.jobFailed");
    default:
      return "";
  }
});

function setMessage(text: string, kindValue: "error" | "success"): void {
  message.value = text;
  messageKind.value = kindValue;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function validate(): boolean {
  if (title.value.trim() === "") {
    fieldError.value = "title";
    setMessage(t("admin.import.errors.titleRequired"), "error");
    return false;
  }
  if (slug.value.trim() === "") {
    const generated = slugify(title.value);
    if (generated === "") {
      fieldError.value = "slug";
      setMessage(t("admin.import.errors.slugRequired"), "error");
      return false;
    }
    slug.value = generated;
  }
  fieldError.value = null;
  return true;
}

function driveFileId(value: string): string {
  const trimmed = value.trim();
  const match = /\/document\/d\/([^/]+)/u.exec(trimmed);
  return match?.[1] ?? trimmed;
}

async function connect(): Promise<void> {
  if (client.value === null) {
    setMessage(t("admin.import.errors.noSupabase"), "error");
    return;
  }
  connectionPending.value = true;
  try {
    const start = props.startConnection ?? startGoogleConnection;
    const authUrl = await start(client.value);
    if (authUrl === null) {
      setMessage(t("admin.import.google.connectionUnavailable"), "error");
      return;
    }
    window.location.assign(authUrl);
  } catch {
    setMessage(t("admin.import.google.connectionUnavailable"), "error");
  } finally {
    connectionPending.value = false;
  }
}

async function pickDocument(): Promise<void> {
  if (client.value === null) {
    setMessage(t("admin.import.errors.noSupabase"), "error");
    return;
  }
  pickerPending.value = true;
  try {
    const getSession = props.getPickerSession ?? getGooglePickerSession;
    const session = await getSession(client.value);
    if (session === null) {
      setMessage(t("admin.import.google.pickerUnavailable"), "error");
      return;
    }
    const open = props.openPicker ?? openGooglePicker;
    const picked = await open({
      accessToken: session.accessToken,
      folderId: session.folderId,
      appId: session.appId,
      developerKey: session.developerKey
    });
    if (picked !== null) {
      googleFileId.value = picked.id;
      setMessage(
        t("admin.import.google.pickerSelected", { name: picked.name }),
        "success"
      );
    }
  } catch {
    setMessage(t("admin.import.google.pickerUnavailable"), "error");
  } finally {
    pickerPending.value = false;
  }
}

async function disconnect(): Promise<void> {
  if (client.value === null) return;
  connectionPending.value = true;
  try {
    const stop = props.disconnectConnection ?? disconnectGoogleConnection;
    await stop(client.value);
    connection.value = null;
  } catch {
    setMessage(t("admin.import.google.connectionUnavailable"), "error");
  } finally {
    connectionPending.value = false;
  }
}

/**
 * Stable job error codes map to actionable localized copy. A timeout code is
 * deliberately distinct per Google hop so support can tell a token refresh from
 * a slow export without reading provider messages.
 */
function googleErrorMessage(code: string | null): string {
  switch (code) {
    case "out-of-folder":
      return t("admin.import.errors.googleOutOfFolder");
    case "folder-not-configured":
      return t("admin.import.errors.googleFolderNotConfigured");
    case "reconnect-required":
      return t("admin.import.errors.googleReconnectRequired");
    case "credentials-unavailable":
      return t("admin.import.errors.googleConnectRequired");
    case "token-timeout":
      return t("admin.import.errors.googleTokenTimeout");
    case "drive-metadata-timeout":
      return t("admin.import.errors.googleMetadataTimeout");
    case "drive-export-timeout":
      return t("admin.import.errors.googleExportTimeout");
    default:
      return t("admin.import.errors.googleFailed");
  }
}

async function runGoogle(mode: "preview" | "apply"): Promise<void> {
  if (client.value === null) {
    setMessage(t("admin.import.errors.noSupabase"), "error");
    return;
  }
  if (!validate()) return;
  const fileId = driveFileId(googleFileId.value);
  if (fileId === "") {
    setMessage(t("admin.import.errors.googleFailed"), "error");
    return;
  }

  googlePending.value = true;
  syncSummary.value = null;
  job.value = null;
  try {
    const request: SyncJobRequest = {
      mode,
      kind: kind.value,
      fileId,
      entityId: importedEntityId.value,
      locale: locale.value,
      slug: slug.value.trim(),
      title: title.value.trim(),
      description: description.value.trim() || null,
      documentType: documentType.value.trim() || "report",
      publish: true,
      allowOriginalDownload: allowOriginalDownload.value
    };

    const start = props.startGoogle ?? startGoogleSync;
    const wait = props.waitForJob ?? waitForSyncJob;
    const jobId = await start(client.value, request);
    const finished = await wait(client.value, jobId);
    job.value = finished;
    if (finished?.summary) syncSummary.value = finished.summary;
    if (finished?.entityId) {
      importedEntityId.value = finished.entityId;
      try {
        lastSyncedAt.value = await fetchSourceSyncedAt(
          client.value,
          kind.value,
          finished.entityId
        );
      } catch {
        lastSyncedAt.value = null;
      }
    }
    if (finished?.status === "succeeded") {
      setMessage(t("admin.import.sync.jobSucceeded"), "success");
    } else if (finished?.status === "unchanged") {
      setMessage(t("admin.import.status.unchanged"), "success");
    } else if (finished?.status === "failed") {
      setMessage(googleErrorMessage(finished.errorCode), "error");
      if (
        finished.errorCode === "credentials-unavailable" ||
        finished.errorCode === "reconnect-required"
      ) {
        await loadConnection();
      }
    } else if (finished?.status === "blocked") {
      setMessage(t("admin.import.errors.googleFailed"), "error");
    }
  } catch {
    setMessage(t("admin.import.errors.googleFailed"), "error");
  } finally {
    googlePending.value = false;
  }
}
</script>

<style lang="scss" scoped>
/*
 * WHY BEM + SCSS instead of Quasar class-to-style helpers (T-049 §2): visual
 * decisions must live in the component beside the markup they describe and
 * use our tokens, so removing a utility from the bundle can never silently
 * change this page. Where a utility encoded a Quasar default, its compiled
 * value is reproduced exactly (verified against Quasar 2.35):
 *   1rem  = q-pa-md / q-mt-md / q-gutter-md / q-col-gutter-md
 *   1.5rem = q-mb-lg / q-mt-lg, 0.5rem = q-mb-sm / q-gutter-sm,
 *   0.25rem = q-mb-xs / q-mt-xs.
 * Typography values come from Quasar's .text-h5/.text-h6/.text-subtitle1/
 * .text-body2/.text-caption rules, so the page keeps its existing visual scale.
 */
.admin-import {
  padding: 1rem; // q-pa-md
}

.admin-import__heading {
  margin: 0 0 0.5rem; // q-mt-none q-mb-sm
  font-size: 1.5rem; // .text-h5
  font-weight: 400;
  line-height: 2rem;
  letter-spacing: normal;
}

.admin-import__intro {
  margin: 0 0 1.5rem; // q-mb-lg
  color: var(--color-text-muted);
  font-size: 0.875rem; // .text-body2
  font-weight: 400;
  line-height: 1.25rem;
  letter-spacing: 0.01786em;
}

.admin-import__card {
  &--lead {
    margin-bottom: 1.5rem; // q-mb-lg
  }

  &--follow {
    margin-top: 1.5rem; // q-mt-lg
  }
}

.admin-import__section-title {
  margin: 0 0 0.5rem; // q-mt-none q-mb-sm
  font-size: 1rem; // .text-subtitle1
  font-weight: 400;
  line-height: 1.75rem;
  letter-spacing: 0.00937em;
}

.admin-import__card-title {
  margin: 0 0 0.5rem; // q-mt-none q-mb-sm
  font-size: 1.25rem; // .text-h6
  font-weight: 500;
  line-height: 2rem;
  letter-spacing: 0.0125em;
}

.admin-import__body {
  margin: 0 0 0.5rem; // q-mb-sm
  font-size: 0.875rem; // .text-body2
  font-weight: 400;
  line-height: 1.25rem;
  letter-spacing: 0.01786em;

  &--tight {
    margin-bottom: 0.25rem; // q-mb-xs
  }
}

.admin-import__hint {
  margin: 0 0 0.5rem; // q-mb-sm
  color: var(--color-text-muted);
  font-size: 0.75rem; // .text-caption
  font-weight: 400;
  line-height: 1.25rem;
  letter-spacing: 0.03333em;

  &--tight {
    margin: 0.25rem 0 0; // q-mt-xs q-mb-none
  }
}

/*
 * WHY flex column + gap rather than q-gutter-md: Quasar's gutter is negative
 * margins plus per-child margins; a flex gap expresses the same 16px rhythm
 * without utility classes and without margin-collapse surprises.
 */
.admin-import__form {
  display: flex;
  flex-direction: column;
  gap: 1rem; // q-gutter-md
}

/*
 * WHY a 12-column grid instead of row/col-*: the form mixes full-width fields
 * with half-width pairs. Grid reproduces the 16px gutter and the 600px
 * breakpoint (Quasar's sm) without pulling in the flex helper family.
 */
.admin-import__grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 1rem; // q-col-gutter-md
}

.admin-import__field {
  grid-column: 1 / -1; // .col-12

  &--half {
    @media (min-width: 600px) {
      grid-column: span 6; // .col-sm-6
    }
  }
}

.admin-import__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem; // q-gutter-sm
}

.admin-import__status {
  margin-top: 1rem; // q-mt-md

  /*
   * WHY the Quasar semantic variables: the previous markup used bg-negative /
   * bg-positive, which quasar.variables.scss maps to the brand danger/success
   * surfaces. Using the same variables keeps the status colours identical
   * while removing the class-to-style dependency.
   */
  &--error {
    background: var(--q-negative);
    color: #fff;
  }

  &--success {
    background: var(--q-positive);
    color: #fff;
  }
}
</style>
