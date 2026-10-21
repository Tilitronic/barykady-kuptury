import { QSlider, Quasar } from "quasar";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";

import ReaderControls from "../ReaderControls.vue";
import { DEFAULT_READER_SETTINGS } from "../readerSettings";
import { createTestI18n } from "@/test-utils/mount";

/**
 * Header-lane follow-up on T-040 (D-34): ALL step controls use ONE primitive
 * — a QSlider with ruler ticks plus a grouped −/+ button pair to its RIGHT
 * (never straddling the slider). Paragraph spacing is gone: the control and
 * its setting no longer exist.
 *
 * The contract kept from D-34: draggable slider (arrows), coarse button path
 * (WCAG 2.5.7), word-valued aria-valuetext, polite announcements without
 * focus movement, live-drag/commit-on-release persistence split.
 */

const SECTIONS = [
  "control-text-size",
  "control-measure",
  "control-line-spacing"
] as const;

async function mountControls(settings = DEFAULT_READER_SETTINGS) {
  return mount(ReaderControls, {
    props: { settings },
    global: { plugins: [Quasar, createTestI18n("en")] }
  });
}

function section(
  wrapper: Awaited<ReturnType<typeof mountControls>>,
  id: string
) {
  return wrapper.get(`[data-testid="${id}"]`);
}

describe("ReaderControls — unified stepper sliders", () => {
  it("renders the three stepper controls and no paragraph-spacing control", async () => {
    const wrapper = await mountControls();

    expect(
      wrapper.get('[data-testid="reader-controls"]').attributes("aria-label")
    ).toBe("Reading settings");
    expect(wrapper.text()).toContain("Text size");
    expect(wrapper.text()).toContain("Line width");
    expect(wrapper.text()).toContain("Line spacing");

    expect(wrapper.text()).not.toContain("Paragraph spacing");
    expect(
      wrapper.find('[data-testid="control-paragraph-spacing"]').exists()
    ).toBe(false);
  });

  it("pairs every slider with both step buttons grouped to its RIGHT", async () => {
    const wrapper = await mountControls();

    for (const id of SECTIONS) {
      const html = section(wrapper, id).html();
      const sliderAt = html.indexOf('role="slider"');
      const minusAt = html.indexOf("Decrease");
      const plusAt = html.indexOf("Increase");

      expect(sliderAt, `${id}: has a slider`).toBeGreaterThan(-1);
      // Both buttons come after the slider in DOM order (visually docked
      // right via flex), and − precedes + inside the group.
      expect(minusAt, `${id}: − right of the slider`).toBeGreaterThan(sliderAt);
      expect(plusAt, `${id}: + right of the slider`).toBeGreaterThan(minusAt);
    }
  });

  it("shows a ruler of per-step ticks with visible min/max labels", async () => {
    const wrapper = await mountControls();

    const ticks = (id: string) =>
      section(wrapper, id).findAll(".reader-controls__tick");

    expect(ticks("control-text-size")).toHaveLength(4);
    expect(ticks("control-measure")).toHaveLength(3);
    expect(ticks("control-line-spacing")).toHaveLength(4);

    // Rulers are decorative; the words are the labels sighted users match
    // against the slider bubble/announcement.
    expect(section(wrapper, "control-text-size").text()).toContain("Normal");
    expect(section(wrapper, "control-text-size").text()).toContain("Maximum");
    expect(section(wrapper, "control-measure").text()).toContain("Narrow");
    expect(section(wrapper, "control-measure").text()).toContain("Wide");
    expect(section(wrapper, "control-line-spacing").text()).toContain(
      "Standard"
    );
    for (const id of SECTIONS) {
      expect(
        section(wrapper, id)
          .get(".reader-controls__ruler")
          .attributes("aria-hidden")
      ).toBe("true");
    }
  });

  it("exposes word-valued aria-valuetext and no raw slider labels (rev-1 F)", async () => {
    const wrapper = await mountControls();

    const valueText = (id: string) =>
      section(wrapper, id).get('[role="slider"]').attributes("aria-valuetext");

    expect(valueText("control-text-size")).toBe("Normal");
    expect(valueText("control-measure")).toBe("Medium");
    expect(valueText("control-line-spacing")).toBe("Standard");

    expect(wrapper.find(".q-slider__text").exists()).toBe(false);
  });

  it("mirrors the current value visibly next to each control", async () => {
    const wrapper = await mountControls({
      ...DEFAULT_READER_SETTINGS,
      textSize: 2,
      measure: "wide",
      lineSpacing: 1
    });

    expect(section(wrapper, "control-text-size").text()).toContain(
      "Extra large"
    );
    expect(section(wrapper, "control-measure").text()).toContain("Wide");
    expect(section(wrapper, "control-line-spacing").text()).toContain(
      "Relaxed"
    );
  });

  it("steps every control with the paired buttons and commits immediately", async () => {
    const wrapper = await mountControls();

    await section(wrapper, "control-text-size")
      .get('button[aria-label*="Increase"]')
      .trigger("click");
    await section(wrapper, "control-measure")
      .get('button[aria-label*="Increase"]')
      .trigger("click");
    await section(wrapper, "control-line-spacing")
      .get('button[aria-label*="Increase"]')
      .trigger("click");

    expect(wrapper.emitted("commit")).toHaveLength(3);
    const updates = wrapper.emitted("update") ?? [];
    expect(updates[0]?.[0]).toMatchObject({ textSize: 1 });
    expect(updates[1]?.[0]).toMatchObject({ measure: "wide" });
    expect(updates[2]?.[0]).toMatchObject({ lineSpacing: 1 });

    // At the bottom of a ruler the outward button is disabled, not broken.
    const disabled = await mountControls();
    expect(
      section(disabled, "control-line-spacing")
        .get('button[aria-label*="Decrease"]')
        .attributes("disabled")
    ).toBeDefined();
  });

  it("disables the outer buttons at the ends of each ruler", async () => {
    const wrapper = await mountControls({
      ...DEFAULT_READER_SETTINGS,
      textSize: 3,
      lineSpacing: 0
    });

    expect(
      section(wrapper, "control-text-size")
        .get('button[aria-label*="Increase"]')
        .attributes("disabled")
    ).toBeDefined();
    expect(
      section(wrapper, "control-line-spacing")
        .get('button[aria-label*="Decrease"]')
        .attributes("disabled")
    ).toBeDefined();
  });

  it("drags apply live but persist only on release (rev-1 F)", async () => {
    const wrapper = await mountControls();

    const slider = section(wrapper, "control-line-spacing").findComponent(
      QSlider
    );

    slider.vm.$emit("update:model-value", 2);
    await nextTick();
    expect(wrapper.emitted("update")).toHaveLength(1);
    expect(wrapper.emitted("commit") ?? []).toHaveLength(0);

    slider.vm.$emit("change", 2);
    await nextTick();
    const committed = wrapper.emitted("commit");
    expect(committed).toHaveLength(1);
    expect(committed?.[0]?.[0]).toEqual(
      expect.objectContaining({ lineSpacing: 2 })
    );
  });

  it("announces changes politely without moving focus", async () => {
    const wrapper = await mountControls();

    const live = wrapper.get('[data-testid="controls-status"]');
    expect(live.attributes("aria-live")).toBe("polite");

    await section(wrapper, "control-line-spacing")
      .get('button[aria-label*="Increase"]')
      .trigger("click");

    expect(live.text()).toContain("Line spacing");
  });

  it("emits reset when the reset control is activated", async () => {
    const wrapper = await mountControls({
      ...DEFAULT_READER_SETTINGS,
      textSize: 2
    });

    await wrapper.get('[data-testid="control-reset"]').trigger("click");

    expect(wrapper.emitted("reset")).toHaveLength(1);
  });
});
