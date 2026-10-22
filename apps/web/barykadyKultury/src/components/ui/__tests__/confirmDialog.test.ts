import { describe, expect, it } from "vitest";
import { defineComponent, nextTick, ref } from "vue";

import { mountWithPlugins } from "@/test-utils/mount";

import UiConfirmDialog from "../UiConfirmDialog.vue";

/**
 * Spec axis: docs/tickets/T-027-admin-projects.md — "delete requires
 * confirmation, restores focus, and RLS permits only admins" and
 * docs/DESIGN_SYSTEM.md §6 (complete keyboard operation, no keyboard traps,
 * programmatic focus management).
 *
 * The dialog is the destructive-action seam: it must move focus into itself,
 * close on Escape, and return focus to the control that opened it so a keyboard
 * user is never stranded.
 */
const Harness = defineComponent({
  components: { UiConfirmDialog },
  setup() {
    const open = ref(false);
    const confirmations = ref(0);
    return { open, confirmations };
  },
  template: `
    <div>
      <button id="delete-trigger" type="button" @click="open = true">
        Delete project
      </button>
      <UiConfirmDialog
        v-model="open"
        title="Delete this project?"
        message="This cannot be undone."
        confirm-label="Delete"
        cancel-label="Cancel"
        @confirm="confirmations += 1"
      />
      <p id="confirm-count">{{ confirmations }}</p>
    </div>
  `
});

async function flush(): Promise<void> {
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 0));
}

/** Attach to the document so `document.activeElement` reflects focus. */
function mountHarness() {
  return mountWithPlugins(Harness, { attachTo: document.body });
}

/**
 * Focus the trigger (happy-dom does not move focus on click, unlike a real
 * browser), then open the dialog.
 */
async function openDialog(
  wrapper: Awaited<ReturnType<typeof mountHarness>>
): Promise<void> {
  const trigger = wrapper.get("#delete-trigger");
  (trigger.element as HTMLElement).focus();
  await trigger.trigger("click");
  await flush();
}

describe("UiConfirmDialog", () => {
  it("is absent until opened, then exposes a modal dialog", async () => {
    const wrapper = await mountHarness();

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);

    await openDialog(wrapper);

    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.attributes("aria-modal")).toBe("true");
    expect(dialog.text()).toContain("Delete this project?");
    expect(dialog.text()).toContain("This cannot be undone.");
  });

  it("moves focus into the dialog (cancel is the safe default)", async () => {
    const wrapper = await mountHarness();
    await openDialog(wrapper);

    expect(document.activeElement?.getAttribute("data-testid")).toBe(
      "confirm-cancel"
    );
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    const wrapper = await mountHarness();
    await openDialog(wrapper);

    await wrapper.get('[role="dialog"]').trigger("keydown", { key: "Escape" });
    await flush();

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(document.activeElement?.id).toBe("delete-trigger");
  });

  it("closes on cancel and restores focus without confirming", async () => {
    const wrapper = await mountHarness();
    await openDialog(wrapper);

    await wrapper.get('[data-testid="confirm-cancel"]').trigger("click");
    await flush();

    expect(wrapper.get("#confirm-count").text()).toBe("0");
    expect(document.activeElement?.id).toBe("delete-trigger");
  });

  it("confirms the destructive action and closes", async () => {
    const wrapper = await mountHarness();
    await openDialog(wrapper);

    await wrapper.get('[data-testid="confirm-accept"]').trigger("click");
    await flush();

    expect(wrapper.get("#confirm-count").text()).toBe("1");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it("keeps Tab inside the dialog (no keyboard trap escape)", async () => {
    const wrapper = await mountHarness();
    await openDialog(wrapper);

    // Tab from the last control wraps to the first instead of leaving the
    // dialog and landing on page chrome behind the modal.
    const accept = wrapper.get('[data-testid="confirm-accept"]');
    (accept.element as HTMLElement).focus();
    await accept.trigger("keydown", { key: "Tab" });

    expect(document.activeElement?.getAttribute("data-testid")).toBe(
      "confirm-cancel"
    );
  });
});
