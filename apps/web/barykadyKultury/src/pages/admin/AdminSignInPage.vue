<template>
  <!--
    Admin sign-in. Invited administrators only.

    Deliberate omissions, recorded per the ticket:
      * NO registration link — accounts are provisioned through trusted
        Supabase administration (docs/PRODUCT_REQUIREMENTS.md §6); a
        self-service entry point would be a privilege-escalation surface.
      * NO "forgot password" flow in V1 — password reset requires an
        email-provider decision that does not exist yet
        (docs/architecture.md §7/§9); adding the link before the provider
        exists would ship a control that cannot work.
    Both are documented in docs/tickets/T-026-admin-auth.md ("Out").

    Accessibility contract (DESIGN_SYSTEM.md §6): persistent labels via
    label[for], errors programmatically associated through
    aria-describedby + aria-invalid, submission state on the button
    (disabled + aria-busy + text change, never color alone), and a polite
    live region that announces success and failure.
  -->
  <div class="admin-signin">
    <h1 class="admin-signin__heading">{{ t("admin.signIn.heading") }}</h1>
    <p class="admin-signin__intro">{{ t("admin.signIn.intro") }}</p>

    <form class="admin-signin__form" novalidate @submit.prevent="onSubmit">
      <div class="admin-field">
        <label class="admin-field__label" for="admin-email">
          {{ t("admin.signIn.emailLabel") }}
        </label>
        <input
          id="admin-email"
          ref="emailInput"
          v-model.trim="email"
          class="admin-field__input focus-ring"
          type="email"
          name="email"
          autocomplete="email"
          autocapitalize="none"
          spellcheck="false"
          :disabled="pending"
          :aria-invalid="fieldErrors.email ? 'true' : undefined"
          :aria-describedby="
            fieldErrors.email ? 'admin-email-error' : undefined
          "
          @input="fieldErrors.email = null"
        />
        <p
          v-if="fieldErrors.email"
          id="admin-email-error"
          class="admin-field__error"
        >
          {{ fieldErrors.email }}
        </p>
      </div>

      <div class="admin-field">
        <label class="admin-field__label" for="admin-password">
          {{ t("admin.signIn.passwordLabel") }}
        </label>
        <input
          id="admin-password"
          ref="passwordInput"
          v-model="password"
          class="admin-field__input focus-ring"
          type="password"
          name="password"
          autocomplete="current-password"
          :disabled="pending"
          :aria-invalid="fieldErrors.password ? 'true' : undefined"
          :aria-describedby="
            fieldErrors.password ? 'admin-password-error' : undefined
          "
          @input="fieldErrors.password = null"
        />
        <p
          v-if="fieldErrors.password"
          id="admin-password-error"
          class="admin-field__error"
        >
          {{ fieldErrors.password }}
        </p>
      </div>

      <button
        type="submit"
        class="admin-signin__submit focus-ring"
        :disabled="pending"
        :aria-busy="pending ? 'true' : undefined"
      >
        {{ pending ? t("admin.signIn.submitting") : t("admin.signIn.submit") }}
      </button>

      <!--
        Single polite live region for the form-level outcome. It persists in
        the DOM (empty when idle) so the first announcement is reliable, and
        its text — not its color — carries the meaning (WCAG 4.1.3, 1.4.1).
      -->
      <p
        id="admin-signin-status"
        class="admin-signin__status"
        :class="{
          'admin-signin__status--error': messageKind === 'error',
          'admin-signin__status--success': messageKind === 'success'
        }"
        role="status"
        aria-live="polite"
      >
        {{ formMessage }}
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import {
  ADMIN_DASHBOARD_NAME,
  adminRouteTarget,
  REDIRECT_QUERY_KEY
} from "@/features/auth/adminGuard";
import { useAuth, type SignInFailureReason } from "@/features/auth/authStore";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_ROUTE_PATTERN,
  type Locale
} from "@/features/i18n/locales";

/**
 * Email + password sign-in against the auth store seam.
 *
 * Validation is deliberately minimal (required + shape): the authoritative
 * answer comes from Supabase Auth, and the error mapping keeps provider
 * strings out of the UI (only stable, translated reasons exist).
 */
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { signIn } = useAuth();

const email = ref("");
const password = ref("");
const pending = ref(false);
const formMessage = ref("");
const messageKind = ref<"error" | "success" | null>(null);
const emailInput = ref<HTMLInputElement | null>(null);
const passwordInput = ref<HTMLInputElement | null>(null);

const fieldErrors = reactive<{ email: string | null; password: string | null }>(
  {
    email: null,
    password: null
  }
);

const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

/**
 * Practical shape check only — no RFC pedantry. An address that fails this
 * is certainly wrong; one that passes still faces the real gatekeeper
 * (Supabase Auth) one request later.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value: string): string | null {
  if (!value) {
    return t("admin.signIn.errors.emailRequired");
  }
  return EMAIL_SHAPE.test(value) ? null : t("admin.signIn.errors.emailInvalid");
}

/** Catalogue key for each stable store reason (never a raw provider message). */
function failureMessage(reason: SignInFailureReason): string {
  const keys: Record<SignInFailureReason, string> = {
    "invalid-credentials": "admin.signIn.errors.invalidCredentials",
    unavailable: "admin.signIn.errors.unavailable",
    unexpected: "admin.signIn.errors.unexpected"
  };
  return t(keys[reason]);
}

/**
 * Only admin-shell paths under a supported locale prefix are valid post-sign-in
 * targets. External, protocol-relative, and non-admin internal paths are all
 * dropped because the redirect query is attacker-influenceable via the URL
 * bar; a newly authenticated admin must never land on attacker-chosen content.
 */
const ADMIN_REDIRECT_PATTERN = new RegExp(
  `^/(?:${LOCALE_ROUTE_PATTERN})/admin(?=[/?#]|$)`
);

function isAdminRedirectTarget(value: string): boolean {
  return ADMIN_REDIRECT_PATTERN.test(value);
}

async function goToDestination(): Promise<void> {
  const requested = route.query[REDIRECT_QUERY_KEY];
  if (typeof requested === "string" && isAdminRedirectTarget(requested)) {
    await router.push(requested);
  } else {
    await router.push(
      adminRouteTarget(ADMIN_DASHBOARD_NAME, currentLocale.value)
    );
  }
  // Focus the destination's main landmark (same WCAG 2.4.1 pattern as the
  // layout's skip link). Without this the caret drops to <body> after the
  // page swap: keyboard users restart from the top and the polite success
  // announcement can be cut off by the navigation's own DOM churn.
  await nextTick();
  document.getElementById("admin-main")?.focus();
}

async function onSubmit(): Promise<void> {
  formMessage.value = "";
  messageKind.value = null;

  fieldErrors.email = validateEmail(email.value);
  fieldErrors.password = password.value
    ? null
    : t("admin.signIn.errors.passwordRequired");

  if (fieldErrors.email || fieldErrors.password) {
    // Move the keyboard to the first problem instead of leaving the user to
    // rediscover it by tabbing from the button (DESIGN_SYSTEM.md §6).
    (fieldErrors.email ? emailInput : passwordInput).value?.focus();
    return;
  }

  pending.value = true;
  const signInResult = await signIn(email.value, password.value);
  pending.value = false;

  if (signInResult.ok) {
    messageKind.value = "success";
    formMessage.value = t("admin.signIn.success");
    await goToDestination();
    return;
  }

  messageKind.value = "error";
  formMessage.value = failureMessage(signInResult.reason);
  // Secrets do not linger after a failed attempt on a shared machine.
  password.value = "";
  passwordInput.value?.focus();
}
</script>

<style scoped>
.admin-signin {
  max-width: 28rem;
}

.admin-signin__heading {
  margin: 0 0 0.5rem;
  /*
   * Section-heading token (DESIGN_SYSTEM.md §2 printed anchor 34 px, Bold):
   * the admin surface is operational density, so its page titles sit one
   * rung below the public display h1 — deliberate, and now token-driven
   * rather than a hand-rolled clamp.
   */
  font-size: var(--font-size-h2);
  font-weight: 700;
}

.admin-signin__intro {
  margin: 0 0 2rem;
  max-width: 42ch;
  color: var(--color-text-muted);
}

.admin-signin__form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.admin-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.admin-field__label {
  font-weight: 600;
  font-size: 0.9375rem;
}

/* Form tokens (DESIGN_SYSTEM.md §5): every control has a light AND dark
   value via the token pair — no partial dark mode. */
.admin-field__input {
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-form-border);
  border-radius: 0.375rem;
  background: var(--color-form-bg);
  color: var(--color-text);
  font: inherit;
}

.admin-field__input:disabled {
  color: var(--color-disabled-text);
  background: var(--color-disabled-bg);
}

/*
 * Field errors: text + a bold danger-colored sentence — the message itself
 * carries the state (never color alone). --color-danger is the documented
 * token (DESIGN_SYSTEM.md §5).
 */
.admin-field__error {
  margin: 0;
  color: var(--color-danger);
  font-size: 0.875rem;
  font-weight: 600;
}

.admin-signin__submit {
  align-self: flex-start;
  padding: 0.625rem 1.5rem;
  border: none;
  border-radius: 0.375rem;
  background: var(--color-accent);
  color: var(--color-accent-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

/*
 * Primary action = brand scarlet surface with white text (6.17:1 AA,
 * DESIGN_SYSTEM.md §1). Restrained: it is the only filled accent on the
 * page. Pending keeps the surface but dims the label — the button text
 * changing to "Signing in…" is the real state signal.
 */
.admin-signin__submit:hover {
  filter: brightness(0.92);
}

.admin-signin__submit:disabled {
  cursor: wait;
  opacity: 0.75;
}

.admin-signin__status {
  margin: 0;
  min-height: 1.25em;
  font-weight: 600;
  font-size: 0.9375rem;
}

.admin-signin__status--error {
  color: var(--color-danger);
}

.admin-signin__status--success {
  color: var(--color-success);
}
</style>
