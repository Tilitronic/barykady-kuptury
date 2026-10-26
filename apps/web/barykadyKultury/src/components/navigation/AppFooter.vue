<template>
  <footer class="app-footer" role="contentinfo">
    <div class="app-footer__inner">
      <!-- Brand column -->
      <div class="app-footer__brand">
        <a
          :href="`/${currentLocale}`"
          class="app-footer__brand-link focus-ring"
          :aria-label="t('brand.logoLabel')"
          @click.prevent="router.push(`/${currentLocale}`)"
        >
          <BrandLogo context="footer" size="md" :decorative="true" />
        </a>
      </div>

      <!-- Navigation column -->
      <nav class="app-footer__nav" :aria-label="t('footer.nav')">
        <ul class="app-footer__nav-list">
          <li
            v-for="item in mainNavItems"
            :key="item.routeName"
            class="app-footer__nav-item"
          >
            <RouterLink
              :to="`/${currentLocale}/${item.path}`"
              class="app-footer__nav-link focus-ring"
              :aria-current="isActivePage(item) ? 'page' : undefined"
            >
              {{ t(`nav.${item.labelKey}`) }}
            </RouterLink>
          </li>
        </ul>
      </nav>

      <!--
        Contact block — D-04 OPEN.
        Renders only when at least one contact field is non-empty.
        No invented data is ever displayed here.
      -->
      <address v-if="hasContactData" class="app-footer__contact">
        <a
          v-if="config.contact.email"
          :href="mailtoHref(config.contact.email)"
          class="app-footer__contact-link focus-ring"
        >
          {{ config.contact.email }}
        </a>
        <span v-if="config.contact.phone">{{ config.contact.phone }}</span>
        <span v-if="config.contact.address">{{ config.contact.address }}</span>
      </address>

      <!-- Social links — D-05/T-048: SocialLinks renders nothing when empty -->
      <SocialLinks :links="config.socialLinks" />
    </div>

    <!-- Legal line: only verified identifiers (D-13, govIds.txt) -->
    <div class="app-footer__legal">
      <span v-if="config.name || config.seat" class="app-footer__legal-name">
        <template v-if="config.name && config.seat">
          {{ config.name }},&nbsp;{{ config.seat }}
        </template>
        <template v-else>{{ config.name || config.seat }}</template>
      </span>
      <template v-if="config.nip || config.regon">
        <span class="app-footer__legal-sep" aria-hidden="true">·</span>
        <span class="app-footer__legal-ids">
          <span v-if="config.nip">NIP&nbsp;{{ config.nip }}</span>
          <span v-if="config.nip && config.regon" aria-hidden="true"
            >&nbsp;/&nbsp;</span
          >
          <span v-if="config.regon">REGON&nbsp;{{ config.regon }}</span>
        </span>
      </template>
      <template v-if="config.privacyUrl">
        <span class="app-footer__legal-sep" aria-hidden="true">·</span>
        <a
          :href="config.privacyUrl"
          class="app-footer__privacy-link focus-ring"
        >
          {{ t("footer.privacyPolicy") }}</a
        >
      </template>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import BrandLogo from "@/components/brand/BrandLogo.vue";
import SocialLinks from "@/components/navigation/SocialLinks.vue";
import { mainNavItems, type NavItem } from "@/config/navigation";
import { DEFAULT_LOCALE, isLocale } from "@/features/i18n/locales";
import { useOrganizationConfig } from "@/features/settings/state";
import { mailtoHref } from "@/shared/links";

/**
 * T-011 — AppFooter
 *
 * Footer landmark (role="contentinfo") with:
 *   - navigation column (mirrors main nav),
 *   - contact block hidden until D-04 supplies data,
 *   - social links rendered only when D-05 supplies URLs (SocialLinks handles this),
 *   - legal line with only verified identifiers from the config.
 *
 * No invented data is ever rendered. Missing fields = missing UI elements.
 */

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const currentLocale = computed(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

/**
 * T-048 — the resolved shape already applies visibility filtering, so the
 * footer has no second copy of the rule. With no rows the resolver returns the
 * static parity shape (identical markup when every flag is visible).
 */
const config = useOrganizationConfig(currentLocale);

/**
 * Only the three channels this block actually renders count. Office hours and
 * paper mail are contact facts too, but they live on the Contact page — an
 * empty <address> in the footer would be a rendering bug, not "visible".
 */
const hasContactData = computed(() => {
  const contact = config.value.contact;
  return (
    contact.email.trim().length > 0 ||
    contact.phone.trim().length > 0 ||
    contact.address.trim().length > 0
  );
});

function isActivePage(item: NavItem): boolean {
  const name = String(route.name ?? "");
  if (item.routeName === "about") {
    return name === "about" || name.startsWith("about-");
  }
  return name === item.routeName;
}
</script>

<style scoped>
/* ── Outer shell ─────────────────────────────────────────────────────────── */

.app-footer {
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  padding: 3rem 1.25rem 1.5rem;
}

/* ── Content grid ────────────────────────────────────────────────────────── */

.app-footer__inner {
  display: flex;
  flex-wrap: wrap;
  gap: 2rem 3rem;
  max-width: 72rem;
  margin: 0 auto 2rem;
}

/* ── Brand ───────────────────────────────────────────────────────────────── */

.app-footer__brand {
  flex: 0 0 auto;
}

.app-footer__brand-link {
  display: inline-flex;
  text-decoration: none;
}

/* ── Navigation ──────────────────────────────────────────────────────────── */

.app-footer__nav {
  flex: 1 1 10rem;
}

.app-footer__nav-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.app-footer__nav-link {
  font-size: var(--font-size-small);
  color: var(--color-text-muted);
  text-decoration: none;
  transition: color var(--motion-duration);
}

.app-footer__nav-link:hover {
  color: var(--color-link);
}

/* T-033: active label uses the link token (accent surface value fails AA as
   normal text in dark, 4.24:1); identical SCARLET in light mode. */
.app-footer__nav-link[aria-current="page"] {
  color: var(--color-link);
  font-weight: 600;
}

/* ── Contact ─────────────────────────────────────────────────────────────── */

.app-footer__contact {
  flex: 1 1 12rem;
  font-style: normal;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  font-size: var(--font-size-small);
  color: var(--color-text-muted);
}

.app-footer__contact-link {
  color: var(--color-link);
  text-decoration: underline;
}

/* ── Legal line ──────────────────────────────────────────────────────────── */

.app-footer__legal {
  max-width: 72rem;
  margin: 0 auto;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--font-size-small);
  color: var(--color-text-muted);
}

.app-footer__legal-sep {
  color: var(--color-border);
}

.app-footer__privacy-link {
  color: var(--color-link);
  text-decoration: underline;
}
</style>
