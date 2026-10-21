import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderBlocks, renderRichText } from "@/shared/content/richText";
import LocalizedRichText from "@/components/content/LocalizedRichText.vue";

vi.mock("@/shared/content/richText", async importOriginal => {
  const actual =
    await importOriginal<typeof import("@/shared/content/richText")>();
  return {
    ...actual,
    renderRichText: vi.fn(actual.renderRichText),
    renderBlocks: vi.fn(actual.renderBlocks)
  };
});

const renderRichTextMock = vi.mocked(renderRichText);
const renderBlocksMock = vi.mocked(renderBlocks);

/**
 * T-044/F6: parsing is memoized in a computed keyed on the inputs that can
 * change the VNodes. Re-renders caused by unrelated props must not re-parse.
 */
describe("LocalizedRichText memoization", () => {
  beforeEach(() => {
    renderRichTextMock.mockClear();
    renderBlocksMock.mockClear();
  });

  it("parses once and does not re-parse on unrelated prop changes", async () => {
    const wrapper = mount(LocalizedRichText, {
      props: { content: "## Title\n\nBody text." }
    });

    expect(renderRichTextMock).toHaveBeenCalledTimes(1);

    // VTU's setProps type omits declared props for type-only defineComponent
    // props; the runtime prop contract is what is under test.
    await wrapper.setProps({ lang: "pl" } as never);
    await nextTick();
    expect(renderRichTextMock).toHaveBeenCalledTimes(1);

    await wrapper.setProps({ content: "## Other\n\nChanged." } as never);
    await nextTick();
    expect(renderRichTextMock).toHaveBeenCalledTimes(2);

    await wrapper.setProps({ headingOffset: 1 } as never);
    await nextTick();
    expect(renderRichTextMock).toHaveBeenCalledTimes(3);

    await wrapper.setProps({ newTabLabel: "opens in a new tab" } as never);
    await nextTick();
    expect(renderRichTextMock).toHaveBeenCalledTimes(4);
  });

  it("memoizes the pre-parsed blocks path", async () => {
    const blocks = [
      {
        kind: "paragraph" as const,
        children: [{ kind: "text" as const, value: "Body" }]
      }
    ];

    const wrapper = mount(LocalizedRichText, {
      props: { blocks }
    });

    expect(renderBlocksMock).toHaveBeenCalledTimes(1);
    expect(renderRichTextMock).not.toHaveBeenCalled();

    await wrapper.setProps({ lang: "uk" } as never);
    await nextTick();
    expect(renderBlocksMock).toHaveBeenCalledTimes(1);

    await wrapper.setProps({
      blocks: [
        {
          kind: "paragraph",
          children: [{ kind: "text", value: "Changed" }]
        }
      ]
    } as never);
    await nextTick();
    expect(renderBlocksMock).toHaveBeenCalledTimes(2);
  });
});
