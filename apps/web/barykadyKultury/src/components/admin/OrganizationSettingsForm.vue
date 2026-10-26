<template>
  <!--
    T-048 — one settings form for General and Contacts.

    Design authority:
      * docs/architecture.md §6.1 — one row per fact, per-locale textual
        values, global visible flag, audit fields.
      * docs/tickets/T-048 — every listed fact editable + visible-toggle,
        validated by kind with localized field errors, who/when surfaced.

    The form saves the complete definition vocabulary (see submit): saving only
    the mounted group would hide the other group on a fresh install, because a
    provisioned table treats an absent key as hidden. That is also what moves a
    fresh install from static parity to authoritative settings mode without a
    partial-save resurrection (see features/settings/resolve.ts).
  -->
  <div class="org-settings-form" :data-testid="`settings-form-${group}`">
    <p v-if="loading" class="org-settings-form__state" role="status">
      {{ t("content.loading") }}
    </p>

    <BkBanner
      v-else-if="loadError !== null"
      rounded
      role="alert"
      data-testid="settings-load-error"
    >
      <p class="org-settings-form__banner-text">{{ loadError }}</p>
      <BkButton
        variant="flat"
        :label="t('admin.settings.retry')"
        @click="load"
      />
    </BkBanner>

    <form v-else novalidate @submit.prevent="submit">
      <div class="org-settings-form__grid">
        <div
          v-for="definition in scalarDefinitions"
          :key="definition.key"
          class="org-settings-form__field"
        >
          <BkInput
            :model-value="draftValue(definition.key)"
            :label="t(definition.labelKey)"
            :error="errors[definition.key] !== undefined"
            :error-message="errorMessage(definition.key)"
            :data-testid="`setting-input-${definition.key}`"
            @update:model-value="setDraftValue(definition.key, $event)"
          />
          <div :data-testid="`setting-visible-${definition.key}`">
            <BkCheckbox
              :model-value="draftVisible(definition.key)"
              :label="t('admin.settings.visible')"
              @update:model-value="setVisible(definition.key, $event)"
            />
          </div>
          <p
            v-if="auditFor(definition.key)"
            class="org-settings-form__audit"
            :data-testid="`setting-audit-${definition.key}`"
          >
            {{ auditFor(definition.key) }}
          </p>
        </div>
      </div>

      <template v-if="localizedDefinitions.length > 0">
        <h2 class="org-settings-form__section-title">
          {{ t("admin.settings.sections.localized") }}
        </h2>

        <!-- Reuses the AdminLocaleTabs keyboard contract through AdminTabs. -->
        <AdminTabs
          :tabs="localeTabs"
          :active="activeLocale"
          :label="t('admin.settings.sections.localized')"
          id-prefix="settings-locale"
          @update:active="onLocaleChange"
        />

        <div
          :id="`settings-locale-panel-${activeLocale}`"
          role="tabpanel"
          :aria-labelledby="`settings-locale-tab-${activeLocale}`"
          tabindex="0"
          class="org-settings-form__locale-panel"
        >
          <div
            v-for="definition in localizedDefinitions"
            :key="definition.key"
            class="org-settings-form__field"
          >
            <BkInput
              :model-value="draftValue(definition.key, activeLocale)"
              type="textarea"
              autogrow
              :label="t(definition.labelKey)"
              :error="errors[definition.key] !== undefined"
              :error-message="errorMessage(definition.key)"
              :data-testid="`setting-input-${definition.key}-${activeLocale}`"
              @update:model-value="
                setDraftValue(definition.key, $event, activeLocale)
              "
            />
            <div :data-testid="`setting-visible-${definition.key}`">
              <BkCheckbox
                :model-value="draftVisible(definition.key)"
                :label="t('admin.settings.visible')"
                @update:model-value="setVisible(definition.key, $event)"
              />
            </div>
            <p
              v-if="auditFor(definition.key)"
              class="org-settings-form__audit"
              :data-testid="`setting-audit-${definition.key}`"
            >
              {{ auditFor(definition.key) }}
            </p>
          </div>
        </div>
      </template>

      <template v-if="socialDefinitions.length > 0">
        <h2 class="org-settings-form__section-title">
          {{ t("admin.settings.sections.social") }}
        </h2>
        <p class="org-settings-form__hint">
          {{ t("admin.settings.sections.socialHint") }}
        </p>

        <div class="org-settings-form__grid">
          <div
            v-for="definition in socialDefinitions"
            :key="definition.key"
            class="org-settings-form__field"
          >
            <BkInput
              :model-value="draftValue(definition.key)"
              type="url"
              :label="t(definition.labelKey)"
              :error="errors[definition.key] !== undefined"
              :error-message="errorMessage(definition.key)"
              :data-testid="`setting-input-${definition.key}`"
              @update:model-value="setDraftValue(definition.key, $event)"
            />
            <div :data-testid="`setting-visible-${definition.key}`">
              <BkCheckbox
                :model-value="draftVisible(definition.key)"
                :label="t('admin.settings.visible')"
                @update:model-value="setVisible(definition.key, $event)"
              />
            </div>
            <p
              v-if="auditFor(definition.key)"
              class="org-settings-form__audit"
              :data-testid="`setting-audit-${definition.key}`"
            >
              {{ auditFor(definition.key) }}
            </p>
          </div>
        </div>
      </template>

      <p
        v-if="statusMessage !== ''"
        class="org-settings-form__status"
        role="status"
        aria-live="polite"
        data-testid="settings-status"
      >
        {{ statusMessage }}
      </p>

      <BkBanner
        v-if="saveError !== null"
        rounded
        role="alert"
        data-testid="settings-save-error"
      >
        {{ saveError }}
      </BkBanner>

      <div class="org-settings-form__actions">
        <BkButton
          type="submit"
          :label="
            saving ? t('admin.settings.saving') : t('admin.settings.save')
          "
          :loading="saving"
          :disable="saving"
          data-testid="settings-save"
        />
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { SupabaseClient } from "@supabase/supabase-js";
import { computed, inject, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

import AdminTabs, { type AdminTab } from "@/components/admin/AdminTabs.vue";
import { BkBanner, BkButton, BkCheckbox, BkInput } from "@/components/bk";
import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import {
  fetchAdminOrganizationSettings,
  saveOrganizationSettings,
  type OrganizationSettingChange
} from "@/features/settings/api";
import {
  SETTING_DEFINITIONS,
  type SettingDefinition,
  type SettingGroup,
  type SettingValue
} from "@/features/settings/definition";
import type { OrganizationSettingsRow } from "@/features/settings/resolve";
import { applyOrganizationSettings } from "@/features/settings/state";
import type { SettingValidationCode } from "@/features/settings/validation";
import { validateSettingValue } from "@/features/settings/validation";
import { formatDate } from "@/features/i18n/format";
import {
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  isLocale,
  type Locale
} from "@/features/i18n/locales";
import type { Database } from "@/types/database.types";

/**
 * T-048 — settings form orchestration. Components never build queries: every
 * read/write goes through `features/settings/api` (docs/architecture.md §3).
 */
const props = defineProps<{
  readonly group: SettingGroup;
  readonly supabase?: SupabaseClient<Database> | null;
}>();

const { t } = useI18n();
const route = useRoute();
const injected = inject(SUPABASE_CLIENT_KEY, null);
const client = computed(() => props.supabase ?? injected);

const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

const activeLocale = ref<Locale>("en");
const loading = ref(true);
const saving = ref(false);
const loadError = ref<string | null>(null);
const saveError = ref<string | null>(null);
const statusMessage = ref("");
const rows = ref<readonly OrganizationSettingsRow[]>([]);
const errors = reactive<Record<string, SettingValidationCode>>({});

interface DraftEntry {
  value: SettingValue;
  visible: boolean;
}

/** Local draft; one entry per definition of this group. */
const draft = reactive<Record<string, DraftEntry>>({});

const definitions = computed(() =>
  SETTING_DEFINITIONS.filter(definition => definition.group === props.group)
);

/**
 * Scalars exclude social rows: those have their own labelled section (and the
 * same key must never render two controls, which would double-bind the draft).
 */
const scalarDefinitions = computed(() =>
  definitions.value.filter(
    definition =>
      !definition.localized && definition.socialPlatform === undefined
  )
);

const localizedDefinitions = computed(() =>
  definitions.value.filter(definition => definition.localized)
);

const socialDefinitions = computed(() =>
  definitions.value.filter(
    definition => definition.socialPlatform !== undefined
  )
);

const localeTabs: readonly AdminTab[] = SUPPORTED_LOCALES.map(locale => ({
  id: locale,
  label: LOCALE_LABELS[locale],
  testId: `settings-locale-${locale}`
}));

const ERROR_KEYS: Record<SettingValidationCode, string> = {
  email: "admin.settings.errors.email",
  url: "admin.settings.errors.url",
  nip: "admin.settings.errors.nip",
  regon: "admin.settings.errors.regon"
};

function onLocaleChange(locale: string): void {
  if (isLocale(locale)) activeLocale.value = locale;
}

function localizedDefault(definition: SettingDefinition): SettingValue {
  const value: SettingValue = {};
  for (const locale of SUPPORTED_LOCALES) {
    value[locale] = definition.defaultValue[locale] ?? "";
  }
  return value;
}

function resetDraft(): void {
  for (const key of Object.keys(draft)) delete draft[key];
  for (const definition of definitions.value) {
    draft[definition.key] = {
      value: definition.localized
        ? localizedDefault(definition)
        : { en: definition.defaultValue.en ?? "" },
      visible: true
    };
  }
}

/** Applies stored rows over the defaults; hidden rows keep their value. */
function mergeRows(nextRows: readonly OrganizationSettingsRow[]): void {
  rows.value = nextRows;
  for (const definition of definitions.value) {
    const entry = draft[definition.key];
    if (entry === undefined) continue;
    const row = nextRows.find(candidate => candidate.key === definition.key);
    if (row === undefined) continue;

    entry.visible = row.visible;
    if (definition.localized) {
      for (const locale of SUPPORTED_LOCALES) {
        entry.value[locale] = row.value[locale] ?? "";
      }
    } else {
      entry.value.en = row.value.en ?? "";
    }
  }
}

/**
 * Indexed draft access under `noUncheckedIndexedAccess`. Template v-model
 * cannot carry the non-null assertion, so the component exposes typed
 * accessors; a missing entry is a programming error, not user input.
 */
function entryFor(key: string): DraftEntry {
  const entry = draft[key];
  if (entry === undefined) {
    throw new Error(`settings draft has no entry for ${key}`);
  }
  return entry;
}

function draftValue(key: string, locale: Locale = "en"): string {
  return entryFor(key).value[locale] ?? "";
}

function setDraftValue(
  key: string,
  value: string | number | FileList | null | undefined,
  locale: Locale = "en"
): void {
  entryFor(key).value[locale] =
    typeof value === "string" ? value : value == null ? "" : String(value);
  clearError(key);
}

function draftVisible(key: string): boolean {
  return entryFor(key).visible;
}

function setVisible(key: string, value: unknown): void {
  entryFor(key).visible = value === true;
}

function auditFor(key: string): string {
  const row = rows.value.find(candidate => candidate.key === key);
  if (row?.updated_at == null) return "";

  const when = formatDate(new Date(row.updated_at), currentLocale.value, {
    dateStyle: "medium",
    timeStyle: "short"
  });
  const who = row.updated_by_email ?? t("admin.settings.auditUnknown");

  return t("admin.settings.audit", { who, when });
}

function clearError(key: string): void {
  delete errors[key];
  if (saveError.value !== null) saveError.value = null;
  if (statusMessage.value !== "") statusMessage.value = "";
}

function errorMessage(key: string): string {
  const code = errors[key];
  return code === undefined ? "" : t(ERROR_KEYS[code]);
}

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  saveError.value = null;
  statusMessage.value = "";

  const result = await fetchAdminOrganizationSettings(client.value);
  if (!result.ok) {
    loadError.value = t("admin.settings.loadFailed");
    loading.value = false;
    return;
  }

  resetDraft();
  mergeRows(result.rows);
  loading.value = false;
}

/** Row-backed entry for the group that is not currently mounted. */
function storedOrDefault(definition: SettingDefinition): DraftEntry {
  const row = rows.value.find(candidate => candidate.key === definition.key);
  if (row === undefined) {
    return {
      value: definition.localized
        ? localizedDefault(definition)
        : { en: definition.defaultValue.en ?? "" },
      visible: true
    };
  }

  if (definition.localized) {
    const value: SettingValue = {};
    for (const locale of SUPPORTED_LOCALES) {
      value[locale] = row.value[locale] ?? "";
    }
    return { value, visible: row.visible };
  }

  return { value: { en: row.value.en ?? "" }, visible: row.visible };
}

function validateDraft(): boolean {
  for (const key of Object.keys(errors)) delete errors[key];

  for (const definition of definitions.value) {
    const entry = draft[definition.key];
    if (entry === undefined) continue;
    const code = validateSettingValue(definition, entry.value);
    if (code !== null) errors[definition.key] = code;
  }

  return Object.keys(errors).length === 0;
}

async function submit(): Promise<void> {
  if (saving.value) return;
  saveError.value = null;
  statusMessage.value = "";

  if (!validateDraft()) {
    saveError.value = t("admin.settings.errors.invalid");
    return;
  }

  /**
   * The complete vocabulary is saved, so an invalid stored value in the other
   * tab would make the RPC reject the whole batch. Surface that explicitly
   * instead of showing "fix highlighted fields" for fields this tab does not
   * render (seed identifiers are deliberately invalid placeholders).
   */
  const invalidOtherTab = SETTING_DEFINITIONS.find(definition => {
    if (definition.group === props.group) return false;
    return (
      validateSettingValue(definition, storedOrDefault(definition).value) !==
      null
    );
  });

  if (invalidOtherTab !== undefined) {
    saveError.value = t("admin.settings.errors.invalidOtherTab", {
      tab: t(`admin.settings.tabs.${invalidOtherTab.group}`)
    });
    return;
  }

  /**
   * Save the complete vocabulary, not only the visible tab.
   *
   * First-save correctness: once ANY row exists the public resolver treats an
   * absent key as hidden. Saving only General would therefore hide every
   * Contact fact (and vice versa). The other group is taken from the freshly
   * read rows, or from static parity defaults when it has never been saved.
   * The sentinel row is added server-side, so the table becomes authoritative
   * on the first save while rendering stays identical.
   */
  const changes: OrganizationSettingChange[] = SETTING_DEFINITIONS.map(
    definition => {
      const entry = draft[definition.key] ?? storedOrDefault(definition);
      return {
        key: definition.key,
        value: definition.localized
          ? { ...entry.value }
          : { en: entry.value.en ?? "" },
        visible: entry.visible
      };
    }
  );

  saving.value = true;
  const result = await saveOrganizationSettings(client.value, changes);
  saving.value = false;

  if (!result.ok) {
    saveError.value =
      result.code === "empty"
        ? t("admin.settings.errors.invalid")
        : t("admin.settings.saveFailed");
    return;
  }

  // Re-read so the audit surface shows the database truth, not the payload.
  const refreshed = await fetchAdminOrganizationSettings(client.value);
  if (refreshed.ok) {
    mergeRows(refreshed.rows);
    // Same-session public rendering: only visible rows are publishable.
    applyOrganizationSettings(
      refreshed.rows
        .filter(row => row.visible)
        .map(row => ({
          key: row.key,
          value: row.value,
          visible: true,
          updated_by: row.updated_by,
          updated_by_email: row.updated_by_email,
          updated_at: row.updated_at
        }))
    );
  }

  statusMessage.value = t("admin.settings.saved");
}

onMounted(load);
</script>

<style scoped>
.org-settings-form {
  max-width: 60rem;
}

.org-settings-form__state {
  color: var(--color-text-muted);
}

.org-settings-form__section-title {
  margin: 1.5rem 0 0.75rem;
  font-size: 1.125rem;
  font-weight: 700;
}

.org-settings-form__section-title:first-child {
  margin-top: 0;
}

.org-settings-form__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  gap: 1rem 1.5rem;
}

.org-settings-form__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.org-settings-form__audit {
  margin: 0;
  font-size: var(--font-size-small);
  color: var(--color-text-muted);
}

.org-settings-form__locale-panel {
  display: grid;
  gap: 1rem;
  margin-top: 0.5rem;
}

.org-settings-form__hint {
  margin: 0 0 0.75rem;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.org-settings-form__banner-text {
  margin: 0 0 0.5rem;
}

.org-settings-form__status {
  margin-top: 1rem;
  font-weight: 600;
}

.org-settings-form__actions {
  margin-top: 1.5rem;
}
</style>
