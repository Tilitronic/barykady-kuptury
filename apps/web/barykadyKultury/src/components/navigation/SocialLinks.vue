<template>
  <!--
    Renders only the configured social links. When the list is empty (D-05 current
    state) or all URLs are empty strings, the component renders nothing at all —
    no wrapper element, no placeholder.

    Each link is icon-only so every <a> carries an aria-label equal to the
    configured label string (DESIGN_SYSTEM.md §4/§6).
  -->
  <ul
    v-if="activeLinks.length > 0"
    class="social-links"
    :aria-label="t('footer.socialNav')"
  >
    <li
      v-for="link in activeLinks"
      :key="link.platform"
      class="social-links__item"
    >
      <a
        :href="link.url"
        :aria-label="link.label"
        class="social-links__link focus-ring"
        target="_blank"
        rel="noopener noreferrer"
      >
        <!-- Icon placeholder — a real icon library will replace this text in
             later tickets once icon names are standardised (DESIGN_SYSTEM.md §4
             "icon names"). The aria-label on the <a> already provides the
             accessible name; the inner span is presentational only. -->
        <span class="social-links__icon" aria-hidden="true">
          {{ platformIcon(link.platform) }}
        </span>
      </a>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import type { SocialLink } from "@/config/organization";

/**
 * T-011 — SocialLinks component.
 *
 * Renders ONLY links whose URL is a non-empty string. Renders nothing at all
 * when the list is empty (D-05 open: no social URLs configured yet).
 *
 * Props:
 *   links — The array of SocialLink objects from the organization config.
 *            Pass organization.socialLinks directly or inject a test set.
 *
 * The list landmark label (footer.socialNav) must come from i18n so it
 * translates correctly in all three locales (rev-2 finding A).
 */

const props = defineProps<{
  links: SocialLink[];
}>();

const { t } = useI18n();

/**
 * Filter to entries with a non-empty URL. An empty string is the sentinel for
 * "not configured yet" (D-05 contract in organization.ts).
 */
const activeLinks = computed(() =>
  props.links.filter(link => link.url.trim().length > 0)
);

/**
 * Temporary text icon while a proper icon library is pending.
 * Returns a short platform abbreviation for visual orientation in dev.
 * Replace with SVG icons or a component when the icon system is finalised.
 */
function platformIcon(platform: SocialLink["platform"]): string {
  const icons: Record<SocialLink["platform"], string> = {
    facebook: "FB",
    instagram: "IG",
    youtube: "YT",
    twitter: "TW",
    linkedin: "LI"
  };
  return icons[platform] ?? platform.slice(0, 2).toUpperCase();
}
</script>

<style scoped>
.social-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.social-links__link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  color: var(--color-text);
  text-decoration: none;
  font-size: var(--font-size-small);
  font-weight: 600;
  transition:
    background-color var(--motion-duration),
    border-color var(--motion-duration);
}

.social-links__link:hover {
  background: var(--color-surface-raised);
  border-color: var(--color-text-muted);
}
</style>
