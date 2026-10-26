<template>
  <!--
    T-028 — site page editor (`/:locale/admin/pages`).

    Scope: pick an EXISTING organization page, edit title/body per locale,
    publish/unpublish and preview. There is deliberately no "New page" action
    and no slug field: T-038/D-24 made `page_key` the stable identity, and the
    product is a picker, not a page builder.

    Writes go through `features/admin/content` only (docs/architecture.md §3).
    No optimistic state: every mutation is awaited, then the page is re-read.
  -->
  <div class="admin-site-pages">
    <p class="admin-site-pages__back">
      <RouterLink
        :to="`/${currentLocale}/admin`"
        class="admin-site-pages__back-link focus-ring"
      >
        {{ t("admin.content.actions.back") }}
      </RouterLink>
    </p>

    <h1 class="admin-site-pages__heading">{{ t("admin.content.heading") }}</h1>
    <p class="admin-site-pages__intro">{{ t("admin.content.intro") }}</p>

    <p v-if="loading" class="admin-site-pages__state" role="status">
      {{ t("content.loading") }}
    </p>

    <BkBanner
      v-else-if="loadError !== null"
      class="admin-site-pages__banner"
      rounded
      role="status"
      aria-live="polite"
      data-testid="site-page-error"
    >
      {{ loadErrorMessage }}
    </BkBanner>

    <p
      v-else-if="pages.length === 0"
      class="admin-site-pages__state"
      data-testid="site-page-empty"
    >
      {{ t("admin.content.empty") }}
    </p>

    <template v-else>
      <div class="admin-site-pages__picker">
        <BkSelect
          v-model="selectedKey"
          :options="pageOptions"
          emit-value
          map-options
          :label="t('admin.content.fields.page')"
          :hint="t('admin.content.fields.pageHint')"
          data-testid="site-page-picker"
          @update:model-value="loadPage"
        />
      </div>

      <form
        v-if="page !== null"
        novalidate
        class="admin-site-pages__form"
        @submit.prevent="submit('save')"
      >
        <div class="admin-site-pages__meta">
          <p class="admin-site-pages__status">
            {{ t("admin.content.fields.status") }}:
            <strong>{{ t(`admin.content.statuses.${page.status}`) }}</strong>
          </p>
          <p class="admin-site-pages__hint">
            {{ t("admin.content.fields.statusHint") }}
          </p>
        </div>

        <div class="admin-site-pages__tabs">
          <h2 class="admin-site-pages__section-title">
            {{ t("admin.content.tabs.label") }}
          </h2>

          <AdminLocaleTabs
            :locales="SUPPORTED_LOCALES"
            :active="activeLocale"
            :label="t('admin.content.tabs.label')"
            :tab-labels="tabLabels"
            :entries="completenessByLocale"
            :labels="CONTENT_LABELS"
            id-prefix="site-page"
            test-id-prefix="site-page"
            @update:active="activeLocale = $event"
          />

          <div
            :id="`site-page-panel-${activeLocale}`"
            role="tabpanel"
            :aria-labelledby="`site-page-tab-${activeLocale}`"
            tabindex="0"
            class="admin-site-pages__panel"
          >
            <BkInput
              v-model="activeTitle"
              :label="t('admin.content.translation.title')"
              :error="translationError('title')"
              :error-message="t('admin.content.errors.titleRequired')"
              data-testid="site-page-title"
            />

            <BkInput
              v-model="activeBody"
              type="textarea"
              autogrow
              :label="t('admin.content.translation.body')"
              :hint="t('admin.content.translation.bodyHint')"
              :error="translationError('body')"
              :error-message="t('admin.content.errors.bodyRequired')"
              data-testid="site-page-body"
            />
          </div>
        </div>

        <div class="admin-site-pages__actions">
          <BkButton
            type="submit"
            :label="
              pending === 'save'
                ? t('admin.content.actions.saving')
                : t('admin.content.actions.save')
            "
            :loading="pending === 'save'"
            :disable="pending !== null"
            data-testid="site-page-save"
          />

          <BkButton
            v-if="page.status !== 'published'"
            variant="outline"
            :label="
              pending === 'publish'
                ? t('admin.content.actions.publishing')
                : t('admin.content.actions.publish')
            "
            :disable="pending !== null"
            data-testid="site-page-publish"
            @click="submit('publish')"
          />
          <BkButton
            v-else
            variant="outline"
            :label="
              pending === 'unpublish'
                ? t('admin.content.actions.unpublishing')
                : t('admin.content.actions.unpublish')
            "
            :disable="pending !== null"
            data-testid="site-page-unpublish"
            @click="unpublish"
          />

          <BkButton
            variant="flat"
            :label="t('admin.content.actions.preview')"
            :disable="pending !== null"
            data-testid="site-page-preview"
            @click="openPreview"
          />
        </div>

        <p
          class="admin-site-pages__status-message"
          :class="{
            'admin-site-pages__status-message--error': statusKind === 'error',
            'admin-site-pages__status-message--success':
              statusKind === 'success'
          }"
          role="status"
          aria-live="polite"
          data-testid="site-page-status-message"
        >
          {{ statusMessage }}
        </p>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { SupabaseClient } from "@supabase/supabase-js";
import { computed, inject, nextTick, onMounted, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import AdminLocaleTabs from "@/components/admin/AdminLocaleTabs.vue";
import { BkBanner, BkButton, BkInput, BkSelect } from "@/components/bk";
import {
  fetchAdminSitePage,
  fetchAdminSitePages,
  publishSitePage,
  saveSitePage,
  unpublishSitePage,
  type AdminSitePage
} from "@/features/admin/content/api";
import {
  emptySitePageForm,
  hasSitePageFormErrors,
  sitePageCompleteness,
  updateSitePageTranslation,
  validateSitePageForm,
  type SitePageFormValues,
  type SitePageTranslationDraft
} from "@/features/admin/content/sitePageForm";
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
const router = useRouter();
const injected = inject(SUPABASE_CLIENT_KEY, null);
const client = computed(() => props.supabase ?? injected);

const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

const loading = ref(true);
const loadError = ref<"unavailable" | "failed" | null>(null);
const pages = ref<readonly AdminSitePage[]>([]);
const selectedKey = ref("about");
const page = ref<AdminSitePage | null>(null);
const values = ref<SitePageFormValues>(emptySitePageForm());
const activeLocale = ref<Locale>(currentLocale.value);
const pending = ref<"save" | "publish" | "unpublish" | null>(null);
const statusMessage = ref("");
const statusKind = ref<"success" | "error" | null>(null);

const CONTENT_LABELS: CompletenessLabelKeys = {
  complete: "admin.content.completeness.complete",
  notStarted: "admin.content.completeness.notStarted",
  missing: "admin.content.completeness.missing",
  field: field => `admin.content.translation.${field}`
};

const pageOptions = computed(() =>
  pages.value.map(entry => ({
    label: `${entry.pageKey} — ${
      entry.translations[DEFAULT_LOCALE].title || entry.pageKey
    }`,
    value: entry.pageKey
  }))
);

const tabLabels = computed(
  () =>
    Object.fromEntries(
      SUPPORTED_LOCALES.map(locale => [
        locale,
        t(`admin.content.tabs.${locale}`)
      ])
    ) as Record<Locale, string>
);

const completeness = computed(() => sitePageCompleteness(values.value));

const completenessByLocale = computed(
  () =>
    Object.fromEntries(
      completeness.value.map(entry => [entry.locale, entry])
    ) as Record<Locale, LocaleCompleteness>
);

const activeTranslation = computed(
  () => values.value.translations[activeLocale.value]
);

const loadErrorMessage = computed(() =>
  loadError.value === "unavailable"
    ? t("admin.content.errors.unavailable")
    : t("admin.content.errors.loadFailed")
);

function toFormValues(source: AdminSitePage): SitePageFormValues {
  return {
    id: source.id,
    pageKey: source.pageKey,
    status: source.status,
    translations: Object.fromEntries(
      SUPPORTED_LOCALES.map(locale => [
        locale,
        { ...source.translations[locale] }
      ])
    ) as Record<Locale, SitePageTranslationDraft>
  };
}

function applyTranslation(patch: Partial<SitePageTranslationDraft>): void {
  values.value = updateSitePageTranslation(
    values.value,
    activeLocale.value,
    patch
  );
}

// `v-model` on the inputs must go through the immutable updater so editing one
// tab cannot mutate another locale's draft object.
const activeTitle = computed({
  get: () => activeTranslation.value.title,
  set: value => applyTranslation({ title: value })
});
const activeBody = computed({
  get: () => activeTranslation.value.body,
  set: value => applyTranslation({ body: value })
});

function translationError(field: "title" | "body"): boolean {
  return errors.value.translations[activeLocale.value]?.[field] === "required";
}

const errors = ref(
  validateSitePageForm(emptySitePageForm(), { mode: "draft" })
);

function setStatusMessage(message: string, kind: "success" | "error"): void {
  statusMessage.value = message;
  statusKind.value = kind;
}

function focusField(testId: string): void {
  document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.focus();
}

function focusFirstError(): void {
  const locale = SUPPORTED_LOCALES.find(
    candidate => errors.value.translations[candidate] !== undefined
  );
  const targetLocale = locale ?? activeLocale.value;
  const testId =
    errors.value.translations[targetLocale]?.title === "required"
      ? "site-page-title"
      : "site-page-body";

  if (locale) {
    activeLocale.value = locale;
  }
  // Wait for the tab panel to render the offending locale before moving focus.
  void nextTick(() => focusField(testId));
}

async function loadPage(pageKey: string): Promise<void> {
  if (client.value === null) return;

  const result = await fetchAdminSitePage(client.value, pageKey);
  if (!result.ok) {
    page.value = null;
    setStatusMessage(t("admin.content.errors.loadFailed"), "error");
    return;
  }

  page.value = result.page;
  values.value = toFormValues(result.page);
  errors.value = validateSitePageForm(values.value, { mode: "draft" });
}

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;

  if (client.value === null) {
    loadError.value = "unavailable";
    loading.value = false;
    return;
  }

  const result = await fetchAdminSitePages(client.value);
  if (!result.ok) {
    loadError.value = "failed";
    loading.value = false;
    return;
  }

  pages.value = result.pages;
  if (!result.pages.some(entry => entry.pageKey === selectedKey.value)) {
    selectedKey.value = result.pages[0]?.pageKey ?? "about";
  }

  const selected = result.pages.find(
    entry => entry.pageKey === selectedKey.value
  );
  if (selected) {
    page.value = selected;
    values.value = toFormValues(selected);
  }

  loading.value = false;
}

async function submit(kind: "save" | "publish"): Promise<void> {
  setStatusMessage("", "success");
  statusKind.value = null;

  if (client.value === null || page.value === null) {
    setStatusMessage(t("admin.content.errors.unavailable"), "error");
    return;
  }

  const mode =
    kind === "publish" || values.value.status === "published"
      ? "publish"
      : "draft";

  errors.value = validateSitePageForm(values.value, { mode });
  if (hasSitePageFormErrors(errors.value)) {
    setStatusMessage(
      errors.value.publish === "fallback-incomplete"
        ? t("admin.content.errors.publishFallbackIncomplete")
        : t("admin.content.errors.saveFailed"),
      "error"
    );
    focusFirstError();
    return;
  }

  pending.value = kind;
  try {
    // Publishing is two awaited steps so a failure between them leaves a valid
    // draft, never a half-published row (the T-027 pattern).
    const saved = await saveSitePage(
      client.value,
      {
        ...values.value,
        status: kind === "publish" ? "draft" : values.value.status
      },
      { existingPublishedAt: page.value.publishedAt }
    );

    if (!saved.ok) {
      setStatusMessage(t("admin.content.errors.saveFailed"), "error");
      return;
    }

    if (kind === "publish") {
      const published = await publishSitePage(client.value, saved.id);
      if (!published.ok) {
        setStatusMessage(t("admin.content.errors.saveFailed"), "error");
        return;
      }
    }

    await load();
    setStatusMessage(
      kind === "publish"
        ? t("admin.content.messages.published")
        : t("admin.content.messages.saved"),
      "success"
    );
  } finally {
    pending.value = null;
  }
}

async function unpublish(): Promise<void> {
  if (client.value === null || page.value === null) return;

  pending.value = "unpublish";
  try {
    const result = await unpublishSitePage(client.value, page.value.id);
    if (!result.ok) {
      setStatusMessage(t("admin.content.errors.saveFailed"), "error");
      return;
    }
    await load();
    setStatusMessage(t("admin.content.messages.unpublished"), "success");
  } finally {
    pending.value = null;
  }
}

async function openPreview(): Promise<void> {
  if (page.value === null) return;
  await router.push(
    `/${currentLocale.value}/admin/pages/${page.value.pageKey}/preview`
  );
}

onMounted(load);
</script>

<style scoped>
.admin-site-pages__back {
  margin: 0 0 1rem;
  font-size: var(--font-size-small);
}

.admin-site-pages__back-link {
  color: var(--color-link);
  text-decoration: none;
}

.admin-site-pages__back-link:hover {
  text-decoration: underline;
}

.admin-site-pages__heading {
  margin: 0 0 0.5rem;
  font-size: var(--font-size-h2);
  font-weight: 700;
}

.admin-site-pages__intro {
  max-width: 65ch;
  margin: 0 0 1.5rem;
  color: var(--color-text-muted);
}

.admin-site-pages__state {
  color: var(--color-text-muted);
}

.admin-site-pages__banner {
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-danger);
  border-radius: 0.375rem;
  background: var(--color-surface-raised);
  color: var(--color-danger);
  font-weight: 600;
}

.admin-site-pages__picker {
  max-width: 32rem;
  margin-bottom: 1.5rem;
}

.admin-site-pages__form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.admin-site-pages__meta {
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background-color: var(--color-surface);
}

.admin-site-pages__status {
  margin: 0;
}

.admin-site-pages__hint {
  margin: 0.25rem 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.admin-site-pages__section-title {
  margin: 0 0 0.75rem;
  font-size: 1.125rem;
  font-weight: 700;
}

.admin-site-pages__panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 1.25rem;
  outline: none;
}

.admin-site-pages__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.admin-site-pages__status-message {
  margin: 0;
  min-height: 1.25em;
  font-weight: 600;
}

.admin-site-pages__status-message--error {
  color: var(--color-danger);
}

.admin-site-pages__status-message--success {
  color: var(--color-success);
}
</style>
