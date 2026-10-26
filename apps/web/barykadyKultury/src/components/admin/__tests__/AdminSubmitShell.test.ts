import { describe, expect, it } from "vitest";

import { mountWithPlugins } from "@/test-utils/mount";

import AdminSubmitShell from "../AdminSubmitShell.vue";

/**
 * T-048 — the one sanctioned cross-entity presentation abstraction.
 *
 * The shell owns submit chrome only (heading, feedback, mode-conditional
 * section slots, action bar). Mutation paths stay in each feature's data
 * module, so this component has no Supabase import and cannot become a
 * generic form framework (architector boundary in the ticket).
 */

const BASE = {
  mode: "project" as const,
  heading: "Project editor"
};

describe("AdminSubmitShell", () => {
  it("renders the heading, intro and default fields slot", async () => {
    const wrapper = await mountWithPlugins(AdminSubmitShell, {
      props: { ...BASE, intro: "Edit the project." },
      slots: { default: '<p data-testid="fields">fields</p>' }
    });

    expect(wrapper.get("h1").text()).toBe("Project editor");
    expect(wrapper.text()).toContain("Edit the project.");
    expect(wrapper.get('[data-testid="fields"]').text()).toBe("fields");
    expect(
      wrapper.get('[data-testid="admin-submit-shell"]').attributes("data-mode")
    ).toBe("project");
  });

  it("shows only the section registered for the current mode", async () => {
    const project = await mountWithPlugins(AdminSubmitShell, {
      props: BASE,
      slots: {
        "project-extra": '<p data-testid="project-extra">cover</p>',
        "publication-extra": '<p data-testid="publication-extra">source</p>',
        "event-extra": '<p data-testid="event-extra">mapping</p>'
      }
    });

    expect(project.find('[data-testid="project-extra"]').exists()).toBe(true);
    expect(project.find('[data-testid="publication-extra"]').exists()).toBe(
      false
    );
    expect(project.find('[data-testid="event-extra"]').exists()).toBe(false);

    const publication = await mountWithPlugins(AdminSubmitShell, {
      props: { ...BASE, mode: "publication" },
      slots: {
        "project-extra": '<p data-testid="project-extra">cover</p>',
        "publication-extra": '<p data-testid="publication-extra">source</p>'
      }
    });

    expect(publication.find('[data-testid="publication-extra"]').exists()).toBe(
      true
    );
    expect(publication.find('[data-testid="project-extra"]').exists()).toBe(
      false
    );
  });

  it("renders the actions slot and a pending label without disabling the contract", async () => {
    const wrapper = await mountWithPlugins(AdminSubmitShell, {
      props: { ...BASE, pending: true },
      slots: { actions: '<button data-testid="save">Save</button>' }
    });

    expect(wrapper.get('[data-testid="save"]').text()).toBe("Save");
    expect(
      wrapper.get('[data-testid="admin-submit-shell"]').attributes("aria-busy")
    ).toBe("true");
  });

  it("announces status and error feedback with the correct roles", async () => {
    const wrapper = await mountWithPlugins(AdminSubmitShell, {
      props: { ...BASE, statusMessage: "Saved.", errorMessage: "Denied." }
    });

    expect(wrapper.get('[data-testid="shell-status"]').attributes("role")).toBe(
      "status"
    );
    expect(wrapper.get('[data-testid="shell-status"]').text()).toBe("Saved.");
    expect(wrapper.get('[data-testid="shell-error"]').attributes("role")).toBe(
      "alert"
    );
    expect(wrapper.get('[data-testid="shell-error"]').text()).toBe("Denied.");
  });

  it("renders a real form in submit mode and emits one submit (Enter works)", async () => {
    const wrapper = await mountWithPlugins(AdminSubmitShell, {
      props: { ...BASE, submitMode: true },
      slots: { actions: '<button type="submit">Save</button>' }
    });

    expect(wrapper.find("form").exists()).toBe(true);
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("submit")).toHaveLength(1);
  });

  it("renders a non-form container for the event mapping mode", async () => {
    const wrapper = await mountWithPlugins(AdminSubmitShell, {
      props: { ...BASE, mode: "event" }
    });

    expect(wrapper.find("form").exists()).toBe(false);
    expect(
      wrapper.get('[data-testid="admin-submit-shell"]').element.tagName
    ).toBe("DIV");
  });

  it("can suppress the heading when the shell is hosted inside a tabbed page", async () => {
    const wrapper = await mountWithPlugins(AdminSubmitShell, {
      props: { ...BASE, showHeading: false }
    });

    expect(wrapper.find("h1").exists()).toBe(false);
  });
});
