<template>
  <!--
    Shared localized body for an editable site page (T-028).

    Extracted from the About landing page so the admin preview and the public
    page render the SAME sanitized Markdown path and the same fallback note
    (the T-018/T-027 "preview renders the public component" rule). The page
    owns the title and its layout; this component owns only the body.

    Parsing uses the restricted shared parser via `splitRichTextSections`, so
    authored HTML is never rendered as active content
    (docs/architecture.md §6; AGENTS.md coding conventions).
  -->
  <p v-if="isFallback" class="site-page-body__fallback" role="note">
    {{
      t("content.fallbackNote", {
        language: t("content.fallbackLanguage")
      })
    }}
  </p>

  <LocalizedRichText
    v-if="intro.length > 0"
    :blocks="intro"
    :lang="bodyLang"
    :new-tab-label="t('content.opensInNewTab')"
    :label-lang="locale"
  />

  <section
    v-for="section in sections"
    :id="section.id"
    :key="section.id"
    class="site-page-body__section"
  >
    <h2 class="site-page-body__section-title" tabindex="-1">
      {{ section.title }}
    </h2>
    <LocalizedRichText
      :blocks="section.blocks"
      :lang="bodyLang"
      :new-tab-label="t('content.opensInNewTab')"
      :label-lang="locale"
    />
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import LocalizedRichText from "@/components/content/LocalizedRichText.vue";
import type { Locale } from "@/features/i18n/locales";
import { splitRichTextSections } from "@/shared/content/sections";

const props = defineProps<{
  readonly body: string;
  readonly locale: Locale;
  readonly isFallback: boolean;
}>();

const { t } = useI18n();

/**
 * The body's language. A fallback body is English text; labelling it with the
 * requested locale would be wrong for assistive technology.
 */
const bodyLang = computed(() => (props.isFallback ? "en" : props.locale));

/** Parsed once per body change; ids are the shared positional contract. */
const parsed = computed(() => splitRichTextSections(props.body));
const intro = computed(() => parsed.value.intro);
const sections = computed(() => parsed.value.sections);
</script>

<style scoped>
.site-page-body__fallback {
  max-width: 65ch;
  margin: 0 0 1.5rem;
  padding: 0.75rem 1rem;
  border-inline-start: 3px solid var(--color-accent);
  background-color: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.site-page-body__section {
  margin-block-end: 3rem;
  scroll-margin-top: 5rem;
}

.site-page-body__section-title {
  margin: 0 0 0.75rem;
  font-size: var(--font-size-h2);
}
</style>
