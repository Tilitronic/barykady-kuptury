<template>
  <li class="publication-card">
    <component :is="`h${headingLevel}`" class="publication-card__title">
      <RouterLink :to="href" class="publication-card__link focus-ring">
        {{ publication.title }}
      </RouterLink>
    </component>

    <p v-if="publication.abstract" class="publication-card__abstract">
      {{ publication.abstract }}
    </p>

    <p v-if="publication.authors" class="publication-card__authors">
      {{ publication.authors }}
    </p>

    <p class="publication-card__meta">
      <span v-if="publication.language" class="publication-card__language">
        {{ LOCALE_LABELS[publication.language] }}
      </span>
      <span v-if="publication.publicationDate" class="publication-card__date">
        <time :datetime="publication.publicationDate">
          {{ formattedDate }}
        </time>
      </span>
      <span v-if="availability" class="publication-card__availability">
        {{ availability }}
      </span>
    </p>

    <p
      v-if="publication.isFallback"
      class="publication-card__fallback"
      role="note"
    >
      {{
        t("content.fallbackNote", { language: t("content.fallbackLanguage") })
      }}
    </p>
  </li>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";

import type { PublicationView } from "@/features/publications/usePublications";
import { formatDate } from "@/features/i18n/format";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_LABELS
} from "@/features/i18n/locales";

/**
 * One published-publication card (T-020).
 *
 * Presentational: the feature layer resolves the file download URLs and the
 * page computes the detail href (strict (locale, slug) linking). Missing
 * optional metadata renders nothing — never an invented placeholder
 * (docs/PRODUCT_REQUIREMENTS.md §4, §5). The language badge and the
 * availability indicator are text, not color-only signals
 * (docs/DESIGN_SYSTEM.md §6).
 */
const props = withDefaults(
  defineProps<{
    publication: PublicationView;
    href: string;
    /**
     * T-039: card title outline level — the year-sectioned listing passes 3
     * under its section h2; the default keeps the standalone h2 outline.
     */
    headingLevel?: 2 | 3;
  }>(),
  { headingLevel: 2 }
);

const { t, locale } = useI18n();

const activeLocale = computed(() =>
  isLocale(locale.value) ? locale.value : DEFAULT_LOCALE
);

const formattedDate = computed(() => {
  if (!props.publication.publicationDate) return "";
  // Date-only values are formatted in UTC so the day never shifts by timezone.
  return formatDate(
    new Date(props.publication.publicationDate),
    activeLocale.value,
    {
      dateStyle: "medium",
      timeZone: "UTC"
    }
  );
});

/**
 * Availability indicator: files win over the external URL because a stored
 * copy is the primary access path; a publication with neither shows no
 * indicator — there is no action to promise (T-020 acceptance criterion).
 */
const availability = computed(() => {
  if (props.publication.files.length > 0) {
    return t("publications.availability.download");
  }
  if (props.publication.externalUrl) {
    return t("publications.availability.online");
  }
  return null;
});
</script>

<style scoped>
.publication-card {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.publication-card__title {
  margin: 0;
  font-size: var(--font-size-h3);
}

.publication-card__link {
  color: var(--color-link);
  text-decoration: underline;
  overflow-wrap: break-word;
}

.publication-card__link:hover {
  text-decoration: none;
}

.publication-card__abstract {
  margin: 0;
  overflow-wrap: break-word;
}

.publication-card__authors {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.publication-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.publication-card__language {
  padding: 0.125rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  font-weight: 600;
}

.publication-card__availability {
  color: var(--color-accent);
  font-weight: 600;
}

.publication-card__fallback {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  font-style: italic;
}
</style>
