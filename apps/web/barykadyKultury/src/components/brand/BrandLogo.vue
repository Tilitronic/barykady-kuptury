<template>
  <span
    class="brand-logo"
    :class="[`brand-logo--${size}`, `brand-logo--${resolvedKind}`]"
    :aria-hidden="decorative ? 'true' : undefined"
  >
    <img class="brand-logo__img" :src="resolvedSrc" :alt="resolvedAlt" />
  </span>
</template>

<script setup lang="ts">
/**
 * T-008 — BrandLogo
 * =================
 * Renders the brand mark or logotype from self-hosted SVG assets.
 *
 * USAGE RULE (rev-2, spec line 14):
 *   Pass `context` to express placement intent. The brandbook usage rule
 *   (resolveLogoVariant) fires automatically:
 *     header | compact → logo mark
 *     footer  | wide   → logotype (mark + text)
 *   Pass `kind` only when overriding the default for a specific reason.
 *
 * ARIA contract (DESIGN_SYSTEM.md §6):
 *   decorative=true  → aria-hidden="true" on the wrapper + alt="" on <img>.
 *                      Use when the organisation name is visible in adjacent text.
 *   decorative=false → alt from i18n (or the alt prop) on <img>.
 *                      A linked logo must NOT be decorative — WCAG 2.4.4 / 1.1.1.
 *
 * DARK MODE — tone='auto' (D-20 selector contract):
 *   logo kind     → logo_red_small (SCARLET ring + white interior on dark bg)
 *   logotype kind → logotype_red_web (no _small variant exists; WCAG exemption for
 *                   decorative logo at 2.5:1 on dark; documented in DESIGN_SYSTEM.md §1)
 *
 * SIZE TOKENS: sm=32px, md=48px, lg=64px, xl=96px
 *   These control the rendered HEIGHT of the logo element. For the mark (`kind='logo'`),
 *   width = height (nearly-square content, 0.86:1 ratio). For the logotype, width is
 *   computed automatically from the tight viewBox aspect ratio (3.44:1), so the
 *   wordmark fills the token height exactly.
 *
 * LOGOTYPE SVG DERIVATIVES (des-2):
 *   logotype_red_web.svg / logotype_black_web.svg carry the same path data as
 *   their originals but use a tight viewBox (113.27 322.70 594.58 175.65).
 *   Measured with Chromium getBBox: content x=115.27 y=324.70 w=590.58 h=171.65;
 *   1-unit margin added. At `md` (48 px height) the wordmark renders at 48 px tall.
 *   The originals (square viewBox) are kept for provenance; never use them directly
 *   in this component.
 *
 * CLEAR SPACE (DESIGN_SYSTEM.md §1):
 *   --logo-clear-space (0.5rem) is applied as padding on the wrapper span.
 *
 * LOGO MARK VIEWBOX JUSTIFICATION:
 *   logo_red / logo_black content occupies 73.4 % of canvas height (getBBox:
 *   h=603.27 / canvas=821.11). At `md` (48 px), effective mark = 35 px — readable.
 *   The ~7 px empty margin per side at md is within the --logo-clear-space range,
 *   so no tight-viewBox derivative is needed for the mark.
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";

import logoBlackSmallSrc from "@/assets/brand/logo_black_small.svg";
import logoBlackSrc from "@/assets/brand/logo_black.svg";
import logoRedSmallSrc from "@/assets/brand/logo_red_small.svg";
import logoRedSrc from "@/assets/brand/logo_red.svg";
import logotypeBlackWebSrc from "@/assets/brand/logotype_black_web.svg";
import logotypeRedWebSrc from "@/assets/brand/logotype_red_web.svg";
import { themeController } from "@/features/theme/themeRuntime";
import {
  resolveLogoVariant,
  type LogoContext,
  type LogoKind
} from "./resolveLogoVariant";

/**
 * BrandLogo props.
 *
 * context   — REQUIRED. The placement context that drives kind via the
 *             brandbook usage rule. Provide this instead of setting kind
 *             manually:
 *               'header'  | 'compact' → logo mark
 *               'footer'  | 'wide'    → logotype
 *
 * kind      — Optional explicit override. Use only when the brandbook rule
 *             must be overridden for a specific justified reason.
 *
 * tone      — 'red' (SCARLET mark), 'black' (NERO/black mark, light surfaces
 *             only), 'auto' (picks red in light, red_small in dark for logo;
 *             always red for logotype).
 *
 * size      — Token label: sm | md | lg | xl (32 / 48 / 64 / 96 px height).
 *
 * decorative — true hides the whole component from AT via aria-hidden.
 *
 * alt       — Overrides the default i18n accessible name.
 */
interface Props {
  context: LogoContext;
  kind?: LogoKind;
  tone?: "red" | "black" | "auto";
  size?: "sm" | "md" | "lg" | "xl";
  decorative?: boolean;
  alt?: string;
}

const props = withDefaults(defineProps<Props>(), {
  tone: "auto",
  size: "md",
  decorative: false
});

const { t } = useI18n();

/**
 * The effective kind: uses the explicit override if provided, otherwise
 * applies the brandbook usage rule via resolveLogoVariant(context).
 */
const resolvedKind = computed<LogoKind>(() => {
  return props.kind ?? resolveLogoVariant(props.context);
});

/**
 * Resolve the correct SVG asset URL from kind, tone, and current theme.
 *
 * Logotype → tight-viewBox web derivatives (logotype_*_web.svg).
 *   These carry identical path data with viewBox 113.27 322.70 594.58 175.65,
 *   correcting the broken proportions of the original square-canvas files.
 *
 * Tone mapping:
 *   'red'   → always SCARLET variant
 *   'black' → always NERO/black variant
 *   'auto'  → light: red
 *              dark + logo:     red_small (SCARLET ring + white interior;
 *                visible on the dark surface without CSS filter)
 *              dark + logotype: red_web (no small logotype variant in assets)
 */
const resolvedSrc = computed<string>(() => {
  const isDark = themeController.theme.value === "dark";

  if (resolvedKind.value === "logotype") {
    // Always use tight-viewBox web derivatives for logotype.
    // No logotype small variant exists; always use red for auto dark mode.
    return props.tone === "black" ? logotypeBlackWebSrc : logotypeRedWebSrc;
  }

  if (props.tone === "auto") {
    // Dark: _small has white interior on the SCARLET shape — visible on
    // dark surfaces without any CSS filter or inversion hack.
    // Light: standard red variant.
    return isDark ? logoRedSmallSrc : logoRedSrc;
  }
  if (props.tone === "black") return logoBlackSrc;
  return logoRedSrc;
});

/**
 * Resolve the accessible name for the <img> element.
 *
 *   decorative=true  → '' (hidden from AT)
 *   alt prop present → caller-supplied override
 *   default          → t('brand.logoLabel') — organisation name, all locales
 */
const resolvedAlt = computed<string>(() => {
  if (props.decorative) return "";
  if (props.alt !== undefined) return props.alt;
  return t("brand.logoLabel");
});
</script>

<style scoped>
/*
  Clear-space token (DESIGN_SYSTEM.md §1, T-008):
    --logo-clear-space: 0.5rem (8 px at 16 px base scale)
  Derived from the body-text x-height approximation. The brandbook mandates
  "equal clear space on all sides" without a numeric value; this token provides
  the minimum in all layout contexts. Callers may override via CSS custom property.
*/

.brand-logo {
  --logo-clear-space: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--logo-clear-space);
  flex-shrink: 0;
}

/* Size tokens — token labels only; do not accept raw pixel values via props */
.brand-logo--sm {
  --logo-size: 32px;
}

.brand-logo--md {
  --logo-size: 48px;
}

.brand-logo--lg {
  --logo-size: 64px;
}

.brand-logo--xl {
  --logo-size: 96px;
}

/*
  Logo mark: nearly-square content (getBBox aspect 0.86:1).
  Both height and width are set to --logo-size; the slight portrait ratio
  is absorbed by object-fit: contain within the square box. Content at `md`
  (48 px) renders the mark at ~35 px effective height — acceptable for header.
*/
.brand-logo--logo .brand-logo__img {
  display: block;
  height: var(--logo-size, 48px);
  width: var(--logo-size, 48px);
  object-fit: contain;
}

/*
  Logotype (des-2 fix): the tight-viewBox web derivative has aspect ratio
  3.44:1 (measured Chromium getBBox: w=590.58, h=171.65). Setting height to
  --logo-size and width to auto lets the browser compute the correct width
  from the SVG aspect ratio, making the wordmark fill the token height exactly.

  At md (48 px):  width ≈ 165 px, text ~48 px tall
  At lg (64 px):  width ≈ 220 px, text ~64 px tall
  At xl (96 px):  width ≈ 330 px, text ~96 px tall
*/
.brand-logo--logotype .brand-logo__img {
  display: block;
  height: var(--logo-size, 48px);
  width: auto;
  max-width: none;
}
</style>
