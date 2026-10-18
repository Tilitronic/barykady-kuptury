<template>
  <div class="about-team-page">
    <h1 class="about-team-page__title">{{ t("aboutTeam.title") }}</h1>

    <div
      v-if="result.kind === 'loading'"
      class="about-team-page__state"
      role="status"
    >
      {{ t("content.loading") }}
    </div>
    <div v-else-if="result.kind === 'empty'" class="about-team-page__state">
      {{ t("aboutTeam.empty") }}
    </div>
    <div
      v-else-if="result.kind === 'unavailable'"
      class="about-team-page__state"
    >
      {{ t("content.unavailable") }}
    </div>
    <ul v-else class="team-grid">
      <PersonCard v-for="member in members" :key="member.id" :member="member" />
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import PersonCard from "@/components/team/PersonCard.vue";
import type { TeamMember } from "@/features/team/api";
import { useTeamMembers } from "@/features/team/useTeamMembers";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";

/**
 * About → Team listing (T-018).
 *
 * Members come from `team_members` + translations ordered by the
 * locale-independent `sort_order`; role, bio and portrait are optional and
 * collapse when absent. No team data is approved yet, so the shipped state
 * today is the translated empty state — nothing is fabricated
 * (docs/DESIGN_SYSTEM.md §3). PublicLayout provides the shell — do NOT add
 * AppShell here.
 */
const { t } = useI18n();
const route = useRoute();

const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

const { result } = useTeamMembers(currentLocale);

const members = computed<readonly TeamMember[]>(() =>
  result.value.kind === "ok" ? result.value.items : []
);
</script>

<style scoped>
.about-team-page__title {
  max-width: 65ch;
  margin: 0 0 1.5rem;
}

.about-team-page__state {
  max-width: 65ch;
  margin: 0;
  color: var(--color-text-muted);
}

/**
 * Fluid grid: one column on a 320 px phone (the `min(100%, 16rem)` floor
 * prevents horizontal overflow), growing to two or three columns on wider
 * containers without a media-query ladder.
 */
.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
  gap: 2rem 1.5rem;
  max-width: 65rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
