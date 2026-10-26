<template>
  <!--
    BkConfirmDialog — the bk/ seam for destructive confirmations (T-027).

    WHY a bespoke primitive instead of QDialog: the confirm contract is small
    (two actions, Escape, focus return) and is fully expressible with native
    semantics, which keeps it unit-testable in happy-dom and free of teleport
    timing. It lives in bk/ because no application file may render raw Quasar
    or bespoke modal chrome directly (src/components/bk/__tests__/bk.test.ts).

    Accessibility contract (DESIGN_SYSTEM.md §6):
      - role="dialog" + aria-modal + aria-labelledby/aria-describedby;
      - focus moves to the safe action (Cancel) on open;
      - Escape cancels; Tab wraps inside the dialog (no keyboard trap escape);
      - focus returns to the element that opened the dialog on close.
  -->
  <div v-if="modelValue" class="bk-confirm" @keydown="onKeydown">
    <div class="bk-confirm__backdrop" aria-hidden="true"></div>
    <div
      ref="dialogRef"
      class="bk-confirm__dialog"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :aria-describedby="messageId"
      tabindex="-1"
    >
      <h2 :id="titleId" class="bk-confirm__title">{{ title }}</h2>
      <p :id="messageId" class="bk-confirm__message">{{ message }}</p>
      <div class="bk-confirm__actions">
        <BkButton
          ref="cancelRef"
          variant="flat"
          :label="cancelLabel"
          data-testid="confirm-cancel"
          @click="cancel"
        />
        <BkButton
          variant="primary"
          :color="danger ? 'negative' : undefined"
          :label="confirmLabel"
          data-testid="confirm-accept"
          @click="confirm"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, useId, watch, type ComponentPublicInstance } from "vue";

import BkButton from "./BkButton.vue";

/**
 * BkConfirmDialog — the destructive-action seam used by admin pages.
 *
 * WHY native dialog semantics instead of QDialog: the contract is deliberately
 * tiny (two actions, Escape, focus return) and happy-dom can exercise the
 * whole thing without teleport timing. That makes the focus guarantees
 * testable, which matters more here than reusing a framework primitive.
 *
 * The accessibility contract above is not decorative: focus enters on Cancel
 * (the safe action), Tab is trapped between the two buttons, Escape cancels,
 * and focus returns to whichever control opened the dialog. Every admin
 * delete flow relies on this, so a refactor must keep both the dialog
 * semantics (role/aria) and the focus behaviours above.
 */
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    /** Renders the confirm action as a destructive (negative) button. */
    danger?: boolean;
  }>(),
  { danger: false }
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  confirm: [];
}>();

const dialogRef = ref<HTMLElement | null>(null);
const cancelRef = ref<ComponentPublicInstance | null>(null);
const titleId = `${useId()}-confirm-title`;
const messageId = `${useId()}-confirm-message`;

/** Where focus came from, so it can be handed back on close. */
let restoreTarget: HTMLElement | null = null;

function close(): void {
  emit("update:modelValue", false);
}

function cancel(): void {
  close();
}

function confirm(): void {
  emit("confirm");
  close();
}

function focusableButtons(): HTMLButtonElement[] {
  if (!dialogRef.value) return [];
  return Array.from(dialogRef.value.querySelectorAll("button"));
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    cancel();
    return;
  }

  if (event.key !== "Tab") return;

  // A minimal focus trap: wrap between the two actions. Without this, Tab
  // would move focus to the page behind the modal.
  const buttons = focusableButtons();
  if (buttons.length === 0) return;

  const first = buttons[0]!;
  const last = buttons[buttons.length - 1]!;
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

watch(
  () => props.modelValue,
  async (open, wasOpen) => {
    if (open && !wasOpen) {
      restoreTarget =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      await nextTick();
      cancelRef.value?.$el?.focus();
      return;
    }

    if (!open && wasOpen) {
      const target = restoreTarget;
      restoreTarget = null;
      await nextTick();
      target?.focus();
    }
  }
);
</script>

<style scoped>
.bk-confirm {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.bk-confirm__backdrop {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 45%);
}

.bk-confirm__dialog {
  position: relative;
  width: 100%;
  max-width: 28rem;
  padding: 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-md);
}

.bk-confirm__title {
  margin: 0 0 0.5rem;
  font-size: 1.125rem;
  font-weight: 700;
}

.bk-confirm__message {
  margin: 0 0 1.5rem;
  line-height: 1.6;
}

.bk-confirm__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
