import { describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, ref, type Ref } from "vue";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  useProject,
  useProjects,
  type ProjectSummaryView
} from "@/features/projects/useProjects";
import type { Locale } from "@/features/i18n/locales";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";
import type { ContentResult } from "@/shared/content/result";
import type { Database } from "@/types/database.types";

/**
 * Hook axis (T-019): both project hooks mirror `useDocuments` — loading first,
 * stale-guarded, locale-reactive — and are the seam where the cover public URL
 * is resolved, so `ProjectCard` and the detail page receive plain view-model
 * data and never touch the client (the rule the T-018 review enforced).
 */

type Client = SupabaseClient<Database> | null;
type ListingHook = { readonly result: Ref<ContentResult<ProjectSummaryView>> };

function projectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000201",
    status: "published",
    featured_rank: null,
    cover_path: "fixtures/projects/cover.webp",
    start_date: "2026-01-10",
    end_date: null,
    updated_at: "2026-02-01T00:00:00Z",
    project_translations: [
      {
        locale: "en",
        slug: "workshop",
        title: "Workshop (EN)",
        summary: "Summary",
        body: "Body"
      },
      {
        locale: "pl",
        slug: "warsztat",
        title: "Warsztat (PL)",
        summary: "Podsumowanie",
        body: "Treść"
      }
    ],
    ...overrides
  };
}

async function mountListingProbe(
  supabase: Client,
  locale: Locale = "en"
): Promise<{
  wrapper: Awaited<ReturnType<typeof mountWithPlugins>>;
  activeLocale: Ref<Locale>;
  hook: ListingHook;
}> {
  const activeLocale = ref<Locale>(locale);
  let hook!: ListingHook;

  const Probe = defineComponent({
    setup() {
      hook = useProjects(activeLocale);
      return () => h("div", hook.result.value.kind);
    }
  });

  const wrapper = await mountWithPlugins(Probe, {
    supabase,
    initialRoute: `/${locale}/projects`
  });

  return { wrapper, activeLocale, hook };
}

async function mountDetailProbe(
  supabase: Client,
  slug: string,
  locale: Locale = "en"
) {
  const activeSlug = ref(slug);
  const activeLocale = ref<Locale>(locale);
  let hook!: ListingHook;

  const Probe = defineComponent({
    setup() {
      hook = useProject(activeSlug, activeLocale);
      return () => h("div", hook.result.value.kind);
    }
  });

  const wrapper = await mountWithPlugins(Probe, {
    supabase,
    initialRoute: `/${locale}/projects/${slug}`
  });

  return { wrapper, activeLocale, hook };
}

async function flush() {
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe("useProjects", () => {
  it("starts loading, then resolves the listing with a cover URL", async () => {
    const fake = createFakeSupabase({ tables: { projects: [projectRow()] } });
    const { wrapper, hook } = await mountListingProbe(fake.client);

    expect(wrapper.text()).toBe("loading");
    await flush();
    expect(wrapper.text()).toBe("ok");

    const items =
      hook.result.value.kind === "ok" ? hook.result.value.items : [];
    expect(items).toHaveLength(1);
    expect(items[0]?.coverUrl).toContain(
      "public-media/fixtures/projects/cover.webp"
    );
  });

  it("re-fetches when the requested locale changes", async () => {
    const fake = createFakeSupabase({ tables: { projects: [projectRow()] } });
    const { activeLocale } = await mountListingProbe(fake.client);
    await flush();

    activeLocale.value = "pl";
    await flush();

    const eqCalls = fake.calls.filter(
      call => call.table === "projects" && call.method === "eq"
    );
    expect(eqCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("reports unavailable without a client", async () => {
    const { wrapper } = await mountListingProbe(null);
    await flush();

    expect(wrapper.text()).toBe("unavailable");
  });
});

describe("useProject", () => {
  it("resolves the strict (locale, slug) detail", async () => {
    const fake = createFakeSupabase({ tables: { projects: [projectRow()] } });
    const { wrapper, hook } = await mountDetailProbe(
      fake.client,
      "warsztat",
      "pl"
    );

    expect(wrapper.text()).toBe("loading");
    await flush();
    expect(wrapper.text()).toBe("ok");

    const items =
      hook.result.value.kind === "ok" ? hook.result.value.items : [];
    expect(items[0]?.title).toBe("Warsztat (PL)");
    expect(items[0]?.slug).toBe("warsztat");
  });

  it("reports empty when another locale owns the slug (no silent cross-locale resolution)", async () => {
    const fake = createFakeSupabase({ tables: { projects: [projectRow()] } });
    const { wrapper } = await mountDetailProbe(fake.client, "warsztat", "en");
    await flush();

    expect(wrapper.text()).toBe("empty");
  });

  it("reports empty for a draft slug even when the payload leaks it", async () => {
    const fake = createFakeSupabase({
      tables: {
        projects: [
          projectRow(),
          projectRow({
            id: "00000000-0000-4000-8000-000000000202",
            status: "draft",
            project_translations: [
              {
                locale: "en",
                slug: "draft-secret",
                title: "Draft",
                summary: "s",
                body: "b"
              }
            ]
          })
        ]
      }
    });

    const { wrapper } = await mountDetailProbe(fake.client, "draft-secret");
    await flush();

    expect(wrapper.text()).toBe("empty");
  });
});
