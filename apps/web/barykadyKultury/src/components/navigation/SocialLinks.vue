<template>
  <!--
    Renders only the configured social links. When the list is empty or all
    URLs are empty strings, the component renders nothing at all — no wrapper
    element, no placeholder (D-05 contract).

    T-043: the temporary text abbreviations ("FB", "IG", …) are replaced by
    inline SVG glyphs drawn in the same 24×24 stroke language as the search
    icon (round caps/joins, currentColor) — no icon-library dependency. The
    SVG is decorative (aria-hidden); the accessible name is the localized
    platform name from social.labels.<platform>, falling back to the
    configured link.label.

    Two variants:
      - "icon"    (header/footer): 2.25rem square target, icon only, name
        carried by aria-label/title.
      - "labeled" (contact):       icon + visible platform name.
  -->
  <ul
    v-if="activeLinks.length > 0"
    class="social-links"
    :class="`social-links--${variant}`"
    :aria-label="t('footer.socialNav')"
  >
    <li
      v-for="link in activeLinks"
      :key="link.platform"
      class="social-links__item"
    >
      <a
        :href="link.url"
        :aria-label="accessibleName(link)"
        :title="accessibleName(link)"
        class="social-links__link focus-ring"
        :class="`social-links__link--${variant}`"
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg
          class="social-links__icon"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <!-- Facebook: rounded "f" plate (brand silhouette, stroke form). -->
          <template v-if="link.platform === 'facebook'">
            <path
              d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"
            />
          </template>

          <!-- Instagram: rounded square, lens circle, flash dot. -->
          <template v-else-if="link.platform === 'instagram'">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
          </template>

          <!-- Telegram: paper plane with the fold line. -->
          <template v-else-if="link.platform === 'telegram'">
            <path
              d="M21.5 4.5 2.9 11.7c-.8.3-.8 1.4.05 1.65l4.75 1.5 1.8 5.4c.25.7 1.15.85 1.65.3l2.5-2.5 4.6 3.4c.6.45 1.45.1 1.6-.65l3.1-14.9c.15-.75-.6-1.35-1.45-1z"
            />
            <path d="M7.7 14.85 18.5 6.9l-9.15 8.6-.75 4.7z" />
          </template>

          <!-- Generic globe fallback for every other supported platform
               (youtube, twitter, linkedin): the channel stays recognizably
               "an external profile link" without a bespoke glyph. -->
          <template v-else>
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path
              d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
            />
          </template>
        </svg>

        <span v-if="variant === 'labeled'" class="social-links__name">
          {{ accessibleName(link) }}
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
 * T-011 + T-043 — SocialLinks component.
 *
 * Renders ONLY links whose URL is a non-empty string. Renders nothing at all
 * when the list is empty (D-05 contract in organization.ts).
 *
 * Props:
 *   links   — The array of SocialLink objects from the organization config.
 *             Pass organization.socialLinks directly or inject a test set.
 *   variant — "icon" (default, header/footer) or "labeled" (contact page).
 *
 * The list landmark label (footer.socialNav) must come from i18n so it
 * translates correctly in all three locales (rev-2 finding A).
 */

const props = withDefaults(
  defineProps<{
    links: SocialLink[];
    /**
     * "icon": square icon-only target named by aria-label/title.
     * "labeled": icon plus visible platform name (name == aria-label, so
     * WCAG 2.5.3 "label in name" holds in every locale).
     */
    variant?: "icon" | "labeled";
  }>(),
  { variant: "icon" }
);

const { t, te } = useI18n();

/**
 * Filter to entries with a non-empty URL. An empty string is the sentinel for
 * "not configured yet" (D-05 contract in organization.ts).
 */
const activeLinks = computed(() =>
  props.links.filter(link => link.url.trim().length > 0)
);

/**
 * Localized accessible/visible name for a platform (T-043): social.labels.
 * <platform> when the catalogue has it, otherwise the configured link label.
 */
function accessibleName(link: SocialLink): string {
  const key = `social.labels.${link.platform}`;
  return te(key) ? t(key) : link.label;
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

/* Header/footer icon variant: the tight gap keeps the cluster narrow inside
   the 1280 px header budget (T-043 fit tests). */
.social-links--icon {
  gap: 0.25rem;
}

.social-links--labeled {
  gap: 0.5rem 1rem;
}

.social-links__link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  color: var(--color-text);
  text-decoration: none;
  transition:
    background-color var(--motion-duration),
    border-color var(--motion-duration);
}

.social-links__link:hover {
  background: var(--color-surface-raised);
  border-color: var(--color-text-muted);
}

/* 2.25rem square target — the ≥24 px AA minimum (WCAG 2.5.8) and the same
   metric as the search trigger and close controls. */
.social-links__link--icon {
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
}

.social-links__link--labeled {
  gap: 0.5rem;
  min-height: 2.25rem;
  padding: 0.375rem 0.75rem;
  font-weight: 600;
  color: var(--color-link);
}

.social-links__link--labeled:hover {
  text-decoration: underline;
}

.social-links__icon {
  flex: 0 0 auto;
}

.social-links__name {
  white-space: nowrap;
}
</style>
