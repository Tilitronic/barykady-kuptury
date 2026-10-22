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
      <p class="admin-dashboard__action">
        <RouterLink
          :to="`/${currentLocale}/admin/projects`"
          class="admin-dashboard__link focus-ring"
          data-testid="dashboard-projects-link"
        >
          {{ t("admin.projects.title") }}
        </RouterLink>
      </p>
      <p class="admin-dashboard__action">
        <RouterLink
          :to="`/${currentLocale}/admin/import`"
          class="admin-dashboard__link focus-ring"
        >
          {{ t("admin.import.title") }}
        </RouterLink>
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import { useAuth } from "@/features/auth/authStore";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";

/**
 * T-026 — signed-in admin overview. The guard has already proven the
 * canonical claim (app_metadata.role, D-17); this page only displays the
 * session's email as a "who am I" anchor. Data-management panels replace the
 * placeholder as their tickets land.
 */
const { t } = useI18n();
const { user } = useAuth();
const route = useRoute();

const userEmail = computed(() => user.value?.email ?? "");
const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

/** Stable id so the panel's accessible name relation never drifts. */
const panelHeadingId = "admin-dashboard-panel-heading";
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
</style>
