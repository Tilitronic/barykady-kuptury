import { QSlider, Quasar } from "quasar";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";

import ReaderControls from "../ReaderControls.vue";
import { DEFAULT_READER_SETTINGS } from "../readerSettings";
import { createTestI18n } from "@/test-utils/mount";

/**
 * T-040 (D-34) — reading controls on Quasar accessible primitives:
 * QOptionGroup radiogroups for exclusive steps, QSlider paired with −/+
 * buttons (WCAG 2.5.7), labeled, announced, reset.
 */

async function mountControls(settings = DEFAULT_READER_SETTINGS) {
  return mount(ReaderControls, {
    props: { settings },
    global: { plugins: [Quasar, createTestI18n("en")] }
  });
}

describe("ReaderControls", () => {
  it("is a labelled group with the four control sections", async () => {
    const wrapper = await mountControls();

    expect(
      wrapper.get('[data-testid="reader-controls"]').attributes("aria-label")
    ).toBe("Reading settings");
    expect(wrapper.text()).toContain("Text size");
    expect(wrapper.text()).toContain("Line width");
    expect(wrapper.text()).toContain("Line spacing");
    expect(wrapper.text()).toContain("Paragraph spacing");
  });

  it("renders text-size radios in a radiogroup with the selected one checked", async () => {
    // D-34: QOptionGroup gives real radiogroup semantics (role=radiogroup +
    // role=radio + aria-checked), which is what assistive tech reads — assert
    // that contract, not the hidden native input.
    const wrapper = await mountControls();

    const group = wrapper.get(
      '[data-testid="control-text-size"] [role="radiogroup"]'
    );
    expect(group.findAll('[role="radio"]')).toHaveLength(4);
    const checked = wrapper.findAll(
      '[data-testid="control-text-size"] [role="radio"][aria-checked="true"]'
    );
    expect(checked).toHaveLength(1);
    // Step 0 is the 16 px baseline; the default reads "Normal".
    expect(checked[0]!.attributes("aria-label")).toBe("Normal");
    expect(wrapper.text()).toContain("Normal");
  });

  it("emits step changes for the sliders' paired buttons", async () => {
    const wrapper = await mountControls();

    const increase = wrapper.get(
      '[data-testid="control-line-spacing"] button[aria-label*="Increase"]'
    );
    await increase.trigger("click");

    const emitted = wrapper.emitted("update")?.at(-1)?.[0] as Record<
      string,
      unknown
    >;
    expect(emitted).toMatchObject({ lineSpacing: 1 });
  });

  it("announces changes politely without moving focus", async () => {
    const wrapper = await mountControls();

    const live = wrapper.get('[data-testid="controls-status"]');
    expect(live.attributes("aria-live")).toBe("polite");

    const plus = wrapper.get(
      '[data-testid="control-paragraph-spacing"] button[aria-label*="Increase"]'
    );
    await plus.trigger("click");

    expect(live.text()).toContain("Paragraph spacing");
  });

  it("emits reset when the reset control is activated", async () => {
    const wrapper = await mountControls({
      ...DEFAULT_READER_SETTINGS,
      textSize: 2
    });

    await wrapper.get('[data-testid="control-reset"]').trigger("click");

    expect(wrapper.emitted("reset")).toHaveLength(1);
  });

  it("pairs each slider with a label describing its value", async () => {
    const wrapper = await mountControls();

    const slider = wrapper.get('[data-testid="control-measure"]');
    expect(slider.text()).toContain("Medium");
  });

  it("drags apply live but persist only on release (rev-1 F)", async () => {
    const wrapper = await mountControls();

    // The component instance (not the DOM wrapper) to drive Quasar events.
    const slider = wrapper.findComponent(QSlider);

    // Drag frame: live update, no commit.
    slider.vm.$emit("update:model-value", 2);
    await nextTick();
    expect(wrapper.emitted("update")).toHaveLength(1);
    expect(wrapper.emitted("commit") ?? []).toHaveLength(0);

    // Release: the committed value carries the final step.
    slider.vm.$emit("change", 2);
    await nextTick();
    const committed = wrapper.emitted("commit");
    expect(committed).toHaveLength(1);
    expect(committed?.[0]?.[0]).toEqual(
      expect.objectContaining({ lineSpacing: 2 })
    );
  });

  it("exposes word-valued aria-valuetext and no raw slider labels (rev-1 F)", async () => {
    const wrapper = await mountControls();

    // Quasar routes the ARIA attrs onto the role=slider element itself.
    const handle = wrapper.get(
      '[data-testid="control-line-spacing"] [role="slider"]'
    );
    expect(handle.attributes("aria-valuetext")).toBe("Standard");
    expect(wrapper.find(".q-slider__text").exists()).toBe(false);
  });

  it("discrete controls commit immediately", async () => {
    const wrapper = await mountControls();

    const increase = wrapper.get(
      '[data-testid="control-line-spacing"] button[aria-label*="Increase"]'
    );
    await increase.trigger("click");

    expect(wrapper.emitted("update")).toHaveLength(1);
    expect(wrapper.emitted("commit")).toHaveLength(1);
  });
});
