<template>
  <!--
    ReaderToc — T-039 PageToc reused, not forked (ticket contract): the nav
    landmark, scroll spy, aria-current="location", mobile <details>, nested
    hierarchy, deep-link focus and skeleton reserve all come from PageToc.

    This wrapper adds the reader-specific pieces (rev-1 B):
      * the hide/show toggle, whose STATE LIVES IN THE PARENT (LongFormReader)
        so hiding can collapse the grid column instead of leaving a 13rem gap;
      * `linkLang` forwarding so every anchor carries the content language.
  -->
  <div class="reader-toc" data-testid="reader-toc">
    <button
      type="button"
      class="reader-toc__toggle focus-ring"
      :aria-expanded="visible"
      :aria-controls="regionId"
      @click="emit('toggle')"
    >
      {{ visible ? t("reader.toc.hide") : t("reader.toc.show") }}
    </button>

    <div v-show="visible" :id="regionId">
      <PageToc
        :items="items"
        :ariaLabel="t('reader.toc.label')"
        :link-lang="linkLang"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useId } from "vue";
import { useI18n } from "vue-i18n";

import PageToc, { type TocItem } from "@/components/navigation/PageToc.vue";

/**
 * Controlled visibility: the parent owns the state because the GRID COLUMN
 * depends on it (B3), and owns the sticky positioning too (B2) — the grid
 * item is what must stick, not a wrapper inside it.
 */
defineProps<{
  items: readonly TocItem[];
  visible: boolean;
  /** BCP 47 tag for the anchors — the article's content language. */
  linkLang?: string | undefined;
}>();

const emit = defineEmits<{ toggle: [] }>();

const { t } = useI18n();
const regionId = useId();
</script>

<style scoped>
.reader-toc {
  min-width: 0;
}

.reader-toc__toggle {
  margin-block-end: 0.75rem;
  padding: 0.25rem 0.625rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: var(--font-size-small);
  font-weight: 600;
  cursor: pointer;
}

.reader-toc__toggle:hover {
  color: var(--color-link);
  border-color: var(--color-link);
}
</style>
