<template>
  <!--
    Explicit denial (T-026).

    The terminal state for a signed-in account without the canonical admin
    claim — an honest page instead of a redirect loop or a silent bounce to
    the sign-in form. The guard reaches it once and then allows it
    (`adminGuard.test.ts` pins that), and the copy states both the fact and
    the only two exits: ask for an invite, or switch account.

    The heading is the state ("Not authorized") — text, never color alone
    (DESIGN_SYSTEM.md §6). Deliberately no alarm styling: this is a
    permissions fact, not an error the user caused.
  -->
  <div class="admin-denied">
    <h1 class="admin-denied__heading">{{ heading }}</h1>
    <p class="admin-denied__message">{{ message }}</p>

    <div class="admin-denied__actions">
      <RouterLink
        :to="switchAccountTarget"
        class="admin-denied__switch focus-ring"
      >
        {{ t("admin.denied.switchAccount") }}
      </RouterLink>
      <button
        type="button"
        class="admin-denied__sign-out focus-ring"
        :aria-busy="signingOut"
        :disabled="signingOut"
        @click="onSignOut"
      >
        {{ t("admin.signOut") }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import {
  ADMIN_SIGN_IN_NAME,
  adminRouteTarget
} from "@/features/auth/adminGuard";
import { useAuth } from "@/features/auth/authStore";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";

/**
 * T-026 — authenticated non-admin page. Both exits are real: the switch-account
 * link reopens the sign-in form (the guard lets non-admins view it), and
 * signing out returns to the public home through the layout's own action.
 */
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { isAdmin, signOut } = useAuth();

const signingOut = ref(false);

/**
 * T-046: a scoped editor bounced from an out-of-scope route arrives with
 * `?missing=<scope>` from the guard. They ARE an administrator, just not for
 * that area, so the copy must not claim they lack administrator access.
 */
const isScopedDenial = computed(
  () => isAdmin.value && typeof route.query.missing === "string"
);

const heading = computed(() =>
  isScopedDenial.value
    ? t("admin.scopes.deniedTitle")
    : t("admin.denied.heading")
);

const message = computed(() =>
  isScopedDenial.value
    ? t("admin.scopes.deniedMessage")
    : t("admin.denied.message")
);

const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

/** Name-based target through the single typed-router bridge (see adminGuard). */
const switchAccountTarget = computed(() =>
  adminRouteTarget(ADMIN_SIGN_IN_NAME, currentLocale.value)
);

async function onSignOut(): Promise<void> {
  signingOut.value = true;
  try {
    await signOut();
    await router.push(`/${currentLocale.value}`);
  } finally {
    signingOut.value = false;
  }
}
</script>

<style scoped>
.admin-denied {
  max-width: 42rem;
}

.admin-denied__heading {
  margin: 0 0 0.75rem;
  /* Section-heading token — see AdminSignInPage for the deliberate rung. */
  font-size: var(--font-size-h2);
  font-weight: 700;
}

.admin-denied__message {
  margin: 0 0 2rem;
  line-height: 1.6;
}

.admin-denied__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem 1.5rem;
}

.admin-denied__switch {
  padding: 0.625rem 1.25rem;
  border: 1px solid var(--color-form-border);
  border-radius: 0.375rem;
  background: var(--color-form-bg);
  color: var(--color-text);
  font-weight: 600;
  text-decoration: none;
}

.admin-denied__switch:hover {
  border-color: var(--color-accent);
}

.admin-denied__sign-out {
  padding: 0.625rem 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.admin-denied__sign-out:hover {
  border-color: var(--color-danger);
}

.admin-denied__sign-out:disabled {
  color: var(--color-disabled-text);
  cursor: wait;
}
</style>
