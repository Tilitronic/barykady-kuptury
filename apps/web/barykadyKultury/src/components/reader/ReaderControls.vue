<template>
  <!--
    ReaderControls — one primitive for every step (header-lane follow-up on
    D-34): a QSlider with a visible ruler of step ticks plus a grouped −/+
    button pair docked to the slider's RIGHT (never straddling it). Text
    size, line width and line spacing are three instances of that shape —
    identical behaviour, styling and keyboard story. Paragraph spacing was
    dropped entirely: block rhythm stays at the DESIGN_SYSTEM baseline.

    Accessibility contract (unchanged): the slider is the arrow-key path
    (WCAG 2.5.7), the buttons give a coarse large-target path, each slider
    carries its control name plus a WORD-valued aria-valuetext (never a raw
    index), the ruler/labels are decorative (aria-hidden), the visible value
    mirror matches what assistive tech hears, and changes land in one polite
    live region — focus never moves.
  -->
  <div
    class="reader-controls"
    role="group"
    :aria-label="t('reader.controls.heading')"
    data-testid="reader-controls"
  >
    <div class="reader-controls__section" data-testid="control-text-size">
      <p class="reader-controls__label">{{ t("reader.controls.textSize") }}</p>
      <div class="reader-controls__stepper">
        <BkSlider
          class="reader-controls__slider"
          :aria-label="t('reader.controls.textSize')"
          :aria-valuetext="textSizeWord"
          :model-value="settings.textSize"
          :min="0"
          :max="TEXT_MAX"
          :step="1"
          snap
          dense
          @update:model-value="drag('textSize', $event)"
          @change="commit('textSize', $event)"
        />
        <div class="reader-controls__buttons">
          <button
            type="button"
            class="reader-controls__step focus-ring"
            :aria-label="`${t('reader.controls.decrease')} ${t('reader.controls.textSize')}`"
            :disabled="settings.textSize === 0"
            @click="stepBy('textSize', -1)"
          >
            −
          </button>
          <button
            type="button"
            class="reader-controls__step focus-ring"
            :aria-label="`${t('reader.controls.increase')} ${t('reader.controls.textSize')}`"
            :disabled="settings.textSize === TEXT_MAX"
            @click="stepBy('textSize', 1)"
          >
            +
          </button>
        </div>
      </div>
      <Ruler
        :count="TEXT_MAX + 1"
        :min-label="word('textSize', 0)"
        :max-label="word('textSize', TEXT_MAX)"
      />
      <p class="reader-controls__value" aria-hidden="true">{{
        textSizeWord
      }}</p>
    </div>

    <div class="reader-controls__section" data-testid="control-measure">
      <p class="reader-controls__label">{{ t("reader.controls.measure") }}</p>
      <div class="reader-controls__stepper">
        <BkSlider
          class="reader-controls__slider"
          :aria-label="t('reader.controls.measure')"
          :aria-valuetext="measureWord"
          :model-value="measureIndex"
          :min="0"
          :max="MEASURE_MAX"
          :step="1"
          snap
          dense
          @update:model-value="dragMeasure($event)"
          @change="commitMeasure($event)"
        />
        <div class="reader-controls__buttons">
          <button
            type="button"
            class="reader-controls__step focus-ring"
            :aria-label="`${t('reader.controls.decrease')} ${t('reader.controls.measure')}`"
            :disabled="measureIndex === 0"
            @click="stepMeasure(-1)"
          >
            −
          </button>
          <button
            type="button"
            class="reader-controls__step focus-ring"
            :aria-label="`${t('reader.controls.increase')} ${t('reader.controls.measure')}`"
            :disabled="measureIndex === MEASURE_MAX"
            @click="stepMeasure(1)"
          >
            +
          </button>
        </div>
      </div>
      <Ruler
        :count="MEASURE_STOPS.length"
        :min-label="word('measure', 0)"
        :max-label="word('measure', MEASURE_MAX)"
      />
      <p class="reader-controls__value" aria-hidden="true">{{ measureWord }}</p>
    </div>

    <div class="reader-controls__section" data-testid="control-line-spacing">
      <p class="reader-controls__label">{{
        t("reader.controls.lineSpacing")
      }}</p>
      <div class="reader-controls__stepper">
        <BkSlider
          class="reader-controls__slider"
          :aria-label="t('reader.controls.lineSpacing')"
          :aria-valuetext="lineSpacingWord"
          :model-value="settings.lineSpacing"
          :min="0"
          :max="LINE_MAX"
          :step="1"
          snap
          dense
          @update:model-value="drag('lineSpacing', $event)"
          @change="commit('lineSpacing', $event)"
        />
        <div class="reader-controls__buttons">
          <button
            type="button"
            class="reader-controls__step focus-ring"
            :aria-label="`${t('reader.controls.decrease')} ${t('reader.controls.lineSpacing')}`"
            :disabled="settings.lineSpacing === 0"
            @click="stepBy('lineSpacing', -1)"
          >
            −
          </button>
          <button
            type="button"
            class="reader-controls__step focus-ring"
            :aria-label="`${t('reader.controls.increase')} ${t('reader.controls.lineSpacing')}`"
            :disabled="settings.lineSpacing === LINE_MAX"
            @click="stepBy('lineSpacing', 1)"
          >
            +
          </button>
        </div>
      </div>
      <Ruler
        :count="LINE_MAX + 1"
        :min-label="word('lineSpacing', 0)"
        :max-label="word('lineSpacing', LINE_MAX)"
      />
      <p class="reader-controls__value" aria-hidden="true">
        {{ lineSpacingWord }}
      </p>
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
import { computed, defineComponent, h, ref, type PropType } from "vue";
import { BkSlider } from "@/components/bk";
import { useI18n } from "vue-i18n";

import {
  LINE_SPACING_STEPS,
  MEASURE_STOPS,
  TEXT_SIZE_STEPS,
  type ReaderMeasure,
  type ReaderSettings
} from "./readerSettings";

/**
 * Controlled component: the parent (LongFormReader) owns the settings object
 * and persistence; this emits patches and the reset intent.
 */
const props = defineProps<{ settings: ReaderSettings }>();

const emit = defineEmits<{
  /** Live apply (drag frames) — parent must NOT persist on this event. */
  update: [settings: ReaderSettings];
  /** Final value (release, button) — the parent persists here. */
  commit: [settings: ReaderSettings];
  reset: [];
}>();

const { t } = useI18n();

const TEXT_MAX = TEXT_SIZE_STEPS.length - 1;
const LINE_MAX = LINE_SPACING_STEPS.length - 1;
const MEASURE_MAX = MEASURE_STOPS.length - 1;

/** Numeric step controls: the two rulers whose model value IS the index. */
type StepKey = "textSize" | "lineSpacing";
const STEP_MAX: Record<StepKey, number> = {
  textSize: TEXT_MAX,
  lineSpacing: LINE_MAX
};

/**
 * Decorative ruler under a slider: one tick per step (taller at the ends —
 * the "рідер-лік" look the header lane asked for), min/max words framed
 * beneath. The words also exist for screen readers via the slider's
 * aria-valuetext, so this whole block is aria-hidden.
 */
const Ruler = defineComponent({
  name: "ReaderRuler",
  props: {
    count: { type: Number, required: true },
    minLabel: { type: String, required: true },
    maxLabel: { type: String, required: true }
  },
  setup(rulerProps) {
    return () =>
      h("div", { class: "reader-controls__ruler", "aria-hidden": "true" }, [
        h(
          "div",
          { class: "reader-controls__ticks" },
          Array.from({ length: rulerProps.count }, (_, index) =>
            h("span", {
              key: index,
              class: [
                "reader-controls__tick",
                (index === 0 || index === rulerProps.count - 1) &&
                  "reader-controls__tick--major"
              ]
            })
          )
        ),
        h("div", { class: "reader-controls__ruler-labels" }, [
          h("span", {}, rulerProps.minLabel),
          h("span", {}, rulerProps.maxLabel)
        ])
      ]);
  }
});

const announcement = ref("");

function clampIndex(value: number | null | undefined, max: number): number {
  return Math.min(Math.max(Math.round(value ?? 0), 0), max);
}

/** The localized WORD of a step — the single source for value text,
 *  aria-valuetext and the visible mirror. */
function word(key: StepKey | "measure", index: number): string {
  if (key === "measure") {
    return t(`reader.controls.measureValues.${MEASURE_STOPS[index]}`);
  }
  return key === "textSize"
    ? t(`reader.controls.sizes.${index}`)
    : t(`reader.controls.spacingValues.${index}`);
}

const measureIndex = computed(() =>
  Math.max(0, MEASURE_STOPS.indexOf(props.settings.measure))
);

const textSizeWord = computed(() => word("textSize", props.settings.textSize));
const lineSpacingWord = computed(() =>
  word("lineSpacing", props.settings.lineSpacing)
);
const measureWord = computed(() => word("measure", measureIndex.value));

function label(key: StepKey | "measure"): string {
  return key === "measure"
    ? t("reader.controls.measure")
    : t(`reader.controls.${key}`);
}

function apply(
  index: number,
  key: StepKey | "measure",
  persist: boolean
): void {
  const next: ReaderSettings =
    key === "measure"
      ? { ...props.settings, measure: MEASURE_STOPS[index] as ReaderMeasure }
      : { ...props.settings, [key]: index };

  emit("update", next);
  if (persist) {
    emit("commit", next);
    announcement.value = `${label(key)}: ${word(key, index)}`;
  }
}

/** Drag frame: live typography only — no persistence, no announcement. */
function drag(key: StepKey, value: number | null): void {
  apply(clampIndex(value, STEP_MAX[key]), key, false);
}

function dragMeasure(value: number | null): void {
  apply(clampIndex(value, MEASURE_MAX), "measure", false);
}

/** Release: the committed value persists and announces. */
function commit(key: StepKey, value: number | null): void {
  apply(clampIndex(value, STEP_MAX[key]), key, true);
}

function commitMeasure(value: number | null): void {
  apply(clampIndex(value, MEASURE_MAX), "measure", true);
}

/** Button step: a discrete change — apply + persist + announce at once. */
function stepBy(key: StepKey, delta: number): void {
  const index = clampIndex(props.settings[key] + delta, STEP_MAX[key]);
  apply(index, key, true);
}

function stepMeasure(delta: number): void {
  const index = clampIndex(measureIndex.value + delta, MEASURE_MAX);
  apply(index, "measure", true);
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

/* Slider first, the −/+ group pushed to the right edge (the header-lane
   arrangement: both steppers beside each other, never on opposite ends). */
.reader-controls__stepper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.reader-controls__slider {
  flex: 1;
  min-width: 0;
}

.reader-controls__buttons {
  display: flex;
  flex: 0 0 auto;
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

/* Ruler: ticks spaced like a measuring stick, end ticks taller. The ruler
   renders inside a local component (no scope attrs on its nodes) — hence
   :deep throughout. Inset by the handle radius so ticks sit where the
   handle stops (min/max). */
.reader-controls :deep(.reader-controls__ruler) {
  padding-inline: 0.5rem;
}

.reader-controls :deep(.reader-controls__ticks) {
  display: flex;
  justify-content: space-between;
  align-items: end;
  height: 0.5rem;
}

.reader-controls :deep(.reader-controls__tick) {
  width: 1px;
  height: 0.3rem;
  background: var(--color-border);
}

.reader-controls :deep(.reader-controls__tick--major) {
  height: 0.5rem;
  background: var(--color-text-muted);
}

.reader-controls :deep(.reader-controls__ruler-labels) {
  display: flex;
  justify-content: space-between;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.reader-controls__value {
  margin: 0;
  font-weight: 600;
  color: var(--color-text);
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
</style>
