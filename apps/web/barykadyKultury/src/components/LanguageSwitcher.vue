<template>
  <div
    ref="rootEl"
    class="language-switcher"
    :class="{ 'language-switcher--open': open }"
    @mouseenter="onHoverEnter"
    @mouseleave="onHoverLeave"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
    @keydown.escape="onEscape"
  >
    <!--
      Collapsed trigger: visible label ("Language") + the CURRENT locale
      (flag + display code) + chevron. Hovering/tapping/clicking it reveals
      the options; the `title` tooltip ("Change language") and the chevron
      make the "hover me to change" affordance explicit (user requirement).

      Accessible name = visible label + sr-only "autonym code"
      (e.g. "Język Polski PL"); the flag, code badge and chevron are
      aria-hidden so nothing is announced twice and the visible text stays
      inside the name (WCAG 2.5.3).
    -->
    <button
      ref="triggerEl"
      type="button"
      class="language-switcher__trigger focus-ring"
      :aria-expanded="open ? 'true' : 'false'"
      aria-haspopup="true"
      aria-controls="bk-language-options"
      :title="t('nav.changeLanguage')"
      @pointerdown="onPointerDown"
      @click="onTriggerClick"
    >
      <span class="language-switcher__label">{{ t("nav.language") }}</span>
      <span class="language-switcher__flag" aria-hidden="true">{{
        LOCALE_FLAGS[activeLocale]
      }}</span>
      <span class="language-switcher__code" aria-hidden="true">{{
        LOCALE_DISPLAY_CODE[activeLocale]
      }}</span>
      <span class="sr-only"
        >{{ " " + LOCALE_LABELS[activeLocale] }}
        {{ LOCALE_DISPLAY_CODE[activeLocale] }}</span
      >
      <span class="language-switcher__chevron" aria-hidden="true">▾</span>
    </button>

    <!--
      Expanded panel: one button per locale (flag + code visible, autonym +
      code as the accessible name). Native buttons keep Tab/Enter/Space for
      free; the current locale is marked with aria-current and an accent
      inset ring, so state is never colour-only (DESIGN_SYSTEM.md §6).
    -->
    <ul
      id="bk-language-options"
      class="language-switcher__options"
      v-show="open"
    >
      <li v-for="locale in SUPPORTED_LOCALES" :key="locale">
        <button
          type="button"
          class="language-switcher__option focus-ring"
          :aria-current="locale === activeLocale ? 'true' : undefined"
          @click="onSelect(locale)"
        >
          <span class="sr-only"
            >{{ LOCALE_LABELS[locale] }} {{ LOCALE_DISPLAY_CODE[locale] }}</span
          >
          <span class="language-switcher__flag" aria-hidden="true">{{
            LOCALE_FLAGS[locale]
          }}</span>
          <span class="language-switcher__code" aria-hidden="true">{{
            LOCALE_DISPLAY_CODE[locale]
          }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_DISPLAY_CODE,
  LOCALE_FLAGS,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type Locale
} from "@/features/i18n/locales";
import { replaceLocaleInPath } from "@/features/i18n/localePath";
import { localeStore } from "@/features/i18n/localeStorage";

/**
 * Language switcher — hover-expanding disclosure
 * (docs/PRODUCT_REQUIREMENTS.md §2 item 3; user decision: the 3-chip row
 * was too wide, options should only appear on hover, and the control must
 * be named so it is obvious that hovering changes the language).
 *
 * Interaction model — three independent open signals, OR-ed together, so
 * no modality is ever locked out (NOT hover-only):
 *  - `hoverOpen`  — pointer over the component (mouseenter/mouseleave).
 *    Leaving closes UNLESS keyboard focus is inside, so a mixed
 *    mouse-then-tab session does not lose the panel.
 *  - `focusOpen`  — focus arrived via keyboard (Tab). Suppressed when the
 *    focus change was pointer-caused (`pointerOrigin` from pointerdown),
 *    which is what prevents the classic "focus opens, the click that
 *    caused it immediately closes" double-toggle on tap/click.
 *  - `pinnedOpen` — explicit click/tap/Enter toggle on the trigger. Enter
 *    and Space fire click with `detail === 0`; pointer clicks have
 *    `detail >= 1`; both simply toggle the pin.
 * Closing: Escape (all signals cleared, focus restored to the trigger),
 * focus leaving the component, or selecting an option. Pointer-leave gets
 * a 120 ms grace period (cancelled on re-entry) and the panel carries an
 * invisible ::before bridge over the trigger→panel seam, so the mouse path
 * is continuous (user-reported bug: the dead 4 px gap closed the menu).
 *
 * The options are plain buttons in a list (disclosure pattern, not a
 * menu/listbox), which keeps the keyboard contract to native Tab +
 * Enter/Space — no roving tabindex or activedescendant bookkeeping to get
 * wrong. `aria-expanded`/`aria-controls` expose the disclosure state.
 *
 * Persistence happens *here*, on the explicit user action, and nowhere
 * else — navigation must never rewrite the saved choice. Route, query and
 * hash are preserved so switching does not lose the user's place. Machine
 * locale codes are untouched (`uk` stays `uk`); UA is display-only
 * (LOCALE_DISPLAY_CODE in features/i18n/locales.ts).
 */
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const rootEl = ref<HTMLElement | null>(null);
const triggerEl = ref<HTMLButtonElement | null>(null);

const hoverOpen = ref(false);
const focusOpen = ref(false);
const pinnedOpen = ref(false);

/** True while a pointer press may move focus (tap/click), not keyboard Tab. */
let pointerOrigin = false;
/** One-shot guard: focus() we move programmatically must not re-open. */
let suppressFocusOpen = false;
/** Where the pointer currently is — lets focusout close a stale hover. */
let pointerInside = false;
/**
 * Pointer type of the last press ("mouse" | "touch" | "pen"). Mouse presses
 * must NOT pin the panel open: hover already governs it, and pinning on a
 * mouse click made the panel survive `mouseleave` (user-reported bug).
 */
let lastPointerType: string | null = null;

/**
 * Grace period before a pointer-leave actually collapses a hover-opened
 * panel (user-reported bug: the pointer crossing the trigger→panel seam —
 * especially diagonally, overshooting the invisible ::before bridge —
 * fired mouseleave and killed the menu mid-travel). 120 ms is under the
 * threshold that feels sluggish while covering a short excursion; any
 * re-entry cancels it, and the timer re-checks state before closing.
 */
const HOVER_CLOSE_DELAY_MS = 120;
let hoverCloseTimer: ReturnType<typeof setTimeout> | null = null;

function cancelScheduledHoverClose(): void {
  if (hoverCloseTimer !== null) {
    clearTimeout(hoverCloseTimer);
    hoverCloseTimer = null;
  }
}

const open = computed(
  () => hoverOpen.value || focusOpen.value || pinnedOpen.value
);

const activeLocale = computed(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

function onHoverEnter(): void {
  pointerInside = true;
  // Coming back within the grace period cancels the pending close.
  cancelScheduledHoverClose();
  hoverOpen.value = true;
}

function onHoverLeave(): void {
  pointerInside = false;
  // Only *keyboard* focus keeps a hover-opened panel alive. A mouse click
  // also focuses the trigger; treating that as "focus holds it open" left
  // the panel visible after the pointer had already left (reported bug).
  if (focusOpen.value) {
    return;
  }
  cancelScheduledHoverClose();
  hoverCloseTimer = setTimeout(() => {
    hoverCloseTimer = null;
    // Re-check at fire time: the pointer may have returned through the
    // bridge, or keyboard focus arrived — either keeps the panel open.
    if (pointerInside || focusOpen.value) {
      return;
    }
    hoverOpen.value = false;
  }, HOVER_CLOSE_DELAY_MS);
}

function onFocusIn(): void {
  if (suppressFocusOpen) {
    suppressFocusOpen = false;
    return;
  }
  if (pointerOrigin) {
    // Pointer-driven focus: the click handler owns the open state.
    return;
  }
  focusOpen.value = true;
}

function onFocusOut(event: FocusEvent): void {
  const next = event.relatedTarget as Node | null;
  if (next && rootEl.value?.contains(next)) {
    return; // moving between trigger and options keeps it open
  }
  focusOpen.value = false;
  pinnedOpen.value = false;
  pointerOrigin = false;
  // The pointer left while focus was holding the hover state open; now
  // that focus is gone too, nothing keeps the panel relevant.
  if (!pointerInside) {
    hoverOpen.value = false;
  }
}

function onPointerDown(event: PointerEvent): void {
  pointerOrigin = true;
  // jsdom/older browsers may omit pointerType; default to mouse.
  lastPointerType = event.pointerType || "mouse";
}

function onTriggerClick(event: MouseEvent): void {
  const isKeyboard = event.detail === 0;
  const isMouse = lastPointerType === "mouse" || lastPointerType === null;

  // Mouse: hover already opened the panel and owns its lifetime, so a click
  // must NOT pin it open — otherwise it survives `mouseleave` and stays
  // visible after the pointer leaves (user-reported bug). Keyboard
  // (Enter/Space) and touch/pen have no hover, so they pin/toggle instead.
  if (!isKeyboard && isMouse) {
    pointerOrigin = false;
    return;
  }

  pinnedOpen.value = !pinnedOpen.value;
  if (pinnedOpen.value) {
    // An explicit open should not be undone by the pointer leaving.
    hoverOpen.value = false;
  }
  pointerOrigin = false;
}

function onEscape(): void {
  closePanel();
  if (triggerEl.value && document.activeElement !== triggerEl.value) {
    suppressFocusOpen = true;
    triggerEl.value.focus();
  }
}

function closePanel(): void {
  cancelScheduledHoverClose();
  hoverOpen.value = false;
  focusOpen.value = false;
  pinnedOpen.value = false;
}

function onSelect(next: Locale): void {
  closePanel();

  // Return focus to the stable trigger — the option button is about to be
  // hidden (or the page to change), and a dropped caret is poor UX.
  if (triggerEl.value && document.activeElement !== triggerEl.value) {
    suppressFocusOpen = true;
    triggerEl.value.focus();
  }

  if (next === activeLocale.value) {
    return;
  }

  localeStore.write(next);
  void router.push({
    path: replaceLocaleInPath(route.path, next),
    query: route.query,
    hash: route.hash
  });
}

// A pending grace-period close must not survive the component.
onBeforeUnmount(cancelScheduledHoverClose);
</script>

<style scoped>
/*
  The whole control anchors the popover; the trigger is the only element
  in flow, so the collapsed footprint is ~150 px instead of the old
  290 px three-chip row (header width budget, brand-fixes v3.2).
*/
.language-switcher {
  position: relative;
  display: inline-flex;
  min-width: 0;
}

/*
  Trigger: bordered chip so it reads as an interactive control, never a
  static label. Border uses --color-form-border (certified ≥ 3:1 control
  boundary in both themes, DESIGN_SYSTEM.md §1). Open state adds the
  accent ring and flips the chevron — shape cues, not colour-only.
*/
.language-switcher__trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 2.25rem;
  padding: 0 0.625rem;
  border: 1px solid var(--color-form-border);
  border-radius: 0.375rem;
  background: var(--color-surface-raised);
  color: var(--color-text);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  transition:
    border-color var(--motion-duration),
    box-shadow var(--motion-duration);
}

.language-switcher--open .language-switcher__trigger {
  border-color: var(--color-accent);
  box-shadow: inset 0 0 0 1px var(--color-accent);
}

.language-switcher__label {
  font-weight: 600;
  white-space: nowrap;
}

.language-switcher__flag {
  font-size: 1.125rem;
  line-height: 1;
}

.language-switcher__code {
  font-weight: 600;
  letter-spacing: 0.03em;
}

.language-switcher__chevron {
  font-size: 0.75rem;
  line-height: 1;
  transition: transform var(--motion-duration);
}

.language-switcher--open .language-switcher__chevron {
  transform: rotate(180deg);
}

/*
  Popover: dialog surface token (--color-dialog-bg, AAA text pair),
  certified control boundary, elevation shadow. Right-aligned so it stays
  inside the header's right corner at every viewport; column layout keeps
  it narrow (≈ 120 px) and never wider than the drawer at 320 px.
  display:none when closed (v-show) removes options from tab order.
*/
.language-switcher__options {
  position: absolute;
  top: calc(100% + 0.25rem);
  right: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 100%;
  margin: 0;
  padding: 0.25rem;
  list-style: none;
  background: var(--color-dialog-bg);
  border: 1px solid var(--color-form-border);
  border-radius: 0.375rem;
  box-shadow: var(--shadow-md);
}

/*
  Invisible hover bridge across the 0.25 rem seam between trigger and
  panel (user-reported bug fix). The strip belonged to no box under this
  component, so moving straight from the trigger into the list fired
  mouseleave on the root and the menu collapsed mid-travel. A transparent
  pseudo-element of the PANEL — a descendant of the root — claims the gap,
  so the pointer never leaves the root's subtree during the crossing
  (mouseenter/mouseleave count descendants even when they sit outside the
  parent's border box). No visual change: no background, no size beyond
  the dead strip it fills.
*/
.language-switcher__options::before {
  content: "";
  position: absolute;
  top: -0.25rem;
  left: 0;
  right: 0;
  height: 0.25rem;
}

.language-switcher__option {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  width: 100%;
  min-height: 2.25rem;
  padding: 0 0.625rem;
  border: 0;
  border-radius: 0.25rem;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  cursor: pointer;
}

/*
  Current locale: accent inset ring, paired with the aria-current attribute
  so state is carried by the attribute and a visible boundary, not colour
  alone (DESIGN_SYSTEM.md §6).
*/
.language-switcher__option[aria-current="true"] {
  box-shadow: inset 0 0 0 2px var(--color-accent);
}
</style>
