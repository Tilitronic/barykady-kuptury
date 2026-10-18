<template>
  <!--
    Renders only the configured contact channels (T-021). Each field is
    optional: an empty string means "not configured" and its term/description
    pair is omitted entirely — never a placeholder. The whole block renders
    nothing when every channel is empty, so the page can own the empty state.
  -->
  <address v-if="hasAnyChannel" class="contact-channels">
    <dl class="contact-channels__list">
      <template v-if="details.email">
        <dt class="contact-channels__label">{{ t("contact.fields.email") }}</dt>
        <dd class="contact-channels__value">
          <a
            :href="mailtoHref(details.email, t('contact.emailSubject'))"
            class="contact-channels__link focus-ring"
          >
            {{ details.email }}
          </a>
        </dd>
      </template>

      <template v-if="details.phone">
        <dt class="contact-channels__label">{{ t("contact.fields.phone") }}</dt>
        <dd class="contact-channels__value">
          <a
            :href="telHref(details.phone)"
            class="contact-channels__link focus-ring"
          >
            {{ details.phone }}
          </a>
        </dd>
      </template>

      <template v-if="details.address">
        <dt class="contact-channels__label">{{
          t("contact.fields.address")
        }}</dt>
        <dd class="contact-channels__value contact-channels__value--multiline">
          {{ details.address }}
        </dd>
      </template>

      <template v-if="details.officeHours">
        <dt class="contact-channels__label">
          {{ t("contact.fields.officeHours") }}
        </dt>
        <dd class="contact-channels__value contact-channels__value--multiline">
          {{ details.officeHours }}
        </dd>
      </template>
    </dl>
  </address>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import type { ContactDetails } from "@/config/organization";
import { hasContactDetails } from "@/features/contact/contactDetails";
import { mailtoHref, telHref } from "@/shared/links";

/**
 * Presentational contact block (T-021).
 *
 * Receives already-resolved details so the page decides where they come from;
 * this component only decides how verified values are presented. Uses an
 * `<address>` landmark wrapping a definition list — the accessible structure
 * DESIGN_SYSTEM.md §6 asks for — with the field labels localized per render.
 */
const props = defineProps<{
  details: ContactDetails;
}>();

const { t } = useI18n();

const hasAnyChannel = computed(() => hasContactDetails(props.details));
</script>

<style scoped>
.contact-channels {
  max-width: 65ch;
  font-style: normal;
}

.contact-channels__list {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.5rem 1.5rem;
  margin: 0;
}

.contact-channels__label {
  margin: 0;
  font-weight: 600;
  color: var(--color-text-muted);
}

.contact-channels__value {
  margin: 0;
}

/* Authored addresses/office hours may contain line breaks; preserve them. */
.contact-channels__value--multiline {
  white-space: pre-line;
}

.contact-channels__link {
  color: var(--color-link);
  text-decoration: underline;
}

.contact-channels__link:hover {
  text-decoration: none;
}
</style>
