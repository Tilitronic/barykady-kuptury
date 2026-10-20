import { describe, expect, it } from "vitest";
import { nextTick } from "vue";

import AboutPage from "@/pages/[locale]/about.vue";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * T-016 — About page content and fallback behavior.
 *
 * The page consumes `fetchPublishedPage` through the injected Supabase client,
 * renders the localized title as the only h1, and surfaces an explicit fallback
 * note when the requested translation is incomplete and the English version is
 * used instead.
 */
const EN_BODY = "## Mission\nExpand culture.";

const FULL_EN_BODY = `## Mission

To expand Ukrainian culture beyond borders and give it the space it deserves.

## History

The association was founded by Daria Yakovleva in Poznań.

## Values

- Identity
- Education
- Support
- Community

## Aims

The aims of the Association are:

- Cultural diplomacy: acting as a "cultural bridge" between Ukrainians, Poles, and the international community.
- Promotion and popularization of Ukrainian culture in Poland and worldwide.`;

function aboutRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000101",
    page_key: "about",
    status: "published",
    updated_at: "2026-01-05T12:00:00Z",
    site_page_translations: [
      {
        locale: "en",
        title: "About us",
        body: EN_BODY,
        meta_description: "About the association",
        needs_review: false
      }
    ],
    ...overrides
  };
}

async function mountAbout(
  supabase: ReturnType<typeof createFakeSupabase>["client"],
  locale: "en" | "pl" | "uk" = "en"
) {
  return mountWithPlugins(AboutPage, {
    locale,
    supabase,
    initialRoute: `/${locale}`
  });
}

describe("About page", () => {
  it("renders the mission for the active locale", async () => {
    const fake = createFakeSupabase({ tables: { site_pages: [aboutRow()] } });
    const wrapper = await mountAbout(fake.client, "en");

    await flushPromises();

    expect(wrapper.get("h1").text()).toBe("About us");
    expect(wrapper.text()).toContain("Expand culture");
  });

  it("shows a fallback note when only English exists", async () => {
    const fake = createFakeSupabase({ tables: { site_pages: [aboutRow()] } });
    const wrapper = await mountAbout(fake.client, "pl");

    await flushPromises();

    // The resolved fallback is English, so the page title comes from the EN
    // translation and a note names the source language.
    expect(wrapper.get("h1").text()).toBe("About us");
    expect(wrapper.text()).toContain("Expand culture");
    expect(wrapper.text()).toMatch(/po angielsku/i);
  });

  it("renders the localized title when the requested translation is complete", async () => {
    const fake = createFakeSupabase({
      tables: {
        site_pages: [
          aboutRow({
            site_page_translations: [
              {
                locale: "en",
                title: "About us",
                body: EN_BODY,
                meta_description: "About the association",
                needs_review: false
              },
              {
                locale: "pl",
                title: "O nas",
                body: "## Misja\nRozwijać kulturę.",
                meta_description: "O stowarzyszeniu",
                needs_review: false
              }
            ]
          })
        ]
      }
    });
    const wrapper = await mountAbout(fake.client, "pl");

    await flushPromises();

    expect(wrapper.get("h1").text()).toBe("O nas");
    expect(wrapper.text()).toContain("Rozwijać kulturę");
  });

  it("renders an intentional empty state when the page is absent", async () => {
    const fake = createFakeSupabase({ tables: { site_pages: [] } });
    const wrapper = await mountAbout(fake.client, "en");

    await flushPromises();

    expect(wrapper.text()).toContain("not available");
  });

  it("has exactly one h1 and ordered h2 sections from the body", async () => {
    const fake = createFakeSupabase({
      tables: {
        site_pages: [
          aboutRow({
            site_page_translations: [
              {
                locale: "en",
                title: "About us",
                body: FULL_EN_BODY,
                meta_description: "About the association",
                needs_review: false
              }
            ]
          })
        ]
      }
    });
    const wrapper = await mountAbout(fake.client, "en");

    await flushPromises();

    expect(wrapper.findAll("h1")).toHaveLength(1);

    const h2Texts = wrapper.findAll("h2").map(heading => heading.text());

    expect(h2Texts).toEqual(["Mission", "History", "Values", "Aims"]);
  });

  it("marks the rich-text prose with English lang when falling back", async () => {
    const fake = createFakeSupabase({
      tables: {
        site_pages: [
          aboutRow({
            site_page_translations: [
              {
                locale: "en",
                title: "About us",
                body: FULL_EN_BODY,
                meta_description: "About the association",
                needs_review: false
              },
              {
                locale: "pl",
                title: "O nas",
                body: null,
                meta_description: null,
                needs_review: true
              }
            ]
          })
        ]
      }
    });
    const wrapper = await mountAbout(fake.client, "pl");

    await flushPromises();

    const richText = wrapper.find(".localized-rich-text");
    expect(richText.attributes("lang")).toBe("en");
  });
});

async function flushPromises() {
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 0));
}
