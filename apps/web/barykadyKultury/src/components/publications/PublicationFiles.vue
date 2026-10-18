<template>
  <div v-if="hasAction" class="publication-files">
    <ul v-if="downloadable.length > 0" class="publication-files__list">
      <li
        v-for="file in downloadable"
        :key="file.storagePath"
        class="publication-files__item"
      >
        <a :href="file.downloadUrl!" class="publication-files__link focus-ring">
          <span class="publication-files__language">
            {{ LOCALE_LABELS[file.locale] }}
          </span>
          <span class="publication-files__details">
            <span v-if="typeLabel(file)" class="publication-files__type">
              {{ typeLabel(file) }}
            </span>
            <span
              v-if="file.sizeBytes !== null"
              class="publication-files__size"
            >
              {{ formatFileSize(file.sizeBytes, activeLocale) }}
            </span>
          </span>
        </a>
        <p v-if="file.label" class="publication-files__label">{{
          file.label
        }}</p>
      </li>
    </ul>

    <a
      v-if="externalUrl"
      :href="externalUrl"
      class="publication-files__external-link focus-ring"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ t("publications.external") }}
      <span class="publication-files__new-tab-hint">{{
        t("content.opensInNewTab")
      }}</span>
    </a>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { formatFileSize } from "@/features/files/formatFileSize";
import { fileTypeLabel } from "@/features/files/fileTypeLabel";
import type { PublicationFileView } from "@/features/publications/usePublications";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_LABELS
} from "@/features/i18n/locales";

/**
 * The download/open action list for one publication (T-020).
 *
 * Presentational: the feature layer resolved every `downloadUrl` (with the
 * `?download=` attachment policy), so this component renders plain data and
 * builds no URLs. Each language version is a distinct labelled link —
 * language, type and size are text, never color- or icon-only
 * (docs/DESIGN_SYSTEM.md §6). When a publication has neither files nor an
 * external URL the component renders nothing: no broken or decorative
 * action (acceptance criterion). The external link opens with
 * `rel="noopener noreferrer"` and an SR-only new-tab announcement.
 */
const props = defineProps<{
  files: readonly PublicationFileView[];
  externalUrl: string | null;
}>();

const { t, locale } = useI18n();

const activeLocale = computed(() =>
  isLocale(locale.value) ? locale.value : DEFAULT_LOCALE
);

/** Files without a resolvable URL (unconfigured build) are omitted, not broken. */
const downloadable = computed(() =>
  props.files.filter(file => file.downloadUrl !== null)
);

const hasAction = computed(
  () => downloadable.value.length > 0 || props.externalUrl !== null
);

function typeLabel(file: PublicationFileView): string | null {
  return fileTypeLabel(file.mimeType);
}
</script>

<style scoped>
.publication-files__list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.publication-files__item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.publication-files__link,
.publication-files__external-link {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 2.75rem;
  padding: 0.375rem 0.875rem;
  border: 1px solid var(--color-link);
  border-radius: 0.375rem;
  color: var(--color-link);
  font-weight: 600;
  text-decoration: none;
  transition:
    background-color var(--motion-duration),
    border-color var(--motion-duration);
}

.publication-files__link:hover,
.publication-files__external-link:hover {
  text-decoration: underline;
}

.publication-files__language {
  font-weight: 600;
}

.publication-files__details {
  display: inline-flex;
  gap: 0.5rem;
  color: var(--color-text-muted);
  font-weight: 400;
  font-size: var(--font-size-small);
}

.publication-files__label {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.publication-files__new-tab-hint {
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
