/**
 * T-008 — BrandLogo component tests + resolveLogoVariant unit tests.
 *
 * Review findings applied (des-2 + rev-2):
 *   des-2: logotype proportions fixed via tight-viewBox derivatives;
 *          regression test asserts the logotype viewBox is not square and
 *          aspect ratio matches the measured content bbox (≈ 3.44:1).
 *   rev-2: `context` is now a required prop that drives `kind` via
 *          resolveLogoVariant; tests prove the default kind is context-driven.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import BrandLogo from "@/components/brand/BrandLogo.vue";
import {
  resolveLogoVariant,
  type LogoContext
} from "@/components/brand/resolveLogoVariant";
import { themeController } from "@/features/theme/themeRuntime";
import { createTestI18n } from "@/test-utils/mount";

// ─── Shared mount helper ──────────────────────────────────────────────────────

interface MountLogoOptions {
  context?: LogoContext;
  kind?: "logo" | "logotype";
  tone?: "red" | "black" | "auto";
  size?: "sm" | "md" | "lg" | "xl";
  decorative?: boolean;
  alt?: string;
  locale?: "en" | "pl" | "uk";
}

/**
 * Mount BrandLogo with a full set of plugins.
 * `context` defaults to 'header' for tests that only care about other props.
 * By destructuring context separately we always pass a concrete LogoContext to
 * mount(), satisfying TypeScript's exactOptionalPropertyTypes requirement.
 */
function mountLogo({
  context = "header" as LogoContext,
  locale = "en",
  ...rest
}: MountLogoOptions = {}) {
  return mount(BrandLogo, {
    props: { context, ...rest },
    global: { plugins: [createTestI18n(locale)] }
  });
}

// ─── 1. Context prop drives kind (rev-2) ──────────────────────────────────────

describe("BrandLogo — context prop structurally enforces the usage rule (rev-2)", () => {
  it("renders logo mark for 'header' context by default (no kind override)", () => {
    const wrapper = mountLogo({ context: "header" });
    expect(wrapper.get("img").attributes("src")).toContain("logo_red");
    expect(wrapper.get("img").attributes("src")).not.toContain("logotype");
    expect(wrapper.classes()).toContain("brand-logo--logo");
  });

  it("renders logo mark for 'compact' context by default", () => {
    const wrapper = mountLogo({ context: "compact" });
    expect(wrapper.get("img").attributes("src")).toContain("logo_red");
    expect(wrapper.classes()).toContain("brand-logo--logo");
  });

  it("renders logotype for 'footer' context by default", () => {
    const wrapper = mountLogo({ context: "footer" });
    expect(wrapper.get("img").attributes("src")).toContain("logotype_red");
    expect(wrapper.classes()).toContain("brand-logo--logotype");
  });

  it("renders logotype for 'wide' context by default", () => {
    const wrapper = mountLogo({ context: "wide" });
    expect(wrapper.get("img").attributes("src")).toContain("logotype_red");
    expect(wrapper.classes()).toContain("brand-logo--logotype");
  });

  it("kind prop overrides the context-driven default when explicitly provided", () => {
    // Explicit override: header context but logotype forced
    const wrapper = mountLogo({ context: "header", kind: "logotype" });
    expect(wrapper.get("img").attributes("src")).toContain("logotype_red");
    expect(wrapper.classes()).toContain("brand-logo--logotype");
  });

  it("kind prop override: footer context but logo mark forced", () => {
    const wrapper = mountLogo({ context: "footer", kind: "logo" });
    expect(wrapper.get("img").attributes("src")).toContain("logo_red");
    expect(wrapper.classes()).toContain("brand-logo--logo");
  });
});

// ─── 2. Variant → src mapping ─────────────────────────────────────────────────

describe("BrandLogo — variant→src mapping", () => {
  it("renders the red logotype web SVG for footer contexts", () => {
    const wrapper = mountLogo({ context: "footer", tone: "red" });
    const src = wrapper.get("img").attributes("src")!;
    expect(src).toContain("logotype_red");
    // Must be the tight-viewBox web derivative, not the square original
    expect(src).toContain("logotype_red_web");
  });

  it("renders the black logotype web SVG when context=footer, tone=black", () => {
    const wrapper = mountLogo({ context: "footer", tone: "black" });
    expect(wrapper.get("img").attributes("src")).toContain(
      "logotype_black_web"
    );
  });

  it("renders the red logo mark SVG for header contexts", () => {
    const wrapper = mountLogo({ context: "header", tone: "red" });
    const src = wrapper.get("img").attributes("src")!;
    expect(src).toContain("logo_red");
    expect(src).not.toContain("logotype");
  });

  it("renders the black logo mark SVG when context=header, tone=black", () => {
    const wrapper = mountLogo({ context: "header", tone: "black" });
    const src = wrapper.get("img").attributes("src")!;
    expect(src).toContain("logo_black");
    expect(src).not.toContain("logotype");
  });

  it("defaults to logo kind and auto tone for header context", () => {
    const wrapper = mountLogo({ context: "header" });
    const src = wrapper.get("img").attributes("src")!;
    // auto + light theme → red variant
    expect(src).toContain("logo_red");
    expect(src).not.toContain("logotype");
  });

  it("renders the correct size class modifier", () => {
    const wrapper = mountLogo({ context: "header", size: "lg" });
    expect(wrapper.classes()).toContain("brand-logo--lg");
  });

  it("applies the md size class by default", () => {
    const wrapper = mountLogo({ context: "header" });
    expect(wrapper.classes()).toContain("brand-logo--md");
  });
});

// ─── 2b. Dark-mode logotype derivative (brand-fixes v3) ──────────────────────
//
// WHY: the header now shows the full logotype as a prominent readable
// wordmark. SCARLET-on-NERO is 2.5:1 (DESIGN_SYSTEM.md §1: forbidden for
// text), so tone='auto' must switch the logotype to the GRAY93
// derived-inverse asset (logotype_gray93_web.svg) in dark mode — an asset
// recolour, not a CSS filter hack.

describe("BrandLogo — auto tone in dark theme (logotype derivative)", () => {
  /** Run `body` with the controller pinned to the dark resolved theme. */
  function withTheme<T>(theme: "light" | "dark", body: () => T): T {
    themeController.setOverride(theme);
    try {
      return body();
    } finally {
      // Restore "follow the system" so later tests see the light default.
      themeController.setOverride(null);
    }
  }

  it("renders the GRAY93 logotype derivative for auto tone + logotype kind", () => {
    withTheme("dark", () => {
      const wrapper = mountLogo({ context: "footer" });
      expect(wrapper.get("img").attributes("src")).toContain(
        "logotype_gray93_web"
      );
    });
  });

  it("keeps the SCARLET logotype in light theme", () => {
    withTheme("light", () => {
      const wrapper = mountLogo({ context: "footer" });
      expect(wrapper.get("img").attributes("src")).toContain(
        "logotype_red_web"
      );
    });
  });

  it("honours an explicit tone override even in dark theme (red stays red)", () => {
    withTheme("dark", () => {
      const wrapper = mountLogo({ context: "footer", tone: "red" });
      expect(wrapper.get("img").attributes("src")).toContain(
        "logotype_red_web"
      );
    });
  });

  it("the logo MARK dark behaviour is unchanged (red_small ring variant)", () => {
    withTheme("dark", () => {
      const wrapper = mountLogo({ context: "compact" });
      expect(wrapper.get("img").attributes("src")).toContain("logo_red_small");
    });
  });
});

// ─── 3. Logotype viewBox regression (des-2) ───────────────────────────────────
//
// WHY: the original logotype SVGs had a square viewBox (821.11 × 821.11) while
// the content is only ~20 % of canvas height, making the wordmark render at ~13 px
// at the 'lg' token. Tight-viewBox web derivatives were created; this test prevents
// regression back to a square (or non-content-matching) viewBox.
//
// Measured content bbox (Chromium getBBox, headless Chromium):
//   logotype_red / logotype_black: x=115.27, y=324.70, w=590.58, h=171.65
//   aspect ratio (w/h) = 3.4406
//
// The web derivatives use viewBox="113.27 322.70 594.58 175.65" (1-unit margin).
// At size=md (48 px height): rendered wordmark height = 48 px (correct).
// At size=lg (64 px height): rendered wordmark height = 64 px (correct).

const ASSET_DIR = join(process.cwd(), "src/assets/brand");

/**
 * Parse viewBox from an SVG file and return as a number array [x, y, w, h].
 */
function parseViewBox(filePath: string): [number, number, number, number] {
  const svg = readFileSync(filePath, "utf-8");
  const match = /viewBox="([^"]+)"/.exec(svg);
  if (!match?.[1]) throw new Error(`No viewBox found in ${filePath}`);
  const parts = match[1].split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some(isNaN))
    throw new Error(`Invalid viewBox in ${filePath}: ${match[1]}`);
  return parts as [number, number, number, number];
}

describe("logotype web derivative — viewBox regression (des-2)", () => {
  it("logotype_red_web.svg viewBox is NOT square (tight viewBox applied)", () => {
    const [, , w, h] = parseViewBox(join(ASSET_DIR, "logotype_red_web.svg"));
    // Must not be a square viewBox — the original broken value was 821.11 × 821.11
    expect(w).not.toBeCloseTo(h, 0);
  });

  it("logotype_black_web.svg viewBox is NOT square", () => {
    const [, , w, h] = parseViewBox(join(ASSET_DIR, "logotype_black_web.svg"));
    expect(w).not.toBeCloseTo(h, 0);
  });

  it("logotype_red_web.svg viewBox aspect ratio matches content bbox (≈ 3.44:1)", () => {
    const [, , w, h] = parseViewBox(join(ASSET_DIR, "logotype_red_web.svg"));
    const ratio = w / h;
    // Measured content ratio from Chromium: 3.4406 ± margin adjustment ≈ 3.38–3.50
    expect(ratio).toBeGreaterThan(3.3);
    expect(ratio).toBeLessThan(3.6);
  });

  it("logotype_black_web.svg viewBox aspect ratio matches content bbox (≈ 3.44:1)", () => {
    const [, , w, h] = parseViewBox(join(ASSET_DIR, "logotype_black_web.svg"));
    const ratio = w / h;
    expect(ratio).toBeGreaterThan(3.3);
    expect(ratio).toBeLessThan(3.6);
  });

  it("component uses logotype_*_web.svg (tight viewBox) for logotype kind, not the square originals", () => {
    // Mount with footer context (→ logotype) and verify the _web variant is used
    const wrapper = mountLogo({ context: "footer", tone: "red" });
    const src = wrapper.get("img").attributes("src")!;
    // Must end with 'logotype_red_web' not just 'logotype_red'
    expect(src).toContain("_web");
  });

  it("logotype_red_web.svg and logotype_black_web.svg have identical viewBoxes", () => {
    const vbRed = parseViewBox(join(ASSET_DIR, "logotype_red_web.svg"));
    const vbBlack = parseViewBox(join(ASSET_DIR, "logotype_black_web.svg"));
    expect(vbRed).toEqual(vbBlack);
  });

  it("logotype_gray93_web.svg (derived-inverse) keeps the identical tight viewBox", () => {
    const vbRed = parseViewBox(join(ASSET_DIR, "logotype_red_web.svg"));
    const vbGray = parseViewBox(join(ASSET_DIR, "logotype_gray93_web.svg"));
    expect(vbGray).toEqual(vbRed);
  });

  it("logotype_gray93_web.svg is a recolour only: GRAY93 fill rule, no SCARLET fill rule", () => {
    const svg = readFileSync(
      join(ASSET_DIR, "logotype_gray93_web.svg"),
      "utf-8"
    );
    expect(svg).toMatch(/fill:\s*#ededed/);
    expect(svg).not.toMatch(/fill:\s*#c60001/);
  });
});

// ─── 4. Accessibility ─────────────────────────────────────────────────────────

describe("BrandLogo — accessibility", () => {
  it("is aria-hidden when the name is adjacent (decorative=true)", () => {
    const wrapper = mountLogo({ context: "header", decorative: true });
    expect(wrapper.attributes("aria-hidden")).toBe("true");
    expect(wrapper.get("img").attributes("alt")).toBe("");
  });

  it("has a non-empty alt when not decorative (default)", () => {
    const wrapper = mountLogo({ context: "header" });
    const alt = wrapper.get("img").attributes("alt");
    expect(alt).toBeTruthy();
    expect(alt!.trim().length).toBeGreaterThan(0);
  });

  it("uses the organisation name as the accessible label (EN)", () => {
    const wrapper = mountLogo({ context: "header", locale: "en" });
    expect(wrapper.get("img").attributes("alt")).toBe("Barykady Kultury");
  });

  it("uses the organisation name as the accessible label (PL)", () => {
    const wrapper = mountLogo({ context: "header", locale: "pl" });
    expect(wrapper.get("img").attributes("alt")).toBe("Barykady Kultury");
  });

  it("uses the organisation name as the accessible label (UK)", () => {
    const wrapper = mountLogo({ context: "header", locale: "uk" });
    expect(wrapper.get("img").attributes("alt")).toBe("Barykady Kultury");
  });

  it("accepts an alt prop that overrides the i18n label", () => {
    const wrapper = mountLogo({ context: "header", alt: "Custom label" });
    expect(wrapper.get("img").attributes("alt")).toBe("Custom label");
  });

  it("a linked logo has a non-empty accessible name (decorative=false, default)", () => {
    const wrapper = mountLogo({ context: "header", decorative: false });
    const alt = wrapper.get("img").attributes("alt");
    expect(alt).toBeTruthy();
    expect(alt).not.toBe("");
  });

  it("has no aria-hidden when not decorative", () => {
    const wrapper = mountLogo({ context: "header", decorative: false });
    expect(wrapper.attributes("aria-hidden")).toBeUndefined();
  });
});

// ─── 5. No raw brand hex values in component source ──────────────────────────

describe("BrandLogo — no raw brand hex colours in template", () => {
  const COMPONENT_PATH = join(
    process.cwd(),
    "src/components/brand/BrandLogo.vue"
  );

  it("does not hardcode #C60001 (SCARLET) in the template", () => {
    const source = readFileSync(COMPONENT_PATH, "utf-8");
    expect(source).not.toMatch(/#c60001/i);
  });

  it("does not hardcode #262424 (NERO) in the template", () => {
    const source = readFileSync(COMPONENT_PATH, "utf-8");
    expect(source).not.toMatch(/#262424/i);
  });

  it("does not hardcode #EDEDED (GRAY93) in the template", () => {
    const source = readFileSync(COMPONENT_PATH, "utf-8");
    expect(source).not.toMatch(/#ededed/i);
  });
});

// ─── 6. resolveLogoVariant — usage rule unit tests ───────────────────────────

describe("resolveLogoVariant — brandbook usage rule", () => {
  const cases: Array<[LogoContext, "logo" | "logotype"]> = [
    ["header", "logo"],
    ["compact", "logo"],
    ["footer", "logotype"],
    ["wide", "logotype"]
  ];

  for (const [context, expected] of cases) {
    it(`returns '${expected}' for '${context}' context`, () => {
      expect(resolveLogoVariant(context)).toBe(expected);
    });
  }

  it("returns logo (mark) for compact contexts — space-efficient header placement", () => {
    expect(resolveLogoVariant("compact")).toBe("logo");
  });

  it("returns logotype (mark+text) for wide contexts — full brand presence in footer", () => {
    expect(resolveLogoVariant("wide")).toBe("logotype");
  });
});
