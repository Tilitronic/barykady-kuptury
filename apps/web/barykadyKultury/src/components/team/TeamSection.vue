<template>
  <!--
    TeamSection — the T-018 team listing as an anchored About section (T-039,
    D-25). The old `/about/team` route redirects here.

    Contract: `section#team` with a `tabindex="-1"` h2 (deep-link focus
    target), the page's `scroll-margin-top` applied by the owning page, and
    independent loading/empty/unavailable states — a team failure never
    blanks the rest of About (docs/DESIGN_SYSTEM.md §6, T-039 page structure).
  -->
  <section id="team" class="team-section">
    <h2 class="team-section__heading" tabindex="-1">{{
      t("aboutTeam.title")
    }}</h2>

    <p
      v-if="result.kind === 'loading'"
      class="team-section__state"
      role="status"
    >
      {{ t("content.loading") }}
    </p>
    <p v-else-if="result.kind === 'empty'" class="team-section__state">
      {{ t("aboutTeam.empty") }}
    </p>
    <p
      v-else-if="result.kind === 'unavailable'"
      class="team-section__state"
      role="alert"
    >
      {{ t("content.unavailable") }}
    </p>
    <ul v-else class="team-section__grid">
      <PersonCard
        v-for="member in members"
        :key="member.id"
        :member="member"
        :portrait-url="member.portraitUrl"
        :heading-level="3"
      />
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import PersonCard from "@/components/team/PersonCard.vue";
import {
  useTeamMembers,
  type TeamMemberView
} from "@/features/team/useTeamMembers";
import type { Locale } from "@/features/i18n/locales";

/**
 * T-039 — extracted from `about-team.vue` without behavior change: same
 * composable, same card grid, same collapse rules (role/bio/portrait are
 * optional; nothing is fabricated, docs/DESIGN_SYSTEM.md §3).
 */
const { t } = useI18n();

const props = defineProps<{ locale: Locale }>();

// `MaybeRef` re-fetch wiring: a locale change (route prefix swap) must
// re-query, so the prop is exposed as a computed ref, not a plain value.
const { result } = useTeamMembers(computed(() => props.locale));

const members = computed<readonly TeamMemberView[]>(() =>
  result.value.kind === "ok" ? result.value.items : []
);
</script>

<style scoped>
.team-section__heading {
  margin: 0 0 1.25rem;
  font-size: var(--font-size-h2);
}

.team-section__state {
  max-width: 65ch;
  margin: 0;
  color: var(--color-text-muted);
}

/**
 * Fluid grid (T-018 rule): one column on a 320 px phone — the
 * `min(100%, 16rem)` floor prevents horizontal overflow — two to three
 * columns on wider containers, no media-query ladder.
 */
.team-section__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
  gap: 2rem 1.5rem;
  max-width: 65rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
