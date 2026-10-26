<template>
  <!--
    T-048 — the ONE sanctioned cross-entity submit shell.

    Boundary (architector-owned): presentation only. It owns the page heading,
    mode-conditional section slots, feedback regions and the submit form
    element; it has no Supabase import and no mutation logic. Each entity keeps
    its own API module and submit function, so this cannot grow into a generic
    form framework.

    Modes:
      - project:     optional cover/root section
      - publication: optional file/URL source section
      - event:       optional mapping table section (never a form submit)
  -->
  <component
    :is="submitMode ? 'form' : 'div'"
    class="admin-submit-shell"
    data-testid="admin-submit-shell"
    :data-mode="mode"
    :aria-busy="pending ? 'true' : 'false'"
    :novalidate="submitMode ? true : undefined"
    @submit.prevent="onSubmit"
  >
    <h1 v-if="showHeading && heading" class="admin-submit-shell__heading">
      {{ heading }}
    </h1>

    <p v-if="intro" class="admin-submit-shell__intro">{{ intro }}</p>

    <div
      v-if="mode === 'project' && $slots['project-extra']"
      class="admin-submit-shell__extra"
      data-testid="shell-project-extra"
    >
      <slot name="project-extra" />
    </div>

    <div
      v-if="mode === 'publication' && $slots['publication-extra']"
      class="admin-submit-shell__extra"
      data-testid="shell-publication-extra"
    >
      <slot name="publication-extra" />
    </div>

    <div
      v-if="mode === 'event' && $slots['event-extra']"
      class="admin-submit-shell__extra"
      data-testid="shell-event-extra"
    >
      <slot name="event-extra" />
    </div>

    <slot />

    <p
      v-if="statusMessage"
      class="admin-submit-shell__status"
      role="status"
      aria-live="polite"
      data-testid="shell-status"
    >
      {{ statusMessage }}
    </p>

    <p
      v-if="errorMessage"
      class="admin-submit-shell__error"
      role="alert"
      data-testid="shell-error"
    >
      {{ errorMessage }}
    </p>

    <div
      v-if="$slots.actions"
      class="admin-submit-shell__actions"
      data-testid="shell-actions"
    >
      <slot name="actions" />
    </div>
  </component>
</template>

<script setup lang="ts">
/**
 * T-048 — presentational submit chrome. See the boundary note above.
 */
export type SubmitShellMode = "project" | "publication" | "event";

withDefaults(
  defineProps<{
    readonly mode: SubmitShellMode;
    readonly heading?: string;
    readonly intro?: string;
    /** Render a real <form> so Enter submits (project/publication editors). */
    readonly submitMode?: boolean;
    /** Hosted editors with their own h1 pass false (tabbed surface). */
    readonly showHeading?: boolean;
    readonly pending?: boolean;
    readonly statusMessage?: string;
    readonly errorMessage?: string;
  }>(),
  {
    heading: "",
    intro: "",
    submitMode: false,
    showHeading: true,
    pending: false,
    statusMessage: "",
    errorMessage: ""
  }
);

const emit = defineEmits<{
  submit: [];
}>();

function onSubmit(): void {
  emit("submit");
}
</script>

<style scoped>
.admin-submit-shell__heading {
  margin: 0 0 0.5rem;
  font-size: var(--font-size-h2);
  font-weight: 700;
}

.admin-submit-shell__intro {
  margin: 0 0 1.5rem;
  max-width: 70ch;
  color: var(--color-text-muted);
  line-height: 1.6;
}

.admin-submit-shell__status {
  margin-top: 1rem;
  font-weight: 600;
}

.admin-submit-shell__error {
  margin-top: 1rem;
  color: var(--color-danger);
  font-weight: 600;
}

.admin-submit-shell__actions {
  margin-top: 1.5rem;
}
</style>
