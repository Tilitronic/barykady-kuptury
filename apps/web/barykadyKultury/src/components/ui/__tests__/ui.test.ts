import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { mountWithPlugins } from "@/test-utils/mount";

import UiBanner from "../UiBanner.vue";
import UiBtn from "../UiBtn.vue";
import UiCard from "../UiCard.vue";
import UiCardSection from "../UiCardSection.vue";
import UiCheckbox from "../UiCheckbox.vue";
import UiExpansionItem from "../UiExpansionItem.vue";
import UiForm from "../UiForm.vue";
import UiInput from "../UiInput.vue";
import UiItem from "../UiItem.vue";
import UiItemSection from "../UiItemSection.vue";
import UiList from "../UiList.vue";
import UiSelect from "../UiSelect.vue";
import UiSkeleton from "../UiSkeleton.vue";
import UiSlider from "../UiSlider.vue";
import UiTooltip from "../UiTooltip.vue";

/**
 * ui/ wrapper layer (queue item 2) — the app's only Quasar touchpoint.
 *
 * Two contracts are tested here:
 *  1. DOM identity: each wrapper renders the SAME Quasar markup as the raw
 *     component it wraps (class roots), so migrating call-sites can never
 *     restyle anything ("AdminImportPage: do not restyle" holds by
 *     construction).
 *  2. Brand defaults + pass-through: UiBtn carries the brand button variants
 *     (primary = unelevated scarlet via $primary, noCaps) while every
 *     attribute, event and slot the caller passes still lands on the Quasar
 *     component untouched.
 *
 * The final test is the migration gate: no application code outside
 * src/components/ui may import Quasar UI components or use q-* tags —
 * the ui/ layer is the single seam (Quasar-first stays, brand defaults live
 * in one place, future swaps touch one folder).
 */

describe("ui/ wrapper layer", () => {
  it("UiBtn defaults: brand primary (unelevated, no-caps) and label slot", async () => {
    const wrapper = await mountWithPlugins(UiBtn, {
      props: { label: "Save" }
    });
    const button = wrapper.get("button");
    expect(button.classes()).toContain("q-btn");
    // noCaps is the brand default: the label renders verbatim…
    expect(button.text()).toContain("Save");
    expect(wrapper.find(".q-btn--unelevated").exists()).toBe(true);
    // …and the caps transform never applies.
    expect(button.attributes("style") ?? "").not.toMatch(/uppercase/i);
  });

  it("UiBtn variants map to Quasar surfaces", async () => {
    const flat = await mountWithPlugins(UiBtn, { props: { variant: "flat" } });
    expect(flat.get("button").classes()).toContain("q-btn--flat");
    const outline = await mountWithPlugins(UiBtn, {
      props: { variant: "outline" }
    });
    expect(outline.get("button").classes()).toContain("q-btn--outline");
    const secondary = await mountWithPlugins(UiBtn, {
      props: { variant: "secondary" }
    });
    expect(secondary.get("button").classes()).toContain("q-btn--unelevated");
  });

  it("UiBtn passes attrs, events and type through untouched", async () => {
    const clicks: number[] = [];
    const wrapper = await mountWithPlugins(UiBtn, {
      // Undeclared props land in $attrs — exactly what the wrapper forwards.
      props: {
        variant: "flat",
        type: "submit",
        disabled: true,
        "data-testid": "x",
        onClick: () => clicks.push(1)
      },
      slots: { default: "Check" }
    });
    const button = wrapper.get("button");
    expect(button.attributes("type")).toBe("submit");
    expect(button.attributes("data-testid")).toBe("x");
    expect(button.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("Check");
    await button.trigger("click");
    // QBtn swallows clicks while disabled — the guard is the contract.
    expect(clicks).toEqual([]);
  });

  it("form controls render Quasar markup with the brand outlined default", async () => {
    const input = await mountWithPlugins(UiInput, {
      props: { modelValue: "a", label: "Title" }
    });
    expect(input.find(".q-input").exists()).toBe(true);
    expect(input.find(".q-field--outlined").exists()).toBe(true);

    const select = await mountWithPlugins(UiSelect, {
      props: { modelValue: "document", options: ["document", "publication"] }
    });
    expect(select.find(".q-select").exists()).toBe(true);
    expect(select.find(".q-field--outlined").exists()).toBe(true);

    const checkbox = await mountWithPlugins(UiCheckbox, {
      props: { modelValue: false, label: "Allow" }
    });
    expect(checkbox.find(".q-checkbox").exists()).toBe(true);
  });

  it("UiSlider/UiSkeleton/UiTooltip wrap their Quasar primitives", async () => {
    const slider = await mountWithPlugins(UiSlider, {
      props: { modelValue: 1, min: 0, max: 3 }
    });
    expect(slider.find(".q-slider").exists()).toBe(true);
    // Role survives the wrapper — the reader's keyboard contract depends on it.
    expect(slider.find('[role="slider"]').exists()).toBe(true);

    const skeleton = await mountWithPlugins(UiSkeleton, {
      props: { height: "1.75rem" }
    });
    expect(skeleton.find(".q-skeleton").exists()).toBe(true);

    const tooltip = await mountWithPlugins(UiTooltip, {
      slots: { default: "Hint" }
    });
    // QTooltip teleports to body only while shown; the wrapper must at least
    // mount cleanly and expose the Quasar component.
    expect(tooltip.findComponent({ name: "QTooltip" }).exists()).toBe(true);
  });

  it("list/item/section wrappers keep Quasar semantics (anchor tag included)", async () => {
    const list = await mountWithPlugins(UiList, {
      props: { tag: "ul", dense: true },
      slots: { default: "<li>row</li>" }
    });
    expect(list.find("ul.q-list").exists()).toBe(true);

    const item = await mountWithPlugins(UiItem, {
      props: { tag: "a", href: "#mission" },
      slots: { default: "Mission" }
    });
    const anchor = item.find("a.q-item");
    expect(anchor.exists()).toBe(true);
    expect(anchor.attributes("href")).toBe("#mission");

    const section = await mountWithPlugins(UiItemSection, {
      slots: { default: "text" }
    });
    expect(section.find(".q-item__section").exists()).toBe(true);
  });

  it("container wrappers (form/card/banner/expansion) render Quasar markup", async () => {
    const form = await mountWithPlugins(UiForm, {
      slots: { default: "<input>" }
    });
    expect(form.find("form").exists()).toBe(true);

    const card = await mountWithPlugins(UiCard, {
      props: { flat: true, bordered: true },
      slots: { default: "<div>body</div>" }
    });
    expect(card.find(".q-card").exists()).toBe(true);

    const cardSection = await mountWithPlugins(UiCardSection, {
      slots: { default: "body" }
    });
    expect(cardSection.find(".q-card__section").exists()).toBe(true);

    const banner = await mountWithPlugins(UiBanner, {
      props: { rounded: true },
      slots: { default: "Done" }
    });
    expect(banner.find(".q-banner").exists()).toBe(true);
    expect(banner.text()).toContain("Done");

    const expansion = await mountWithPlugins(UiExpansionItem, {
      props: { label: "Details", dense: true }
    });
    expect(expansion.find(".q-expansion-item").exists()).toBe(true);
  });
});

/**
 * Migration gate. Walks src (excluding ui/ itself, tests, and boot/ where
 * the Quasar *plugin* install legitimately lives) and fails on any direct
 * import of Quasar UI components or any <q-*> template tag. The Quasar
 * service objects (Quasar, Dark, Notify…) stay allowed in the theme boot
 * file — they are not UI components.
 */
describe("ui/ is the single Quasar seam", () => {
  const SRC = join(__dirname, "..", "..", "..");
  const ALLOWED_DIRS = [join("components", "ui"), "boot", "test-utils"];
  const SERVICE_IMPORTS = new Set(["Quasar", "Dark", "Notify", "LocalStorage"]);

  function* walk(dir: string): Generator<string> {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (entry === "__tests__" || entry === "node_modules") continue;
      if (statSync(full).isDirectory()) yield* walk(full);
      else if (/\.(vue|ts)$/.test(entry)) yield full;
    }
  }

  it("no application file imports Quasar UI components or uses q-* tags outside ui/", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = relative(SRC, file);
      if (ALLOWED_DIRS.some(dir => rel.startsWith(dir + "/") || rel === dir)) {
        continue;
      }
      const text = readFileSync(file, "utf8");
      const importMatch = /import\s*\{([^}]*)\}\s*from\s*"quasar"/u.exec(text);
      if (importMatch) {
        const names = (importMatch[1] ?? "")
          .split(",")
          .map(s => s.trim())
          .filter(Boolean);
        const ui = names.filter(n => !SERVICE_IMPORTS.has(n));
        if (ui.length > 0) offenders.push(`${rel}: imports ${ui.join(", ")}`);
      }
      if (/<q-[a-z]/u.test(text)) {
        offenders.push(`${rel}: raw <q-*> template tag`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
