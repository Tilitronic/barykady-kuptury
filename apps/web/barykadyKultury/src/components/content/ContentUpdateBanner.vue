<template>
  <div v-if="visible" class="content-update" role="status" aria-live="polite">
    <span class="content-update__text">{{ t("content.updateAvailable") }}</span>
    <button
      type="button"
      class="content-update__button focus-ring"
      :disabled="applying"
      @click="$emit('show')"
    >
      {{ applying ? t("content.updating") : t("content.showUpdate") }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

/**
 * T-042 S9 — non-blocking update affordance. It never covers or replaces the
 * article; the page owns the skeleton + refetch when the user activates it.
 */
withDefaults(
  defineProps<{
    visible: boolean;
    applying?: boolean;
  }>(),
  { applying: false }
);

defineEmits<{ show: [] }>();

const { t } = useI18n();
</script>

<style scoped>
.content-update {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: var(--color-surface-raised);
  color: var(--color-text);
}

.content-update__text {
  font-weight: 600;
}

.content-update__button {
  min-height: 2.75rem;
  padding: 0.375rem 0.875rem;
  border: 1px solid var(--color-accent);
  border-radius: 0.375rem;
  background: var(--color-surface);
  color: var(--color-text);
  font-weight: 600;
  cursor: pointer;
}

.content-update__button:disabled {
  opacity: 0.6;
  cursor: wait;
}
</style>
