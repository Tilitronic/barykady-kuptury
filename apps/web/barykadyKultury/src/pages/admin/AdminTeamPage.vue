<template>
  <!--
    T-028 — team CRUD (`/:locale/admin/team`).

    Contract notes:
      * create/edit/reorder/delete plus optional portrait upload/removal;
      * ordering uses explicit Up/Down buttons (never drag-only), so it is
        keyboard operable and persists a complete 1..n order through one RPC;
      * per-locale role/bio edits are immutable updates — editing one tab never
        overwrites another locale;
      * no optimistic UI: every mutation is awaited, then the list is re-read
        (the T-027 pattern).
  -->
  <div class="admin-team">
    <p class="admin-team__back">
      <RouterLink
        :to="`/${currentLocale}/admin`"
        class="admin-team__back-link focus-ring"
      >
        {{ t("admin.team.actions.back") }}
      </RouterLink>
    </p>

    <div class="admin-team__header">
      <h1 class="admin-team__heading">{{ t("admin.team.heading") }}</h1>
      <UiBtn
        :label="t('admin.team.actions.newMember')"
        data-testid="team-new"
        @click="startNew"
      />
    </div>

    <p class="admin-team__intro">{{ t("admin.team.intro") }}</p>

    <p v-if="loading" class="admin-team__state" role="status">
      {{ t("content.loading") }}
    </p>

    <UiBanner
      v-else-if="loadError !== null"
      class="admin-team__banner"
      rounded
      role="status"
      aria-live="polite"
      data-testid="team-error"
    >
      {{ loadErrorMessage }}
    </UiBanner>

    <template v-else>
      <p
        v-if="members.length === 0"
        class="admin-team__state"
        data-testid="team-empty"
      >
        {{ t("admin.team.empty") }}
      </p>

      <ul v-else class="admin-team__list" data-testid="team-list">
        <li
          v-for="(member, index) in members"
          :key="member.id"
          class="admin-team__item"
          :data-testid="`team-member-${member.id}`"
        >
          <div class="admin-team__identity">
            <p class="admin-team__name">{{ member.name }}</p>
            <p class="admin-team__meta">
              {{ t(`admin.team.statuses.${member.status}`) }} ·
              <span
                v-for="(entry, entryIndex) in teamMemberCompleteness(member)"
                :key="entry.locale"
              >
                <template v-if="entryIndex > 0"> · </template>
                {{ entry.locale.toUpperCase() }}:
                <TranslationStatus :entry="entry" :labels="TEAM_LABELS" />
              </span>
            </p>
          </div>

          <div class="admin-team__row-actions">
            <UiBtn
              variant="flat"
              :label="t('admin.team.actions.edit')"
              :data-testid="`team-edit-${member.id}`"
              @click="startEdit(member)"
            />
            <!-- Explicit, keyboard-operable ordering: no drag-only access. -->
            <UiBtn
              variant="flat"
              :label="t('admin.team.actions.moveUp')"
              :disable="index === 0 || pending !== null"
              :data-testid="`team-up-${member.id}`"
              @click="move(member, 'up')"
            />
            <UiBtn
              variant="flat"
              :label="t('admin.team.actions.moveDown')"
              :disable="index === members.length - 1 || pending !== null"
              :data-testid="`team-down-${member.id}`"
              @click="move(member, 'down')"
            />
            <UiBtn
              variant="outline"
              :label="
                member.status === 'published'
                  ? t('admin.team.actions.unpublish')
                  : t('admin.team.actions.publish')
              "
              :disable="pending !== null"
              :data-testid="`team-toggle-${member.id}`"
              @click="togglePublished(member)"
            />
          </div>
        </li>
      </ul>

      <form
        v-if="editing !== null"
        novalidate
        class="admin-team__form"
        @submit.prevent="save"
      >
        <h2 class="admin-team__section-title">
          {{
            editing.id === null
              ? t("admin.team.actions.newMember")
              : t("admin.team.actions.editMember")
          }}
        </h2>

        <UiInput
          v-model="editingName"
          :label="t('admin.team.fields.name')"
          :hint="t('admin.team.fields.nameHint')"
          :error="errors.name !== null"
          :error-message="t('admin.team.errors.nameRequired')"
          data-testid="team-name"
        />

        <div class="admin-team__portrait">
          <label class="admin-team__label" for="team-portrait">
            {{ t("admin.team.fields.portrait") }}
          </label>
          <input
            id="team-portrait"
            class="admin-team__file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            data-testid="team-portrait"
            @change="onPortraitChange"
          />
          <p class="admin-team__hint">{{
            t("admin.team.fields.portraitHint")
          }}</p>
          <p v-if="portraitName !== ''" class="admin-team__hint">
            {{
              t("admin.team.fields.portraitSelected", { name: portraitName })
            }}
          </p>
          <p v-else-if="editing.portraitPath !== null" class="admin-team__hint">
            {{ t("admin.team.fields.portraitCurrent") }}
          </p>
          <UiBtn
            v-if="editing.portraitPath !== null"
            variant="flat"
            :label="t('admin.team.actions.removePortrait')"
            data-testid="team-portrait-remove"
            @click="removePortrait"
          />
        </div>

        <div class="admin-team__tabs">
          <h3 class="admin-team__section-title">
            {{ t("admin.team.tabs.label") }}
          </h3>

          <AdminLocaleTabs
            :locales="SUPPORTED_LOCALES"
            :active="activeLocale"
            :label="t('admin.team.tabs.label')"
            :tab-labels="tabLabels"
            :entries="completenessByLocale"
            :labels="TEAM_LABELS"
            id-prefix="team-member"
            test-id-prefix="team"
            @update:active="activeLocale = $event"
          />

          <div
            :id="`team-member-panel-${activeLocale}`"
            role="tabpanel"
            :aria-labelledby="`team-member-tab-${activeLocale}`"
            tabindex="0"
            class="admin-team__panel"
          >
            <UiInput
              v-model="activeRole"
              :label="t('admin.team.translation.role')"
              data-testid="team-role"
            />
            <UiInput
              v-model="activeBio"
              type="textarea"
              autogrow
              :label="t('admin.team.translation.bio')"
              data-testid="team-bio"
            />
          </div>
        </div>

        <div class="admin-team__actions">
          <UiBtn
            type="submit"
            :label="
              pending === 'save'
                ? t('admin.team.actions.saving')
                : t('admin.team.actions.save')
            "
            :loading="pending === 'save'"
            :disable="pending !== null"
            data-testid="team-save"
          />
          <UiBtn
            variant="flat"
            :label="t('admin.team.actions.cancel')"
            :disable="pending !== null"
            data-testid="team-cancel"
            @click="cancelEdit"
          />
          <UiBtn
            v-if="editing.id !== null"
            variant="flat"
            :label="t('admin.team.actions.delete')"
            :disable="pending !== null"
            data-testid="team-delete"
            @click="openDeleteDialog"
          />
        </div>

        <p
          class="admin-team__status-message"
          :class="{
            'admin-team__status-message--error': statusKind === 'error',
            'admin-team__status-message--success': statusKind === 'success'
          }"
          role="status"
          aria-live="polite"
          data-testid="team-status-message"
        >
          {{ statusMessage }}
        </p>
      </form>
    </template>

    <UiConfirmDialog
      v-model="deleteOpen"
      :title="t('admin.team.deleteDialog.title')"
      :message="t('admin.team.deleteDialog.message')"
      :confirm-label="t('admin.team.deleteDialog.confirm')"
      :cancel-label="t('admin.team.actions.cancel')"
      danger
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import type { SupabaseClient } from "@supabase/supabase-js";
import { computed, inject, onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import AdminLocaleTabs from "@/components/admin/AdminLocaleTabs.vue";
import TranslationStatus from "@/components/admin/TranslationStatus.vue";
import { UiBanner, UiBtn, UiConfirmDialog, UiInput } from "@/components/ui";
import {
  deleteTeamMember,
  fetchAdminTeamMembers,
  moveTeamMember,
  publishTeamMember,
  removeTeamPortrait,
  saveTeamMember,
  unpublishTeamMember,
  uploadTeamPortrait,
  type AdminTeamMember
} from "@/features/admin/team/api";
import {
  emptyTeamMemberForm,
  hasTeamMemberFormErrors,
  teamTranslationCompleteness,
  updateTeamTranslation,
  validateTeamMemberForm,
  type TeamMemberFormErrors,
  type TeamMemberFormValues,
  type TeamMemberTranslationDraft
} from "@/features/admin/team/teamForm";
import type { TeamMoveDirection } from "@/features/admin/team/teamOrder";
import type {
  CompletenessLabelKeys,
  LocaleCompleteness
} from "@/features/admin/shared/completeness";
import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import {
  DEFAULT_LOCALE,
  isLocale,
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

const TEAM_LABELS: CompletenessLabelKeys = {
  complete: "admin.team.completeness.complete",
  notStarted: "admin.team.completeness.notStarted",
  missing: "admin.team.completeness.missing",
  field: field => `admin.team.translation.${field}`
};

const members = ref<readonly AdminTeamMember[]>([]);
const loading = ref(true);
const loadError = ref<"unavailable" | "failed" | null>(null);
const editing = ref<TeamMemberFormValues | null>(null);
const errors = ref<TeamMemberFormErrors>(
  validateTeamMemberForm(emptyTeamMemberForm())
);
const activeLocale = ref<Locale>(currentLocale.value);
const portraitFile = ref<File | null>(null);
const portraitName = ref("");
const portraitToRemove = ref<string | null>(null);
const deleteOpen = ref(false);
const memberToDelete = ref<AdminTeamMember | null>(null);
const pending = ref<"save" | "move" | "toggle" | "delete" | null>(null);
const statusMessage = ref("");
const statusKind = ref<"success" | "error" | null>(null);

const loadErrorMessage = computed(() =>
  loadError.value === "unavailable"
    ? t("admin.team.errors.unavailable")
    : t("admin.team.errors.loadFailed")
);

const tabLabels = computed(
  () =>
    Object.fromEntries(
      SUPPORTED_LOCALES.map(locale => [locale, t(`admin.team.tabs.${locale}`)])
    ) as Record<Locale, string>
);

const activeTranslation = computed(
  () => editing.value?.translations[activeLocale.value] ?? null
);

const completenessByLocale = computed(() => {
  const source = editing.value;
  const entries = source
    ? teamTranslationCompleteness(source)
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

const editingName = computed({
  get: () => editing.value?.name ?? "",
  set: value => {
    if (editing.value) editing.value = { ...editing.value, name: value };
  }
});

const activeRole = computed({
  get: () => activeTranslation.value?.role ?? "",
  set: value => applyTranslation({ role: value })
});

const activeBio = computed({
  get: () => activeTranslation.value?.bio ?? "",
  set: value => applyTranslation({ bio: value })
});

function setStatusMessage(message: string, kind: "success" | "error"): void {
  statusMessage.value = message;
  statusKind.value = kind;
}

function applyTranslation(patch: Partial<TeamMemberTranslationDraft>): void {
  if (!editing.value) return;
  editing.value = updateTeamTranslation(
    editing.value,
    activeLocale.value,
    patch
  );
}

function toFormValues(member: AdminTeamMember): TeamMemberFormValues {
  return {
    id: member.id,
    name: member.name,
    status: member.status,
    portraitPath: member.portraitPath,
    sortOrder: member.sortOrder,
    translations: Object.fromEntries(
      SUPPORTED_LOCALES.map(locale => [
        locale,
        { ...member.translations[locale] }
      ])
    ) as Record<Locale, TeamMemberTranslationDraft>
  };
}

function teamMemberCompleteness(member: AdminTeamMember) {
  return teamTranslationCompleteness(member);
}

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;

  if (client.value === null) {
    loadError.value = "unavailable";
    loading.value = false;
    return;
  }

  const result = await fetchAdminTeamMembers(client.value);
  if (!result.ok) {
    loadError.value = "failed";
    loading.value = false;
    return;
  }

  members.value = result.members;
  loading.value = false;
}

function startNew(): void {
  editing.value = emptyTeamMemberForm();
  activeLocale.value = currentLocale.value;
  errors.value = validateTeamMemberForm(editing.value);
  portraitFile.value = null;
  portraitName.value = "";
  portraitToRemove.value = null;
  setStatusMessage("", "success");
}

function startEdit(member: AdminTeamMember): void {
  editing.value = toFormValues(member);
  activeLocale.value = currentLocale.value;
  errors.value = validateTeamMemberForm(editing.value);
  portraitFile.value = null;
  portraitName.value = "";
  portraitToRemove.value = null;
  setStatusMessage("", "success");
}

function cancelEdit(): void {
  editing.value = null;
  portraitFile.value = null;
  portraitName.value = "";
  portraitToRemove.value = null;
}

function onPortraitChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  portraitFile.value = file;
  portraitName.value = file?.name ?? "";
}

function removePortrait(): void {
  if (!editing.value) return;
  portraitToRemove.value = editing.value.portraitPath;
  editing.value = { ...editing.value, portraitPath: null };
  portraitFile.value = null;
  portraitName.value = "";
}

async function save(): Promise<void> {
  if (!editing.value || client.value === null) return;

  errors.value = validateTeamMemberForm(editing.value);
  if (hasTeamMemberFormErrors(errors.value)) {
    setStatusMessage(t("admin.team.errors.nameRequired"), "error");
    document.querySelector<HTMLElement>('[data-testid="team-name"]')?.focus();
    return;
  }

  pending.value = "save";
  try {
    if (portraitFile.value !== null) {
      const upload = await uploadTeamPortrait(client.value, portraitFile.value);
      if (!upload.ok) {
        setStatusMessage(
          upload.message === "not-an-image"
            ? t("admin.team.errors.notAnImage")
            : t("admin.team.errors.uploadFailed"),
          "error"
        );
        return;
      }
      editing.value = { ...editing.value, portraitPath: upload.path };
    }

    // Clearing the database reference is the guarantee; deleting the object is
    // best-effort so a team editor without media:write can still remove it.
    if (portraitToRemove.value !== null) {
      await removeTeamPortrait(client.value, portraitToRemove.value);
      portraitToRemove.value = null;
    }

    const saved = await saveTeamMember(client.value, editing.value, {
      existingPublishedAt:
        members.value.find(member => member.id === editing.value?.id)
          ?.publishedAt ?? null
    });

    if (!saved.ok) {
      setStatusMessage(t("admin.team.errors.saveFailed"), "error");
      return;
    }

    portraitFile.value = null;
    portraitName.value = "";
    await load();

    const reloaded = members.value.find(member => member.id === saved.id);
    editing.value = reloaded ? toFormValues(reloaded) : null;
    setStatusMessage(t("admin.team.messages.saved"), "success");
  } finally {
    pending.value = null;
  }
}

async function move(
  member: AdminTeamMember,
  direction: TeamMoveDirection
): Promise<void> {
  if (client.value === null) return;

  pending.value = "move";
  try {
    const ids = members.value.map(entry => entry.id);
    const result = await moveTeamMember(
      client.value,
      ids,
      member.id,
      direction
    );
    if (!result.ok) {
      setStatusMessage(t("admin.team.errors.saveFailed"), "error");
      return;
    }
    await load();
    setStatusMessage(t("admin.team.messages.reordered"), "success");
  } finally {
    pending.value = null;
  }
}

async function togglePublished(member: AdminTeamMember): Promise<void> {
  if (client.value === null) return;

  pending.value = "toggle";
  try {
    const result =
      member.status === "published"
        ? await unpublishTeamMember(client.value, member.id)
        : await publishTeamMember(client.value, member.id);

    if (!result.ok) {
      setStatusMessage(t("admin.team.errors.saveFailed"), "error");
      return;
    }

    await load();
    setStatusMessage(
      member.status === "published"
        ? t("admin.team.messages.unpublished")
        : t("admin.team.messages.published"),
      "success"
    );
  } finally {
    pending.value = null;
  }
}

function openDeleteDialog(): void {
  if (!editing.value?.id) return;
  memberToDelete.value =
    members.value.find(member => member.id === editing.value?.id) ?? null;
  document.querySelector<HTMLElement>('[data-testid="team-delete"]')?.focus();
  deleteOpen.value = true;
}

async function confirmDelete(): Promise<void> {
  if (client.value === null || memberToDelete.value === null) return;

  pending.value = "delete";
  try {
    const result = await deleteTeamMember(
      client.value,
      memberToDelete.value.id,
      memberToDelete.value.portraitPath
    );
    if (!result.ok) {
      setStatusMessage(t("admin.team.errors.deleteFailed"), "error");
      return;
    }

    cancelEdit();
    await load();
    setStatusMessage(t("admin.team.messages.deleted"), "success");
  } finally {
    memberToDelete.value = null;
    pending.value = null;
  }
}

onMounted(load);
</script>

<style scoped>
.admin-team__back {
  margin: 0 0 1rem;
  font-size: var(--font-size-small);
}

.admin-team__back-link {
  color: var(--color-link);
  text-decoration: none;
}

.admin-team__back-link:hover {
  text-decoration: underline;
}

.admin-team__header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.admin-team__heading {
  margin: 0;
  font-size: var(--font-size-h2);
  font-weight: 700;
}

.admin-team__intro {
  max-width: 65ch;
  margin: 0 0 1.5rem;
  color: var(--color-text-muted);
}

.admin-team__state {
  color: var(--color-text-muted);
}

.admin-team__banner {
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-danger);
  border-radius: 0.375rem;
  background: var(--color-surface-raised);
  color: var(--color-danger);
  font-weight: 600;
}

.admin-team__list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 72rem;
  margin: 0 0 2rem;
  padding: 0;
  list-style: none;
}

.admin-team__item {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background-color: var(--color-surface);
}

.admin-team__name {
  margin: 0;
  font-weight: 700;
}

.admin-team__meta {
  margin: 0.125rem 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.admin-team__row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.admin-team__form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 48rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
}

.admin-team__section-title {
  margin: 0 0 0.75rem;
  font-size: 1.125rem;
  font-weight: 700;
}

.admin-team__hint {
  margin: 0.25rem 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.admin-team__label {
  display: block;
  margin-bottom: 0.375rem;
  font-weight: 600;
}

.admin-team__file {
  font: inherit;
}

.admin-team__panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 1.25rem;
  outline: none;
}

.admin-team__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.admin-team__status-message {
  margin: 0;
  min-height: 1.25em;
  font-weight: 600;
}

.admin-team__status-message--error {
  color: var(--color-danger);
}

.admin-team__status-message--success {
  color: var(--color-success);
}
</style>
