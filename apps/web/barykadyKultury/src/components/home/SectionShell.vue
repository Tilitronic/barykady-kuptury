<template>
  <section class="section-shell" :id="id" :aria-labelledby="headingId">
    <header class="section-shell__head">
      <h2 :id="headingId" class="section-shell__title">{{ title }}</h2>
      <RouterLink
        v-if="viewAllTo && viewAllLabel"
        :to="viewAllTo"
        class="section-shell__view-all focus-ring"
      >
        {{ viewAllLabel }}
      </RouterLink>
    </header>

    <p v-if="intro" class="section-shell__intro">{{ intro }}</p>

    <div class="section-shell__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { useId } from "vue";
import { RouterLink } from "vue-router";

/**
 * Shared homepage section frame (T-025 REFACTOR step).
 *
 * One contract for every composed section: an h2 heading wired to the
 * `<section>` via `aria-labelledby`, an optional intro line, an optional
 * "view all" route, and consistent vertical rhythm. The page keeps all
 * state logic; this component only shapes markup, so the heading hierarchy
 * and spacing cannot drift between sections (docs/DESIGN_SYSTEM.md §3).
 */
defineProps<{
  title: string;
  /**
   * T-039 review (C1): stable section anchor (`mission`, `upcoming`,
   * `featured`, `explore`) so header-search navigation results and shared
   * hashes land on the homepage section instead of the page top.
   */
  id?: string;
  intro?: string | null;
  viewAllTo?: string | null;
  viewAllLabel?: string | null;
}>();

const headingId = useId();
</script>

<style scoped>
.section-shell {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-block: 2rem;
}

.section-shell__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}

.section-shell__title {
  margin: 0;
  font-size: var(--font-size-h2);
  overflow-wrap: break-word;
}

.section-shell__view-all {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  padding: 0.25rem 0.5rem;
  color: var(--color-link);
  font-weight: 600;
  text-decoration: underline;
  overflow-wrap: break-word;
}

.section-shell__view-all:hover {
  text-decoration: none;
}

.section-shell__intro {
  max-width: 65ch;
  margin: 0;
  color: var(--color-text-muted);
}

.section-shell__body {
  min-width: 0;
}
</style>
