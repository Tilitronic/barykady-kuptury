<template>
  <div class="q-pa-md">
    <h1 class="text-h5 q-mt-none q-mb-sm">{{ t("admin.import.heading") }}</h1>
    <p class="text-body2 text-grey-8 q-mb-lg">{{ t("admin.import.intro") }}</p>

    <UiCard
      flat
      bordered
      class="q-mb-lg"
      data-testid="import-google-connection"
    >
      <UiCardSection>
        <h2 class="text-subtitle1 q-mt-none q-mb-sm">
          {{ t("admin.import.google.connectionHeading") }}
        </h2>
        <p
          v-if="connection?.connected === true"
          class="text-body2 q-mb-xs"
          data-testid="import-google-connected"
        >
          {{
            t("admin.import.google.connectedAs", {
              email: connection.googleEmail ?? ""
            })
          }}
        </p>
        <p v-else class="text-body2 q-mb-xs">
          {{ t("admin.import.google.connectionRequired") }}
        </p>
        <p class="text-caption text-grey-7 q-mb-sm">
          {{ t("admin.import.google.folderHint") }}
        </p>
        <UiBtn
          v-if="connection?.connected === true"
          variant="flat"
          :label="t('admin.import.google.disconnect')"
          :disable="connectionPending"
          data-testid="import-google-disconnect"
          @click="disconnect"
        />
        <UiBtn
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
      </UiCardSection>
    </UiCard>

    <UiForm class="q-gutter-md" greedy @submit="runGoogle('apply')">
      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-6">
          <UiSelect
            v-model="kind"
            :options="kindOptions"
            emit-value
            map-options
            :label="t('admin.import.fields.kind')"
            data-testid="import-kind"
          />
        </div>

        <div class="col-12 col-sm-6">
          <UiSelect
            v-model="locale"
            :options="localeOptions"
            emit-value
            map-options
            :label="t('admin.import.fields.locale')"
            data-testid="import-locale"
          />
        </div>

        <div class="col-12">
          <UiInput
            v-model="title"
            :label="t('admin.import.fields.title')"
            :hint="t('admin.import.fields.titleHint')"
            :error="fieldError === 'title'"
            :error-message="t('admin.import.errors.titleRequired')"
            data-testid="import-title"
            @update:model-value="fieldError = null"
          />
        </div>

        <div class="col-12">
          <UiInput
            v-model="description"
            type="textarea"
            autogrow
            :label="t('admin.import.fields.description')"
            data-testid="import-description"
          />
        </div>

        <div v-if="kind === 'document'" class="col-12 col-sm-6">
          <UiInput
            v-model="documentType"
            :label="t('admin.import.fields.documentType')"
            data-testid="import-document-type"
          />
        </div>

        <div class="col-12 col-sm-6">
          <UiInput
            v-model="slug"
            :label="t('admin.import.fields.slug')"
            :hint="t('admin.import.fields.slugHint')"
            :error="fieldError === 'slug'"
            :error-message="t('admin.import.errors.slugRequired')"
            data-testid="import-slug"
            @update:model-value="fieldError = null"
          />
        </div>

        <div class="col-12">
          <UiBtn
            type="button"
            variant="primary"
            :label="t('admin.import.google.picker')"
            :loading="pickerPending"
            :disable="pickerPending"
            data-testid="import-picker"
            @click="pickDocument"
          />
          <p class="text-caption text-grey-7 q-mt-xs q-mb-none">
            {{ t("admin.import.google.pickerHint") }}
          </p>
        </div>

        <div class="col-12">
          <UiInput
            v-model="googleFileId"
            :label="t('admin.import.google.manualLabel')"
            :hint="t('admin.import.google.manualHint')"
            data-testid="import-google-id"
          />
        </div>

        <div class="col-12">
          <UiCheckbox
            v-model="allowOriginalDownload"
            :label="t('admin.import.fields.allowOriginalDownload')"
          />
          <p class="text-caption text-grey-7 q-mt-xs q-mb-none">
            {{ t("admin.import.fields.allowOriginalDownloadHint") }}
          </p>
        </div>
      </div>

      <div class="row q-gutter-sm">
        <UiBtn
          variant="flat"
          :label="t('admin.import.google.check')"
          :disable="googlePending"
          data-testid="import-check"
          @click="runGoogle('preview')"
        />
        <UiBtn
          type="submit"
          :label="googleApplyLabel"
          :loading="googlePending"
          data-testid="import-apply"
        />
      </div>
    </UiForm>

    <UiBanner
      v-if="message !== ''"
      class="q-mt-md"
      :class="
        messageKind === 'error'
          ? 'bg-negative text-white'
          : 'bg-positive text-white'
      "
      rounded
      role="status"
      aria-live="polite"
      data-testid="import-status"
    >
      {{ message }}
    </UiBanner>

    <UiCard
      v-if="job !== null || syncSummary !== null"
      flat
      bordered
      class="q-mt-lg"
    >
      <UiCardSection>
        <h2 class="text-h6 q-mt-none q-mb-sm">
          {{ t("admin.import.sync.heading") }}
        </h2>
        <p v-if="job !== null" class="text-body2 q-mb-sm">
          {{ jobStatusLabel }}
        </p>
        <p
          v-if="job !== null && job.entityId !== null"
          class="text-body2 q-mb-sm"
        >
          {{
            t("admin.import.sync.lastSynced", {
              time: lastSyncedAt ?? t("admin.import.sync.never")
            })
          }}
        </p>
      </UiCardSection>

      <UiCardSection v-if="syncSummary !== null">
        <h3 class="text-subtitle1 q-mt-none q-mb-sm">
          {{ t("admin.import.sync.diffHeading") }}
        </h3>
        <UiList dense>
          <UiItem>
            <UiItemSection>
              {{
                t("admin.import.sync.blocks", {
                  previous: syncSummary.previousBlocks,
                  next: syncSummary.nextBlocks
                })
              }}
            </UiItemSection>
          </UiItem>
          <UiItem>
            <UiItemSection>
              {{
                t("admin.import.sync.headings", {
                  count: syncSummary.nextHeadings.length
                })
              }}
            </UiItemSection>
          </UiItem>
          <UiItem>
            <UiItemSection>
              {{
                t("admin.import.sync.images", { count: syncSummary.imageCount })
              }}
            </UiItemSection>
          </UiItem>
          <UiItem>
            <UiItemSection>
              {{
                t("admin.import.sync.tables", { count: syncSummary.tableCount })
              }}
            </UiItemSection>
          </UiItem>
          <UiItem v-if="syncSummary.addedHeadings.length > 0">
            <UiItemSection>
              {{
                t("admin.import.sync.added", {
                  items: syncSummary.addedHeadings.join(", ")
                })
              }}
            </UiItemSection>
          </UiItem>
          <UiItem v-if="syncSummary.removedHeadings.length > 0">
            <UiItemSection>
              {{
                t("admin.import.sync.removed", {
                  items: syncSummary.removedHeadings.join(", ")
                })
              }}
            </UiItemSection>
          </UiItem>
        </UiList>
      </UiCardSection>
    </UiCard>

    <UiCard
      v-if="latestRun !== null"
      flat
      bordered
      class="q-mt-lg"
      data-testid="schedule-run"
    >
      <UiCardSection>
        <h2 class="text-h6 q-mt-none q-mb-sm">
          {{ t("admin.import.schedule.heading") }}
        </h2>
        <p class="text-body2 q-mb-sm">
          {{ t("admin.import.schedule.description") }}
        </p>
        <p class="text-body2 q-mb-sm">
          {{ t("admin.import.schedule.lastRun") }}:
          {{ new Date(latestRun.startedAt).toLocaleString() }}
        </p>
        <UiList dense>
          <UiItem>
            <UiItemSection>
              {{
                t("admin.import.schedule.checked", { count: latestRun.checked })
              }}
            </UiItemSection>
          </UiItem>
          <UiItem>
            <UiItemSection>
              {{
                t("admin.import.schedule.updated", { count: latestRun.updated })
              }}
            </UiItemSection>
          </UiItem>
          <UiItem>
            <UiItemSection>
              {{
                t("admin.import.schedule.failed", { count: latestRun.failed })
              }}
            </UiItemSection>
          </UiItem>
          <UiItem>
            <UiItemSection>
              {{
                t("admin.import.schedule.skipped", { count: latestRun.skipped })
              }}
            </UiItemSection>
          </UiItem>
        </UiList>
      </UiCardSection>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  UiBanner,
  UiBtn,
  UiCard,
  UiCardSection,
  UiCheckbox,
  UiForm,
  UiInput,
  UiItem,
  UiItemSection,
  UiList,
  UiSelect
} from "@/components/ui";
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
 * Functionality-first: bare Quasar controls, no bespoke admin CSS. The route is
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
