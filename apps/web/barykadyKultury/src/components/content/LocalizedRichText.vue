<script lang="ts">
import { defineComponent, h } from "vue";

import { renderRichText } from "@/shared/content/richText";

/**
 * Safe rich-text renderer for organization content.
 *
 * Consumes the restricted Markdown subset stored in the database and renders it
 * to Vue VNodes. No `v-html`, no raw HTML rendering, and no sanitizer
 * dependency: the parser only recognizes the documented subset and treats
 * everything else (including `<script>` and `javascript:` links) as inert text.
 */
export default defineComponent({
  name: "LocalizedRichText",
  props: {
    content: {
      type: String,
      default: ""
    },
    lang: {
      type: String,
      default: undefined
    },
    newTabLabel: {
      type: String,
      default: undefined
    },
    labelLang: {
      type: String,
      default: undefined
    },
    /**
     * M1 (T-025): rendered heading levels shift by this offset (0 keeps the
     * authored outline, 1 renders "## " as h3). Only the tag changes — the
     * restricted-subset parser and its sanitization guarantees are shared
     * and untouched.
     */
    headingOffset: {
      type: Number,
      default: 0
    }
  },
  setup(props) {
    return () =>
      h(
        "div",
        { class: "localized-rich-text", lang: props.lang },
        renderRichText(props.content, {
          newTabLabel: props.newTabLabel,
          labelLang: props.labelLang,
          headingOffset: props.headingOffset
        })
      );
  }
});
</script>

<style scoped>
.localized-rich-text {
  max-width: 65ch;
  overflow-wrap: break-word;
}

.localized-rich-text :deep(h2),
.localized-rich-text :deep(h3),
.localized-rich-text :deep(h4) {
  margin-block-start: 2rem;
  margin-block-end: 0.75rem;
  color: var(--color-text);
}

.localized-rich-text :deep(h2) {
  font-size: var(--font-size-h2);
}

.localized-rich-text :deep(h3) {
  font-size: var(--font-size-h3);
}

/* Offset rendering (M1) can produce h4 from an authored "### ". */
.localized-rich-text :deep(h4) {
  font-size: var(--font-size-h4, var(--font-size-h3));
}

.localized-rich-text :deep(p),
.localized-rich-text :deep(ul) {
  margin-block: 0 1rem;
}

.localized-rich-text :deep(ul) {
  padding-inline-start: 1.25rem;
}

.localized-rich-text :deep(li) {
  margin-block-end: 0.375rem;
}

.localized-rich-text :deep(a) {
  color: var(--color-link);
  text-decoration: underline;
}

.localized-rich-text :deep(a:hover) {
  text-decoration: none;
}

.localized-rich-text :deep(a:focus-visible) {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

/* Screen-reader-only suffix for external links rendered by richText.ts. */
.localized-rich-text :deep(.visually-hidden) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
