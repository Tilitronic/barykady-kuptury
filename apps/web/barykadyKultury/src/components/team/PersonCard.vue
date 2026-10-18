<template>
  <li class="team-card">
    <div class="team-card__portrait">
      <img
        v-if="portraitUrl"
        class="team-card__portrait-img"
        :src="portraitUrl"
        :alt="altText"
        loading="lazy"
        width="480"
        height="480"
      />
      <!--
        No approved portrait exists: a neutral monogram stands in. It is a
        typographic placeholder, never presented as a real image, so it is
        hidden from assistive technology (DESIGN_SYSTEM.md §3, §6).
      -->
      <span v-else class="team-card__monogram" aria-hidden="true">
        {{ monogram }}
      </span>
    </div>

    <h2 class="team-card__name">{{ member.name }}</h2>

    <p v-if="member.role" class="team-card__role">{{ member.role }}</p>
    <p v-if="member.bio" class="team-card__bio">{{ member.bio }}</p>

    <!--
      The note names the source language only when English role/bio text has
      actually been substituted (DESIGN_SYSTEM.md §6); a fallback selection
      with no localized fields would otherwise claim a substitution that is
      not visible (T-018 review, Spec finding 2).
    -->
    <p
      v-if="member.isFallback && (member.role || member.bio)"
      class="team-card__fallback"
      role="note"
    >
      {{
        t("content.fallbackNote", { language: t("content.fallbackLanguage") })
      }}
    </p>
  </li>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import type { TeamMember } from "@/features/team/api";

/**
 * One team member card (T-018).
 *
 * Pure presentational component: the feature layer resolves the portrait
 * public URL (`useTeamMembers` → `teamPortraitUrl`) and passes it in as
 * plain data, so this card injects no client and builds no storage request
 * (AGENTS.md coding conventions; T-018 review, Standards finding 1).
 *
 * Optional role/bio collapse cleanly (no placeholder dashes); the portrait is
 * lazy-loaded with an alt composed from name + role because the image
 * identifies a person, and falls back to an aria-hidden monogram when no
 * approved photo exists. Text is never truncated — longer Polish and
 * Ukrainian copy simply grows the card.
 */
const props = defineProps<{
  member: TeamMember;
  portraitUrl: string | null;
}>();

const { t } = useI18n();

const altText = computed(() =>
  [props.member.name, props.member.role].filter(Boolean).join(", ")
);

/** Up to two initials, e.g. "Anna Kowalska" → "AK". */
const monogram = computed(() =>
  props.member.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join("")
);
</script>

<style scoped>
.team-card {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.team-card__portrait {
  aspect-ratio: 1;
  width: 100%;
  max-width: 16rem;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background-color: var(--color-surface);
}

.team-card__portrait-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.team-card__monogram {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: var(--color-text-muted);
  font-size: var(--font-size-h2);
  font-weight: 600;
  letter-spacing: 0.06em;
}

.team-card__name {
  margin: 0.75rem 0 0;
  font-size: var(--font-size-h3);
}

.team-card__role {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  font-weight: 600;
}

.team-card__bio {
  margin: 0;
  overflow-wrap: break-word;
}

.team-card__fallback {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  font-style: italic;
}
</style>
