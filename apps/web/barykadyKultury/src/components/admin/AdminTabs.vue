<template>
  <!--
    T-048 — generic keyboard-operable tab strip.

    This is the AdminLocaleTabs interaction contract (roving tabindex,
    ArrowLeft/ArrowRight/Home/End, focus follows selection) applied to any tab
    set. AdminLocaleTabs stays the per-locale completeness strip; this
    component is the settings-surface chrome, so neither special case has to
    grow flags for the other.
  -->
  <div
    :id="`${idPrefix}-tablist`"
    class="admin-tabs"
    role="tablist"
    :aria-label="label"
    @keydown="onKeydown"
  >
    <button
      v-for="tab in tabs"
      :id="`${idPrefix}-tab-${tab.id}`"
      :key="tab.id"
      type="button"
      role="tab"
      class="admin-tabs__tab focus-ring"
      :class="{ 'admin-tabs__tab--active': active === tab.id }"
      :aria-selected="active === tab.id"
      :aria-controls="`${idPrefix}-panel-${tab.id}`"
      :tabindex="active === tab.id ? 0 : -1"
      :data-testid="tab.testId"
      @click="select(tab.id)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { nextTick } from "vue";

/**
 * T-048 — presentational tab strip. The parent owns tab state (and the route
 * query), this component owns only keyboard interaction, matching
 * AdminLocaleTabs so the two surfaces cannot drift in a11y behaviour.
 */
export interface AdminTab {
  readonly id: string;
  readonly label: string;
  readonly testId: string;
}

const props = defineProps<{
  readonly tabs: readonly AdminTab[];
  readonly active: string;
  readonly label: string;
  readonly idPrefix: string;
}>();

const emit = defineEmits<{
  "update:active": [id: string];
}>();

function select(id: string): void {
  if (id !== props.active) emit("update:active", id);
}

function focusTab(id: string): void {
  void nextTick(() => {
    document.getElementById(`${props.idPrefix}-tab-${id}`)?.focus();
  });
}

function onKeydown(event: KeyboardEvent): void {
  const keys = ["ArrowLeft", "ArrowRight", "Home", "End"] as const;
  if (!keys.includes(event.key as (typeof keys)[number])) return;

  const current = props.tabs.findIndex(tab => tab.id === props.active);
  if (current === -1) return;

  let next = current;
  if (event.key === "ArrowLeft") {
    next = (current - 1 + props.tabs.length) % props.tabs.length;
  } else if (event.key === "ArrowRight") {
    next = (current + 1) % props.tabs.length;
  } else if (event.key === "Home") {
    next = 0;
  } else if (event.key === "End") {
    next = props.tabs.length - 1;
  }

  const tab = props.tabs[next];
  if (tab === undefined) return;

  event.preventDefault();
  emit("update:active", tab.id);
  focusTab(tab.id);
}
</script>

<style scoped>
.admin-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 1.5rem;
}

.admin-tabs__tab {
  padding: 0.5rem 0.875rem;
  border: none;
  border-bottom: 3px solid transparent;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

/* Active tab: a thick underline in addition to the label — never color alone. */
.admin-tabs__tab--active {
  border-bottom-color: var(--color-accent);
}
</style>
