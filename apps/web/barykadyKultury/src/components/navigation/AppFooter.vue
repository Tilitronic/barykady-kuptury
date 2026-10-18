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
          v-if="organization.email"
          :href="`mailto:${organization.email}`"
          class="app-footer__contact-link focus-ring"
        >
          {{ organization.email }}
        </a>
        <span v-if="organization.phone">{{ organization.phone }}</span>
        <span v-if="organization.address">{{ organization.address }}</span>
      </address>

      <!-- Social links — D-05 OPEN: SocialLinks renders nothing when empty -->
      <SocialLinks :links="organization.socialLinks" />
    </div>

    <!-- Legal line: only verified identifiers (D-13, govIds.txt) -->
    <div class="app-footer__legal">
      <span class="app-footer__legal-name">
        {{ organization.name }},&nbsp;{{ organization.seat }}
      </span>
      <template v-if="organization.showLegalIds">
        <span class="app-footer__legal-sep" aria-hidden="true">·</span>
        <span class="app-footer__legal-ids">
          NIP&nbsp;{{ organization.nip }}
          <span aria-hidden="true">&nbsp;/&nbsp;</span>
          REGON&nbsp;{{ organization.regon }}
        </span>
      </template>
      <template v-if="organization.privacyUrl">
        <span class="app-footer__legal-sep" aria-hidden="true">·</span>
        <a
          :href="organization.privacyUrl"
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
import { organization } from "@/config/organization";
import { mainNavItems, type NavItem } from "@/config/navigation";
import { DEFAULT_LOCALE, isLocale } from "@/features/i18n/locales";

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

/** Contact block is visible only when at least one contact field is supplied. */
const hasContactData = computed(
  () =>
    organization.email.length > 0 ||
    organization.phone.length > 0 ||
    organization.address.length > 0
);

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

.app-footer__nav-link[aria-current="page"] {
  color: var(--color-accent);
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
