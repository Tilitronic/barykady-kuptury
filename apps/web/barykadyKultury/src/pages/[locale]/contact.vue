<template>
  <div class="contact-page">
    <h1 class="contact-page__title">{{ t("contact.title") }}</h1>

    <!--
      Only configured channels render. When none are configured (D-04 open),
      the page shows a translated explanation and in-page routes to About and
      Support — never an invented email, phone or address.
    -->
    <ContactChannels v-if="hasChannels" :details="details" />

    <div v-else class="contact-page__empty">
      <p class="contact-page__empty-message">{{
        t("contact.notConfigured")
      }}</p>
      <p class="contact-page__empty-guidance">{{ t("contact.guidance") }}</p>
      <ul class="contact-page__empty-links">
        <li>
          <RouterLink
            :to="`/${currentLocale}/about`"
            class="contact-page__link focus-ring"
          >
            {{ t("nav.about") }}
          </RouterLink>
        </li>
        <li>
          <RouterLink
            :to="`/${currentLocale}/support`"
            class="contact-page__link focus-ring"
          >
            {{ t("nav.support") }}
          </RouterLink>
        </li>
      </ul>
    </div>

    <!--
      T-043: labeled social block near the contact channels. The heading only
      renders when at least one channel has a URL — with an empty config the
      whole section is absent (SocialLinks itself renders nothing, D-05).
    -->
    <section
      v-if="hasSocialLinks"
      class="contact-page__social"
      aria-labelledby="contact-follow-us"
    >
      <h2 id="contact-follow-us" class="contact-page__social-title">
        {{ t("contact.followUs") }}
      </h2>
      <SocialLinks :links="config.socialLinks" variant="labeled" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import ContactChannels from "@/components/contact/ContactChannels.vue";
import SocialLinks from "@/components/navigation/SocialLinks.vue";
import { hasActiveSocialLinks } from "@/config/organization";
import { readContactFixture } from "@/features/contact/contactFixture";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";
import { hasResolvedContact } from "@/features/settings/resolve";
import { useOrganizationConfig } from "@/features/settings/state";

/**
 * Contact page (T-021).
 *
 * Renders only verified contact channels from the organization config (D-04).
 * While the config is empty this is the translated "not published yet" state
 * with routes to About and Support; no fake form and no invented details ship
 * (docs/PRODUCT_REQUIREMENTS.md §4, docs/architecture.md §7, decisions D-04 and
 * D-09). PublicLayout provides the shell — do NOT add AppShell here.
 */
const { t } = useI18n();
const route = useRoute();

const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

/**
 * The shipped config is empty while D-04 is open. The E2E build may supply a
 * clearly fictional fixture through the guarded seam; production builds get
 * `null` and therefore the real empty state (AGENTS.md rule 6).
 */
/**
 * T-048 — settings-driven contact facts. The E2E fixture seam still wins when
 * the build explicitly enables it (contact-contract journeys); otherwise the
 * resolved settings shape applies visibility and the static parity fallback.
 */
const fixture = readContactFixture();
const config = useOrganizationConfig(currentLocale);
const details = computed(() => fixture ?? config.value.contact);
const hasChannels = computed(() => hasResolvedContact(details.value));

/** Guard on the shared D-05 predicate (same rule SocialLinks applies) so
 * the "Follow us" heading never strands above an empty list. */
const hasSocialLinks = computed(() =>
  hasActiveSocialLinks(config.value.socialLinks)
);
</script>

<style scoped>
.contact-page__title {
  max-width: 65ch;
  margin: 0 0 1.5rem;
}

.contact-page__empty {
  max-width: 65ch;
}

.contact-page__empty-message {
  margin: 0 0 1rem;
}

.contact-page__empty-guidance {
  margin: 0 0 0.5rem;
  color: var(--color-text-muted);
}

.contact-page__empty-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.contact-page__link {
  color: var(--color-link);
  text-decoration: underline;
}

.contact-page__link:hover {
  text-decoration: none;
}

/* ── T-043: follow-us social block ─────────────────────────────────────── */

.contact-page__social {
  max-width: 65ch;
  margin-top: 2.5rem;
}

.contact-page__social-title {
  margin: 0 0 0.75rem;
  font-size: var(--font-size-h2);
}
</style>
