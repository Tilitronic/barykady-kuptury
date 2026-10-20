<template>
  <!--
    LongFormReader — the one long-form surface for documents and publications
    (T-040, D-27/D-32/D-34/D-36/D-38).

    Layout: [TOC | article | controls] on wide viewports; a single column
    below 1024 px where the TOC collapses to its PageToc <details> and the
    controls stack after the article — 320 px safe, no horizontal scroll
    (DESIGN_SYSTEM.md §6).

    Language contract (D-27): the selector lists ONLY locales with readable
    content, sets `?lang=` through the parent, and changes nothing about the
    route locale or the UI chrome. The `article lang` is the content locale.

    Legacy contract (D-38): rows without a supported AST but with plain-text
    `body` render through the existing restricted rich-text parser — safe but
    unstructured, hence deliberately NO TOC for legacy text (there are no
    AST heading nodes to anchor). `unsupported` is an explicit state, never
    a blank shell.
  -->
  <div class="long-form-reader">
    <!-- The title/description are content too: they carry the CONTENT lang
         (rev-1 F), as do the TOC links via `link-lang`. -->
    <h1 class="long-form-reader__title" :lang="contentLocale">{{ title }}</h1>
    <p
      v-if="description"
      class="long-form-reader__description"
      :lang="contentLocale"
    >
      {{ description }}
    </p>

    <p v-if="isFallback" class="long-form-reader__fallback" role="note">
      {{
        t("content.fallbackNote", {
          language: t(`content.fallbackLanguageNames.${contentLocale}`)
        })
      }}
    </p>

    <div
      v-if="availableLocales.length > 1"
      class="long-form-reader__languages"
      role="group"
      aria-labelledby="reader-language-label"
      data-testid="reader-language"
    >
      <!-- A VISIBLE label (rev-1 C): an unlabeled chip row is discoverable
           only to sighted users who guess its purpose. -->
      <span
        id="reader-language-label"
        class="long-form-reader__languages-label"
        >{{ t("reader.language.label") }}</span
      >
      <button
        v-for="locale in availableLocales"
        :key="locale"
        type="button"
        class="long-form-reader__language focus-ring"
        :lang="locale"
        :aria-current="locale === contentLocale ? 'true' : undefined"
        @click="emit('change-locale', locale)"
      >
        {{ LOCALE_LABELS[locale] }}
      </button>
    </div>

    <div
      class="long-form-reader__layout"
      :class="{ 'long-form-reader__layout--toc-collapsed': !tocVisible }"
    >
      <ReaderToc
        v-if="tocItems.length > 0"
        :items="tocItems"
        :visible="tocVisible"
        :link-lang="contentLocale"
        @toggle="tocVisible = !tocVisible"
      />

      <article
        class="long-form-reader__article"
        :lang="contentLocale"
        :style="articleStyle"
      >
        <!-- States first: the shell is never blanked by a failing load. -->
        <p
          v-if="status === 'loading'"
          class="long-form-reader__state"
          role="status"
        >
          {{ t("content.loading") }}
        </p>
        <template v-else-if="status === 'unavailable'">
          <p class="long-form-reader__state">{{ t("content.unavailable") }}</p>
          <button
            type="button"
            class="long-form-reader__retry focus-ring"
            :aria-label="t('reader.retry')"
            @click="emit('retry')"
          >
            {{ t("reader.retry") }}
          </button>
        </template>
        <p v-else-if="status === 'empty'" class="long-form-reader__state">
          {{ t("reader.states.empty") }}
        </p>
        <p v-else-if="status === 'unsupported'" class="long-form-reader__state">
          {{ t("reader.states.unsupported") }}
          <!-- The download sentence only when the page actually offers a
             download (rev-1 F) — never promise what the view lacks. -->
          <template v-if="offersDownload">
            {{ t("reader.states.unsupportedDownload") }}
          </template>
        </p>

        <template v-else-if="bodyAst">
          <AstBody
            :document="bodyAst"
            :assets="assets"
            :supabase="supabase"
            :new-tab-label="t('content.opensInNewTab')"
            :label-lang="uiLocale"
          />
        </template>
        <template v-else-if="body">
          <LocalizedRichText
            :content="body"
            :lang="contentLocale"
            :new-tab-label="t('content.opensInNewTab')"
            :label-lang="uiLocale"
          />
        </template>

        <!-- Page-owned extras (publication files/meta) below the body. -->
        <slot />
      </article>

      <aside v-if="status === 'ready'" class="long-form-reader__controls">
        <ReaderControls
          :settings="settings"
          @update="applyLiveSettings"
          @commit="commitSettings"
          @reset="resetSettings"
        />
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import LocalizedRichText from "@/components/content/LocalizedRichText.vue";
import ReaderToc from "./ReaderToc.vue";
import ReaderControls from "./ReaderControls.vue";
import AstBody from "./AstBody.vue";
import { astHeadingItems } from "./astRenderer";
import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import { LOCALE_LABELS, type Locale } from "@/features/i18n/locales";
import type {
  ReaderAsset,
  ReaderDocumentStatus,
  ReaderDocumentV1
} from "@/features/reader/types";

import {
  LINE_SPACING_STEPS,
  MEASURE_WIDTHS,
  PARAGRAPH_SPACING_STEPS,
  DEFAULT_READER_SETTINGS,
  loadReaderSettings,
  removeReaderSettings,
  saveReaderSettings,
  TEXT_SIZE_STEPS,
  type ReaderSettings
} from "./readerSettings";

/**
 * The component is presentation + preferences; the page owns data fetching
 * (`useReaderDocument`) and URL writes (`?lang=` push), keeping this
 * component testable with plain props.
 */
const props = defineProps<{
  title: string;
  description?: string | null;
  bodyAst: ReaderDocumentV1 | null;
  body: string | null;
  contentLocale: Locale;
  uiLocale: Locale;
  availableLocales: readonly Locale[];
  assets?: readonly ReaderAsset[];
  status: ReaderDocumentStatus;
  /** localStorage key (per reader, D-34) — built via `readerSettingsKey`. */
  storageKey: string;
  /** Page-computed: resolved translation is a fallback, not a choice. */
  isFallback?: boolean;
  /** Whether the page renders a download affordance (unsupported copy split). */
  offersDownload?: boolean;
}>();

const emit = defineEmits<{
  "change-locale": [locale: Locale];
  retry: [];
}>();

const { t } = useI18n();
const supabase = inject(SUPABASE_CLIENT_KEY, null);

const settings = ref<ReaderSettings>(loadReaderSettings(props.storageKey));

/** TOC visibility lives here: the GRID COLUMN depends on it (rev-1 B3). */
const tocVisible = ref(true);

watch(
  () => props.storageKey,
  key => {
    settings.value = loadReaderSettings(key);
  }
);

/** Drag frames apply live but must not hammer localStorage (rev-1 F). */
function applyLiveSettings(next: ReaderSettings): void {
  settings.value = next;
}

/** Release/commit points persist. */
function commitSettings(next: ReaderSettings): void {
  settings.value = next;
  saveReaderSettings(props.storageKey, next);
}

function resetSettings(): void {
  settings.value = { ...DEFAULT_READER_SETTINGS };
  removeReaderSettings(props.storageKey);
}

/**
 * TOC from AST headings only. Legacy plain text is documented as TOC-less:
 * the restricted Markdown parser output has no stable anchor contract.
 */
const tocItems = computed(() =>
  astHeadingItems(props.bodyAst).map(heading => ({
    id: heading.id,
    label: heading.label,
    level: heading.level
  }))
);

/** Reading preferences as CSS custom properties on the article only. */
const articleStyle = computed(() => ({
  "--lfr-font-size": `${String(TEXT_SIZE_STEPS[settings.value.textSize])}rem`,
  "--lfr-measure": MEASURE_WIDTHS[settings.value.measure],
  "--lfr-line-height": String(LINE_SPACING_STEPS[settings.value.lineSpacing]),
  "--lfr-para-space": `${String(PARAGRAPH_SPACING_STEPS[settings.value.paragraphSpacing])}rem`
}));
</script>

<style scoped>
.long-form-reader__title {
  max-width: 65ch;
  margin: 0 0 0.5rem;
  font-size: var(--font-size-h1);
}

.long-form-reader__description {
  max-width: 65ch;
  margin: 0 0 1rem;
  color: var(--color-text-muted);
}

.long-form-reader__fallback {
  max-width: 65ch;
  margin: 0 0 1.5rem;
  padding: 0.75rem 1rem;
  border-inline-start: 3px solid var(--color-accent);
  background-color: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

/* ── Content-language selector (D-27) ─────────────────────────────────────── */

.long-form-reader__languages {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-block-end: 1.5rem;
}

.long-form-reader__languages-label {
  margin-inline-end: 0.25rem;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  font-weight: 700;
}

.long-form-reader__language {
  min-height: 2.75rem;
  padding: 0.375rem 0.875rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: var(--font-size-small);
  cursor: pointer;
}

.long-form-reader__language:hover {
  color: var(--color-link);
  border-color: var(--color-link);
}

/* aria-current + bold border + weight — never color alone (§6). */
.long-form-reader__language[aria-current="true"] {
  border: 2px solid var(--color-accent);
  color: var(--color-text);
  font-weight: 600;
}

/* ── Three-column reading layout (grid AREAS, rev-1 D) ──────────────────────

   DOM order is toc → article → controls (screen readers get the text first);
   at < 1024 px the AREAS put the controls visually ABOVE the article so a
   phone reader can set type before reading — without reordering the DOM. */

.long-form-reader__layout {
  display: grid;
  gap: 2rem;
  align-items: start;
  grid-template-columns: 1fr;
  grid-template-areas:
    "toc"
    "controls"
    "article";
}

.long-form-reader__layout > .reader-toc {
  grid-area: toc;
}

.long-form-reader__article {
  grid-area: article;
}

.long-form-reader__controls {
  grid-area: controls;
}

@media (min-width: 1024px) {
  .long-form-reader__layout {
    grid-template-columns: 12rem minmax(0, 1fr);
    grid-template-areas:
      "toc article"
      "toc controls";
  }

  /*
   * B2: the GRID ITEM sticks — PageToc's own sticky cannot travel inside a
   * content-height wrapper, so the wrapper takes over and the inner nav is
   * neutralized. max-height + overflow keeps a long TOC scrollable.
   */
  .long-form-reader__layout > .reader-toc {
    position: sticky;
    top: 5rem;
    max-height: calc(100dvh - 6rem);
    overflow-y: auto;
    align-self: start;
  }

  .long-form-reader__layout :deep(.page-toc) {
    position: static;
    max-height: none;
    overflow: visible;
  }
}

@media (min-width: 1280px) {
  .long-form-reader__layout {
    grid-template-columns: 13rem minmax(0, 1fr) 15rem;
    grid-template-areas: "toc article controls";
  }

  /* B3: hiding collapses the column to the toggle's own width — no 13rem gap. */
  .long-form-reader__layout--toc-collapsed {
    grid-template-columns: min-content minmax(0, 1fr) 15rem;
  }
}

@media (min-width: 1024px) and (max-width: 1279px) {
  .long-form-reader__layout--toc-collapsed {
    grid-template-columns: min-content minmax(0, 1fr);
  }
}

.long-form-reader__article {
  min-width: 0;
  /* The committed preferences land here as custom properties. */
  font-size: var(--lfr-font-size, var(--font-size-body));
  line-height: var(--lfr-line-height, 1.5);
  max-width: var(--lfr-measure, 65ch);
}

.long-form-reader__article :deep(p),
.long-form-reader__article :deep(ul),
.long-form-reader__article :deep(ol),
.long-form-reader__article :deep(blockquote),
.long-form-reader__article :deep(pre),
.long-form-reader__article :deep(table),
.long-form-reader__article :deep(figure) {
  margin-block: 0 var(--lfr-para-space, 1rem);
}

.long-form-reader__article :deep(h2),
.long-form-reader__article :deep(h3),
.long-form-reader__article :deep(h4) {
  margin-block: 2rem 0.75rem;
  scroll-margin-top: 5rem;
}

.long-form-reader__article :deep(blockquote) {
  margin-inline: 0;
  padding-inline-start: 1rem;
  border-inline-start: 3px solid var(--color-border);
  color: var(--color-text-muted);
}

.long-form-reader__article :deep(table) {
  border-collapse: collapse;
  width: 100%;
  font-size: inherit;
}

.long-form-reader__article :deep(caption) {
  padding-block-end: 0.5rem;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  text-align: start;
}

.long-form-reader__article :deep(th),
.long-form-reader__article :deep(td) {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  text-align: start;
  vertical-align: top;
}

.long-form-reader__article :deep(thead th) {
  background: var(--color-surface);
}

.long-form-reader__article :deep(figure) {
  margin: 0 0 var(--lfr-para-space, 1rem);
}

.long-form-reader__article :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.25rem;
}

.long-form-reader__article :deep(figcaption) {
  margin-block-start: 0.5rem;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.long-form-reader__article :deep(pre) {
  padding: 1rem;
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: var(--color-surface);
}

.long-form-reader__article :deep(.reader-footnote) {
  padding-block-start: 0.5rem;
  margin-block-end: var(--lfr-para-space, 1rem);
  border-block-start: 1px dashed var(--color-border);
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.long-form-reader__state {
  color: var(--color-text-muted);
}

.long-form-reader__retry {
  min-height: 2.75rem;
  padding: 0.375rem 1rem;
  border: 1px solid var(--color-link);
  border-radius: 0.375rem;
  background: transparent;
  color: var(--color-link);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.long-form-reader__controls {
  min-width: 0;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: var(--color-surface);
}

@media (max-width: 1023px) {
  .long-form-reader__controls {
    margin-block-start: 0.5rem;
  }
}

/* Print: the reader's chrome disappears, the text prints at measure. */
@media print {
  .reader-toc,
  .long-form-reader__controls,
  .long-form-reader__languages {
    display: none;
  }

  .long-form-reader__article {
    max-width: none;
  }
}
</style>
