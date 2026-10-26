<template>
  <!--
    T-031 — translation-coverage dashboard (`/:locale/admin/coverage`).

    Read-only by design and available to every admin-area session (root or any
    scope). RLS decides which rows that session may read; the page never
    writes, so it cannot become a privilege-escalation path
    (docs/architecture.md §6.1).

    Status is text in every cell — never colour alone and never an icon-only
    flag (docs/DESIGN_SYSTEM.md §6). Tables are the natural structure for a
    matrix and keep row/column relationships programmatic.
  -->
  <div class="admin-coverage">
    <h1 class="admin-coverage__heading">{{ t("admin.coverage.heading") }}</h1>
    <p class="admin-coverage__intro">{{ t("admin.coverage.intro") }}</p>

    <BkBanner
      v-if="loadError !== null"
      class="admin-coverage__banner"
      rounded
      role="alert"
      data-testid="coverage-error"
    >
      <p class="admin-coverage__banner-text">
        {{ t("admin.coverage.loadFailed") }}
      </p>
      <BkButton
        variant="flat"
        :label="t('admin.coverage.retry')"
        data-testid="coverage-retry"
        @click="load"
      />
    </BkBanner>

    <p v-if="loading" class="admin-coverage__state" role="status">
      {{ t("content.loading") }}
    </p>

    <template v-else-if="report !== null">
      <section aria-labelledby="coverage-summary-heading">
        <h2 id="coverage-summary-heading" class="admin-coverage__section-title">
          {{ t("admin.coverage.summaryHeading") }}
        </h2>
        <div class="admin-coverage__table-wrap">
          <table class="admin-coverage__table" data-testid="coverage-summary">
            <caption class="sr-only">
              {{ t("admin.coverage.summaryHeading") }}
            </caption>
            <thead>
              <tr>
                <th scope="col">{{ t("admin.coverage.columns.entity") }}</th>
                <th v-for="locale in locales" :key="locale" scope="col">
                  {{ tabLabel(locale) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entity in report.entities" :key="entity.entity">
                <th scope="row">{{ entityLabel(entity.entity) }}</th>
                <td
                  v-for="locale in locales"
                  :key="locale"
                  :data-testid="`coverage-summary-${entity.entity}-${locale}`"
                >
                  {{ countsLabel(entity.counts[locale]) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section
        v-for="entity in report.entities"
        :key="entity.entity"
        class="admin-coverage__entity"
        :aria-labelledby="`coverage-${entity.entity}-heading`"
      >
        <h2
          :id="`coverage-${entity.entity}-heading`"
          class="admin-coverage__section-title"
        >
          {{ entityLabel(entity.entity) }}
        </h2>

        <div class="admin-coverage__table-wrap">
          <table
            class="admin-coverage__table"
            :data-testid="`coverage-table-${entity.entity}`"
          >
            <caption class="sr-only">
              {{ entityLabel(entity.entity) }}
            </caption>
            <thead>
              <tr>
                <th scope="col">{{ t("admin.coverage.columns.content") }}</th>
                <th v-for="locale in locales" :key="locale" scope="col">
                  {{ tabLabel(locale) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="entity.items.length === 0">
                <td :colspan="locales.length + 1">
                  {{ t("admin.coverage.noPublishedContent") }}
                </td>
              </tr>
              <tr
                v-for="item in entity.items"
                :key="item.id"
                :data-testid="`coverage-row-${entity.entity}-${item.id}`"
              >
                <th scope="row">{{ item.label }}</th>
                <td
                  v-for="locale in locales"
                  :key="locale"
                  :data-testid="`coverage-state-${entity.entity}-${item.id}-${locale}`"
                >
                  {{ stateLabel(item.locales[locale]) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { SupabaseClient } from "@supabase/supabase-js";
import { computed, inject, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import { BkBanner, BkButton } from "@/components/bk";
import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import {
  fetchAdminCoverage,
  COVERAGE_LOCALES
} from "@/features/admin/coverage/api";
import type {
  CoverageCounts,
  CoverageEntityKey,
  CoverageReport,
  CoverageState
} from "@/features/admin/coverage/coverage";
import type { Locale } from "@/features/i18n/locales";
import type { Database } from "@/types/database.types";

/**
 * T-031 — coverage page. The calculation and row mapping live in
 * `features/admin/coverage`; this component only renders the report and its
 * explicit loading/error states.
 */
const props = defineProps<{
  supabase?: SupabaseClient<Database> | null;
}>();

const { t } = useI18n();
const injected = inject(SUPABASE_CLIENT_KEY, null);
const client = computed(() => props.supabase ?? injected);

const report = ref<CoverageReport | null>(null);
const loading = ref(true);
const loadError = ref<"unavailable" | "failed" | null>(null);

const locales = COVERAGE_LOCALES;

function entityLabel(entity: CoverageEntityKey): string {
  return t(`admin.coverage.entities.${entity}`);
}

function stateLabel(state: CoverageState): string {
  return t(`admin.coverage.states.${state}`);
}

function countsLabel(counts: CoverageCounts): string {
  return t("admin.coverage.counts", {
    published: counts.published,
    missing: counts.missing,
    needsReview: counts.needsReview
  });
}

/** Language names in the current UI language, like every other admin tab. */
function tabLabel(locale: Locale): string {
  return t(`admin.projects.tabs.${locale}`);
}

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;

  const result = await fetchAdminCoverage(client.value);

  if (result.ok) {
    report.value = result.report;
  } else {
    report.value = null;
    loadError.value = result.code;
  }

  loading.value = false;
}

onMounted(load);
</script>

<style scoped>
.admin-coverage__heading {
  margin: 0 0 0.5rem;
  font-size: var(--font-size-h2);
  font-weight: 700;
}

.admin-coverage__intro {
  margin: 0 0 1.5rem;
  max-width: 70ch;
  color: var(--color-text-muted);
  line-height: 1.6;
}

.admin-coverage__banner {
  margin-bottom: 1rem;
}

.admin-coverage__banner-text {
  margin: 0 0 0.5rem;
}

.admin-coverage__state {
  color: var(--color-text-muted);
}

.admin-coverage__entity {
  margin-top: 2rem;
}

.admin-coverage__section-title {
  margin: 0 0 0.75rem;
  font-size: 1.125rem;
  font-weight: 700;
}

/* Narrow screens scroll the matrix rather than shrinking text below 16 px. */
.admin-coverage__table-wrap {
  overflow-x: auto;
}

.admin-coverage__table {
  width: 100%;
  border-collapse: collapse;
  text-align: start;
}

.admin-coverage__table th,
.admin-coverage__table td {
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  vertical-align: top;
}

.admin-coverage__table thead th {
  font-weight: 700;
}

.admin-coverage__table tbody th {
  font-weight: 600;
}
</style>
