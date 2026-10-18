<template>
  <div class="support-page">
    <h1 class="support-page__title">{{ t("support.title") }}</h1>

    <!--
      D-06 OPEN: the shipped config is empty, so this is the truthful empty
      state — no invented account numbers, links or addresses. Once verified
      destinations land in `src/config/support.ts`, the first resolved option
      renders as the primary action and the rest as secondary actions.

      The ticket's "what your support does" slot is deliberately omitted:
      there is no content source for it (`site_pages` seeds only `about`) and
      claiming impact without NGO-approved copy would fabricate data
      (AGENTS.md rule 6). Wire it when a content source exists (T-022 Log).
    -->
    <p v-if="actions.length > 0" class="support-page__intro">
      {{ t("support.intro") }}
    </p>
    <p v-else class="support-page__empty">{{ t("support.empty") }}</p>

    <section
      v-for="(action, index) in actions"
      :key="action.kind"
      class="support-option"
    >
      <ActionLink
        v-if="action.kind === 'donation'"
        :href="action.url"
        :label="action.label || t('support.actions.donation')"
        :variant="index === 0 ? 'primary' : 'secondary'"
        new-tab
      />

      <div v-else-if="action.kind === 'bank'" class="support-bank">
        <h2 class="support-bank__heading">{{ t("support.bank.heading") }}</h2>
        <dl class="support-bank__list">
          <dt class="support-bank__term">
            {{ t("support.bank.accountNumber") }}
          </dt>
          <dd class="support-bank__value support-bank__account">
            {{ action.accountNumber }}
          </dd>

          <template v-if="action.recipient">
            <dt class="support-bank__term">{{
              t("support.bank.recipient")
            }}</dt>
            <dd class="support-bank__value">{{ action.recipient }}</dd>
          </template>

          <!-- Optional fields collapse; no placeholder rows (PRD §5). -->
          <template v-if="action.paymentTitle">
            <dt class="support-bank__term">{{
              t("support.bank.paymentTitle")
            }}</dt>
            <dd class="support-bank__value">{{ action.paymentTitle }}</dd>
          </template>
        </dl>
      </div>

      <ActionLink
        v-else-if="action.kind === 'volunteering'"
        :href="mailtoHref(action.email)"
        :label="t('support.actions.volunteering')"
        :variant="index === 0 ? 'primary' : 'secondary'"
      />
    </section>

    <!--
      Truthful, always-present boundary statement: this route contains no
      form, no iframe and no payment SDK (acceptance criterion, tested).
    -->
    <p class="support-page__no-payment">{{ t("support.noPayment") }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import ActionLink from "@/components/support/ActionLink.vue";
import { supportOptions, type SupportOptions } from "@/config/support";
import { resolveSupportActions } from "@/features/support/resolveSupportActions";
import { mailtoHref } from "@/shared/links";

/**
 * Support us page (T-022).
 *
 * Renders only configured, approved options (D-06): the first resolved
 * option is the primary action, the rest secondary; bank details are
 * selectable labelled text; the donation link opens safely. No payment data
 * is ever collected here (docs/PRODUCT_REQUIREMENTS.md §4, §7).
 *
 * `options` is a plain prop defaulting to the shipped config so the
 * configured matrix is testable at component level — there is deliberately
 * no runtime test seam (the T-021 review rule). PublicLayout provides the
 * shell — do NOT add AppShell here.
 */
const props = defineProps<{ options?: SupportOptions }>();

const { t } = useI18n();

const actions = computed(() =>
  resolveSupportActions(props.options ?? supportOptions)
);
</script>

<style scoped>
.support-page {
  max-width: 65ch;
}

.support-page__title {
  margin: 0 0 1.5rem;
}

.support-page__intro,
.support-page__empty {
  margin: 0 0 1.5rem;
}

.support-page__empty {
  color: var(--color-text-muted);
}

.support-option {
  margin: 0 0 1.5rem;
}

.support-bank__heading {
  margin: 0 0 0.75rem;
  font-size: var(--font-size-h3);
}

.support-bank__list {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.5rem 1.5rem;
  margin: 0;
}

.support-bank__term {
  color: var(--color-text-muted);
  font-weight: 600;
}

.support-bank__value {
  margin: 0;
}

/* The account number is the value people most often copy: whole-press
   selection without a clipboard action (no copy button ships today). */
.support-bank__account {
  user-select: all;
}

.support-page__no-payment {
  margin: 2rem 0 0;
  padding: 0.75rem 1rem;
  border-inline-start: 3px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}
</style>
