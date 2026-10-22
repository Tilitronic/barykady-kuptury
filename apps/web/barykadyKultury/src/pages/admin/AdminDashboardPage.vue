<template>
  <!--
    Admin dashboard placeholder (T-026).

    The admin area's first surface. It intentionally ships with NO links to
    management features that do not exist yet (T-027…T-031 own those) — a
    dead nav entry is worse than an honest placeholder. The text names the
    upcoming tickets so the shell reads as a real work-in-progress, not a
    broken template.
  -->
  <div class="admin-dashboard">
    <h1 class="admin-dashboard__heading">{{
      t("admin.dashboardPage.heading")
    }}</h1>

    <p class="admin-dashboard__welcome">
      {{ t("admin.dashboardPage.welcome", { email: userEmail }) }}
    </p>

    <section class="admin-dashboard__panel" :aria-labelledby="panelHeadingId">
      <h2 :id="panelHeadingId" class="admin-dashboard__panel-title">
        {{ t("admin.dashboardPage.placeholderHeading") }}
      </h2>
      <p class="admin-dashboard__panel-text">
        {{ t("admin.dashboardPage.placeholder") }}
      </p>
      <p v-if="can('pages:write')" class="admin-dashboard__action">
        <RouterLink
          :to="`/${currentLocale}/admin/pages`"
          class="admin-dashboard__link focus-ring"
          data-testid="dashboard-pages-link"
        >
          {{ t("admin.content.title") }}
        </RouterLink>
      </p>
      <p v-if="can('projects:write')" class="admin-dashboard__action">
        <RouterLink
          :to="`/${currentLocale}/admin/projects`"
          class="admin-dashboard__link focus-ring"
          data-testid="dashboard-projects-link"
        >
          {{ t("admin.projects.title") }}
        </RouterLink>
      </p>
      <p v-if="can('team:write')" class="admin-dashboard__action">
        <RouterLink
          :to="`/${currentLocale}/admin/team`"
          class="admin-dashboard__link focus-ring"
          data-testid="dashboard-team-link"
        >
          {{ t("admin.team.title") }}
        </RouterLink>
      </p>
      <p v-if="can('importer')" class="admin-dashboard__action">
        <RouterLink
          :to="`/${currentLocale}/admin/import`"
          class="admin-dashboard__link focus-ring"
          data-testid="dashboard-import-link"
        >
          {{ t("admin.import.title") }}
        </RouterLink>
      </p>
    </section>

    <!--
      T-046: a scoped editor sees exactly the areas granted in
      app_metadata.scopes. Root is the SQL bypass and needs no list, so the
      panel is hidden for root sessions.
    -->
    <section
      v-if="!isRootAdmin && capabilities.length > 0"
      class="admin-dashboard__panel admin-dashboard__access"
      :aria-labelledby="accessHeadingId"
      data-testid="dashboard-access"
    >
      <h2 :id="accessHeadingId" class="admin-dashboard__panel-title">
        {{ t("admin.scopes.label") }}
      </h2>
      <ul class="admin-dashboard__scope-list">
        <li v-for="scope in capabilities" :key="scope">
          {{ t(SCOPE_LABEL_KEYS[scope]) }}
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import type { AdminScope } from "@/features/auth/adminClaim";
import { useAuth } from "@/features/auth/authStore";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";

/**
 * T-026 — signed-in admin overview. The guard has already proven the
 * canonical claim (app_metadata.role, D-17); this page only displays the
 * session's email as a "who am I" anchor. Data-management panels replace the
 * placeholder as their tickets land.
 */
const { t } = useI18n();
const { user, capabilities, isRootAdmin, can } = useAuth();
const route = useRoute();

/**
 * Scope → message key. Kept here (not in the parser) because it is display
 * policy; the vocabulary itself stays in adminClaim.ts, shared with the guard.
 */
const SCOPE_LABEL_KEYS: Record<AdminScope, string> = {
  "pages:write": "admin.scopes.pages",
  "projects:write": "admin.scopes.projects",
  "publications:write": "admin.scopes.publications",
  "documents:write": "admin.scopes.documents",
  "team:write": "admin.scopes.team",
  "events:write": "admin.scopes.events",
  "media:write": "admin.scopes.media",
  importer: "admin.scopes.importer"
};

const userEmail = computed(() => user.value?.email ?? "");
const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

/** Stable ids so the panels' accessible name relations never drift. */
const panelHeadingId = "admin-dashboard-panel-heading";
const accessHeadingId = "admin-dashboard-access-heading";
</script>

<style scoped>
.admin-dashboard__heading {
  margin: 0 0 0.5rem;
  /* Section-heading token — see AdminSignInPage for the deliberate rung. */
  font-size: var(--font-size-h2);
  font-weight: 700;
}

.admin-dashboard__welcome {
  margin: 0 0 2rem;
  color: var(--color-text-muted);
  overflow-wrap: anywhere;
}

/*
 * Raised surface panel: same token ladder as the public cards
 * (background → surface → surface-raised), so the admin reads as one design
 * system while being visually a workspace.
 */
.admin-dashboard__panel {
  padding: 1.25rem 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-sm);
}

.admin-dashboard__panel-title {
  margin: 0 0 0.5rem;
  font-size: 1.125rem;
  font-weight: 700;
}

.admin-dashboard__panel-text {
  margin: 0;
  max-width: 65ch;
  line-height: 1.6;
}

.admin-dashboard__action {
  margin: 1rem 0 0;
}

.admin-dashboard__link {
  color: var(--color-link);
  font-weight: 600;
}

.admin-dashboard__access {
  margin-top: 1rem;
}

.admin-dashboard__scope-list {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
  line-height: 1.6;
}
</style>
