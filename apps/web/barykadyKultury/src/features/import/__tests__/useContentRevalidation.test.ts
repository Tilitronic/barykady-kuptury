import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, ref } from "vue";
import { describe, expect, it, vi } from "vitest";

import { useContentRevalidation } from "../useContentRevalidation";

function harness(check: (kind: string, slug: string) => Promise<unknown>) {
  const slug = ref("statute");
  const state = {
    current: null as ReturnType<typeof useContentRevalidation> | null
  };

  const component = defineComponent({
    setup() {
      state.current = useContentRevalidation({
        kind: "document",
        slug,
        check: check as never
      });
      return () => null;
    }
  });

  return { component, slug, state };
}

describe("useContentRevalidation", () => {
  it("checks once after mount and exposes the update banner state", async () => {
    const check = vi.fn(async () => ({
      updateAvailable: true,
      jobId: "job-1"
    }));
    const { component, state } = harness(check);

    mount(component);
    await flushPromises();

    expect(check).toHaveBeenCalledWith("document", "statute");
    expect(state.current?.updateAvailable.value).toBe(true);
    expect(state.current?.jobId.value).toBe("job-1");
  });

  it("does not re-check the same slug", async () => {
    const check = vi.fn(async () => ({ updateAvailable: false }));
    const { component, state } = harness(check);

    mount(component);
    await flushPromises();
    await state.current?.checkNow();
    await state.current?.checkNow();

    expect(check).toHaveBeenCalledTimes(1);
  });

  it("fails silently", async () => {
    const check = vi.fn(async () => {
      throw new Error("endpoint down");
    });
    const { component, state } = harness(check);

    mount(component);
    await flushPromises();

    expect(state.current?.updateAvailable.value).toBe(false);
  });

  it("dismisses immediately and manages the applying state", async () => {
    const check = vi.fn(async () => ({ updateAvailable: true }));
    const { component, state } = harness(check);

    mount(component);
    await flushPromises();

    state.current?.dismiss();
    expect(state.current?.updateAvailable.value).toBe(false);

    let release: () => void = () => undefined;
    const run = new Promise<void>(resolve => {
      release = resolve;
    });
    const applying = state.current?.applyUpdate(async () => run);
    expect(state.current?.applying.value).toBe(true);
    release();
    await applying;
    expect(state.current?.applying.value).toBe(false);
  });
});
