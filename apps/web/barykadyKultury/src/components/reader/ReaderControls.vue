<template>
  <!--
    ReaderControls — D-34 primitives: QOptionGroup radiogroups for the
    exclusive steps (text size, measure), QSlider paired with −/+ buttons for
    line and paragraph spacing (WCAG 2.5.7: the slider works with arrows,
    the buttons give a coarse keyboard path and a large target). State is
    carried by radio marks, slider position and text — never color alone.
  -->
  <div
    class="reader-controls"
    role="group"
    :aria-label="t('reader.controls.heading')"
    data-testid="reader-controls"
  >
    <div class="reader-controls__section" data-testid="control-text-size">
      <p class="reader-controls__label">{{ t("reader.controls.textSize") }}</p>
      <q-option-group
        :model-value="String(settings.textSize)"
        :options="textSizeOptions"
        type="radio"
        dense
        @update:model-value="setTextSize"
      />
    </div>

    <div class="reader-controls__section" data-testid="control-measure">
      <p class="reader-controls__label">{{ t("reader.controls.measure") }}</p>
      <q-option-group
        :model-value="settings.measure"
        :options="measureOptions"
        type="radio"
        dense
        @update:model-value="setMeasure"
      />
    </div>

    <div class="reader-controls__section" data-testid="control-line-spacing">
      <p class="reader-controls__label">{{
        t("reader.controls.lineSpacing")
      }}</p>
      <div class="reader-controls__stepper">
        <button
          type="button"
          class="reader-controls__step focus-ring"
          :aria-label="`${t('reader.controls.decrease')} ${t('reader.controls.lineSpacing')}`"
          :disabled="settings.lineSpacing === 0"
          @click="stepBy('lineSpacing', -1)"
        >
          −
        </button>
        <q-slider
          class="reader-controls__slider"
          :aria-label="t('reader.controls.lineSpacing')"
          :aria-valuetext="
            t(`reader.controls.spacingValues.${settings.lineSpacing}`)
          "
          :model-value="settings.lineSpacing"
          :min="0"
          :max="LINE_SPACING_STEPS.length - 1"
          :step="1"
          dense
          @update:model-value="dragStep('lineSpacing', $event)"
          @change="commitStep('lineSpacing', $event)"
        />
        <button
          type="button"
          class="reader-controls__step focus-ring"
          :aria-label="`${t('reader.controls.increase')} ${t('reader.controls.lineSpacing')}`"
          :disabled="settings.lineSpacing === LINE_SPACING_STEPS.length - 1"
          @click="stepBy('lineSpacing', 1)"
        >
          +
        </button>
      </div>
    </div>

    <div
      class="reader-controls__section"
      data-testid="control-paragraph-spacing"
    >
      <p class="reader-controls__label">
        {{ t("reader.controls.paragraphSpacing") }}
      </p>
      <div class="reader-controls__stepper">
        <button
          type="button"
          class="reader-controls__step focus-ring"
          :aria-label="`${t('reader.controls.decrease')} ${t('reader.controls.paragraphSpacing')}`"
          :disabled="settings.paragraphSpacing === 0"
          @click="stepBy('paragraphSpacing', -1)"
        >
          −
        </button>
        <q-slider
          class="reader-controls__slider"
          :aria-label="t('reader.controls.paragraphSpacing')"
          :aria-valuetext="
            t(`reader.controls.spacingValues.${settings.paragraphSpacing}`)
          "
          :model-value="settings.paragraphSpacing"
          :min="0"
          :max="PARAGRAPH_SPACING_STEPS.length - 1"
          :step="1"
          dense
          @update:model-value="dragStep('paragraphSpacing', $event)"
          @change="commitStep('paragraphSpacing', $event)"
        />
        <button
          type="button"
          class="reader-controls__step focus-ring"
          :aria-label="`${t('reader.controls.increase')} ${t('reader.controls.paragraphSpacing')}`"
          :disabled="
            settings.paragraphSpacing === PARAGRAPH_SPACING_STEPS.length - 1
          "
          @click="stepBy('paragraphSpacing', 1)"
        >
          +
        </button>
      </div>
    </div>

    <button
      type="button"
      class="reader-controls__reset focus-ring"
      data-testid="control-reset"
      @click="onReset"
    >
      {{ t("reader.controls.reset") }}
    </button>

    <!-- Polite announcements; focus never moves (ticket: announced). -->
    <p
      class="sr-only"
      role="status"
      aria-live="polite"
      data-testid="controls-status"
    >
      {{ announcement }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { QOptionGroup, QSlider } from "quasar";
import { useI18n } from "vue-i18n";

import {
  LINE_SPACING_STEPS,
  PARAGRAPH_SPACING_STEPS,
  type ReaderMeasure,
  type ReaderSettings,
  TEXT_SIZE_STEPS
} from "./readerSettings";

/**
 * Controlled component: the parent (LongFormReader) owns the settings object
 * and persistence; this emits patches and the reset intent.
 */
const props = defineProps<{ settings: ReaderSettings }>();

const emit = defineEmits<{
  /** Live apply (drag frames) — parent must NOT persist on this event. */
  update: [settings: ReaderSettings];
  /** Final value (release, radio, button) — the parent persists here. */
  commit: [settings: ReaderSettings];
  reset: [];
}>();

const { t } = useI18n();

const announcement = ref("");

const textSizeOptions = computed(() =>
  TEXT_SIZE_STEPS.map((_, index) => ({
    label: t(`reader.controls.sizes.${index}`),
    value: String(index)
  }))
);

const measureOptions = computed(() =>
  (["narrow", "medium", "wide"] as const).map(value => ({
    label: t(`reader.controls.measureValues.${value}`),
    value
  }))
);

/** Discrete change: apply + persist + announce in one step. */
function patch(next: Partial<ReaderSettings>, label: string): void {
  const merged = { ...props.settings, ...next };
  emit("update", merged);
  emit("commit", merged);
  announcement.value = label;
}

function clampStep(
  key: "lineSpacing" | "paragraphSpacing",
  value: number | null
): number {
  const max =
    key === "lineSpacing"
      ? LINE_SPACING_STEPS.length - 1
      : PARAGRAPH_SPACING_STEPS.length - 1;
  return Math.min(Math.max(Math.round(value ?? 0), 0), max);
}

/** Drag frame: live typography only — no persistence, no announcement. */
function dragStep(
  key: "lineSpacing" | "paragraphSpacing",
  value: number | null
): void {
  emit("update", { ...props.settings, [key]: clampStep(key, value) });
}

/** Slider release: the committed value persists and announces. */
function commitStep(
  key: "lineSpacing" | "paragraphSpacing",
  value: number | null
): void {
  const merged = { ...props.settings, [key]: clampStep(key, value) };
  emit("update", merged);
  emit("commit", merged);
  announcement.value = `${t(`reader.controls.${key}`)}: ${t(
    `reader.controls.spacingValues.${merged[key]}`
  )}`;
}

function setTextSize(value: string | number): void {
  const index = Math.min(
    Math.max(Number(value) || 0, 0),
    TEXT_SIZE_STEPS.length - 1
  );
  patch(
    { textSize: index },
    `${t("reader.controls.textSize")}: ${t(`reader.controls.sizes.${index}`)}`
  );
}

function setMeasure(value: string | number): void {
  const measure = String(value) as ReaderMeasure;
  patch(
    { measure },
    `${t("reader.controls.measure")}: ${t(`reader.controls.measureValues.${measure}`)}`
  );
}

function setStep(
  key: "lineSpacing" | "paragraphSpacing",
  value: number | null
): void {
  const max =
    key === "lineSpacing"
      ? LINE_SPACING_STEPS.length - 1
      : PARAGRAPH_SPACING_STEPS.length - 1;
  const index = Math.min(Math.max(Math.round(value ?? 0), 0), max);
  patch(
    { [key]: index },
    `${t(`reader.controls.${key}`)}: ${String(index + 1)}/${String(max + 1)}`
  );
}

function stepBy(key: "lineSpacing" | "paragraphSpacing", delta: number): void {
  const max =
    key === "lineSpacing"
      ? LINE_SPACING_STEPS.length - 1
      : PARAGRAPH_SPACING_STEPS.length - 1;
  const index = Math.min(Math.max(props.settings[key] + delta, 0), max);
  patch(
    { [key]: index },
    `${t(`reader.controls.${key}`)}: ${t(`reader.controls.spacingValues.${index}`)}`
  );
}

function onReset(): void {
  emit("reset");
  announcement.value = t("reader.controls.resetDone");
}
</script>

<style scoped>
.reader-controls {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

.reader-controls__section {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.reader-controls__label {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.reader-controls__stepper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.reader-controls__step {
  flex: 0 0 auto;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: var(--color-form-bg);
  color: var(--color-text);
  font-size: 1.125rem;
  font-weight: 700;
  cursor: pointer;
}

.reader-controls__step:hover:not(:disabled) {
  border-color: var(--color-link);
}

.reader-controls__step:disabled {
  color: var(--color-disabled-text);
  cursor: not-allowed;
}

.reader-controls__slider {
  flex: 1;
  min-width: 0;
}

.reader-controls__reset {
  align-self: flex-start;
  min-height: 2.75rem;
  padding: 0.375rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.reader-controls__reset:hover {
  border-color: var(--color-link);
}

/* QOptionGroup density + color follow the form tokens (both modes). */
.reader-controls :deep(.q-radio__inner) {
  color: var(--color-link);
}
</style>
