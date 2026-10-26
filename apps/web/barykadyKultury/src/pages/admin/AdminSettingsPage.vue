<template>
  <!--
    T-048 — the tabbed administration surface (`/:locale/admin/settings?tab=`).

    Host, don't rewrite: General/Contacts render the new settings form; every
    other tab mounts the existing T-027…T-031 page unchanged. Tab rights are
    resolved from the session's capabilities (features/settings/settingsTabs),
    and a direct URL to a denied tab renders an explicit denial panel. This is
    UX gating only — RLS/RPC enforce (docs/architecture.md §6.1).
  -->
  <div class="admin-settings">
    <p v-if="visibleTabs.length > 0" class="admin-settings__intro">
      {{ t("admin.settings.intro") }}
    </p>

    <AdminTabs
      v-if="visibleTabs.length > 0"
      id-prefix="settings"
      :tabs="tabItems"
      :active="activeTabId"
      :label="t('admin.settings.tabsLabel')"
      @update:active="onTabChange"
    />

    <!-- Denied direct URL: explain the role boundary, offer a granted tab. -->
    <section
      v-if="resolution.kind === 'denied'"
      class="admin-settings__denied"
      role="alert"
      data-testid="settings-tab-denied"
    >
      <h1 class="admin-settings__heading">
        {{ t("admin.scopes.deniedTitle") }}
      </h1>
      <p class="admin-settings__panel-text">
        {{ t("admin.scopes.deniedMessage") }}
      </p>
      <p class="admin-settings__panel-text">
        {{
          t("admin.settings.deniedTab", {
            tab: t(resolution.tab.labelKey)
          })
        }}
      </p>
      <p v-if="defaultTab !== null" class="admin-settings__panel-text">
        <RouterLink
          :to="{ query: { ...route.query, tab: defaultTab.id } }"
          class="admin-settings__link focus-ring"
          data-testid="settings-denied-suggestion"
        >
          {{ t("admin.settings.openGranted", { tab: t(defaultTab.labelKey) }) }}
        </RouterLink>
      </p>
    </section>

    <!-- No settings/entity capability at all (zero-scope session). -->
    <section
      v-else-if="resolution.kind === 'none'"
      class="admin-settings__denied"
      role="alert"
      data-testid="settings-none"
    >
      <h1 class="admin-settings__heading">
        {{ t("admin.scopes.deniedTitle") }}
      </h1>
      <p class="admin-settings__panel-text">
        {{ t("admin.scopes.deniedMessage") }}
      </p>
    </section>

    <template v-else>
      <h1
        v-if="resolution.tab.kind === 'settings'"
        class="admin-settings__heading"
      >
        {{ t(resolution.tab.labelKey) }}
      </h1>

      <div
        :id="`settings-panel-${resolution.tab.id}`"
        role="tabpanel"
        :aria-labelledby="`settings-tab-${resolution.tab.id}`"
        tabindex="0"
        class="admin-settings__panel"
        :data-testid="`settings-host-${resolution.tab.id}`"
      >
        <OrganizationSettingsForm
          v-if="resolution.tab.kind === 'settings'"
          :key="resolution.tab.id"
          :group="settingsGroup"
        />
        <component :is="entityComponent" v-else />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, type Component } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import AdminTabs, { type AdminTab } from "@/components/admin/AdminTabs.vue";
import OrganizationSettingsForm from "@/components/admin/OrganizationSettingsForm.vue";
import { useAuth } from "@/features/auth/authStore";
import type { SettingGroup } from "@/features/settings/definition";
import {
  resolveSettingsTab,
  visibleSettingsTabs,
  type SettingsTabDefinition,
  type SettingsTabId
} from "@/features/settings/settingsTabs";

/**
 * T-048 — page orchestration only. The route owns `?tab=` so the active tab is
 * linkable and a direct URL is testable; the pure resolver owns the rights
 * matrix.
 */
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { capabilities } = useAuth();

/**
 * Entity tabs mount the shipped pages unchanged. Async components keep the
 * admin settings chunk from eagerly containing five editors (T-044 chunk
 * contract); the hosted pages still own their own data and mutation paths.
 */
const ENTITY_COMPONENTS: Partial<Record<SettingsTabId, Component>> = {
  team: defineAsyncComponent(() => import("@/pages/admin/AdminTeamPage.vue")),
  documents: defineAsyncComponent(
    () => import("@/pages/admin/AdminDocumentsPage.vue")
  ),
  projects: defineAsyncComponent(
    () => import("@/pages/admin/AdminProjectsPage.vue")
  ),
  events: defineAsyncComponent(
    () => import("@/pages/admin/AdminEventsPage.vue")
  ),
  publications: defineAsyncComponent(
    () => import("@/pages/admin/AdminPublicationsPage.vue")
  )
};

const requestedTab = computed(() => {
  const value = route.query.tab;
  return typeof value === "string" ? value : null;
});

const resolution = computed(() =>
  resolveSettingsTab(requestedTab.value, capabilities.value)
);

const visibleTabs = computed(() => visibleSettingsTabs(capabilities.value));

const tabItems = computed<readonly AdminTab[]>(() =>
  visibleTabs.value.map(tab => ({
    id: tab.id,
    label: t(tab.labelKey),
    testId: tab.testId
  }))
);

/** The first granted tab is the fallback suggestion for a denied URL. */
const defaultTab = computed<SettingsTabDefinition | null>(
  () => visibleTabs.value[0] ?? null
);

const activeTabId = computed(() => {
  if (resolution.value.kind === "tab") return resolution.value.tab.id;
  return defaultTab.value?.id ?? "";
});

const settingsGroup = computed<SettingGroup>(() =>
  resolution.value.kind === "tab" && resolution.value.tab.id === "contacts"
    ? "contacts"
    : "general"
);

const entityComponent = computed<Component | null>(() => {
  if (resolution.value.kind !== "tab") return null;
  if (resolution.value.tab.kind !== "entity") return null;
  return ENTITY_COMPONENTS[resolution.value.tab.id] ?? null;
});

function onTabChange(id: string): void {
  void router.replace({ query: { ...route.query, tab: id } });
}
</script>

<style scoped>
.admin-settings {
  max-width: 72rem;
}

.admin-settings__intro {
  margin: 0 0 1rem;
  max-width: 70ch;
  color: var(--color-text-muted);
  line-height: 1.6;
}

.admin-settings__heading {
  margin: 0 0 0.75rem;
  font-size: var(--font-size-h2);
  font-weight: 700;
}

.admin-settings__panel-text {
  margin: 0 0 0.5rem;
  max-width: 70ch;
  line-height: 1.6;
}

.admin-settings__link {
  color: var(--color-link);
  font-weight: 600;
}

.admin-settings__denied {
  padding: 1rem 1.25rem;
  border: 1px solid var(--color-border);
  border-left: 4px solid var(--color-accent);
  border-radius: 0.375rem;
  background: var(--color-surface-raised);
}
</style>
