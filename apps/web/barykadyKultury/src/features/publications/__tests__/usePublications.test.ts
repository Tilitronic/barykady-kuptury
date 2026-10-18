import { describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, ref, type Ref } from "vue";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  usePublication,
  usePublications,
  type PublicationView
} from "@/features/publications/usePublications";
import type { Locale } from "@/features/i18n/locales";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";
import type { ContentResult } from "@/shared/content/result";
import type { Database } from "@/types/database.types";

/**
 * Hook axis (T-020): mirrors `useProjects` — loading first, stale-guarded,
 * locale-reactive — and owns the file-URL seam: each file carries a resolved
 * `downloadUrl` so the components receive plain view-model data (the rule the
 * T-017/T-018/T-019 reviews enforced three times).
 */

type Client = SupabaseClient<Database> | null;
type ListingHook = {
  readonly result: Ref<ContentResult<PublicationView>>;
};

function publicationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000401",
    status: "published",
    language: "en",
    publication_date: "2026-02-01",
    external_url: null,
    sort_order: 1,
    updated_at: "2026-02-01T09:00:00Z",
    publication_translations: [
      {
        locale: "en",
        slug: "sample-publication",
        title: "Sample (EN)",
        abstract: "A",
        authors: "X"
      },
      {
        locale: "pl",
        slug: "przykladowa-publikacja",
        title: "Przykladowa (PL)",
        abstract: "B",
        authors: "Y"
      }
    ],
    publication_files: [
      {
        locale: "en",
        label: "EN file",
        storage_path: "fixtures/publications/a-en.pdf",
        mime_type: "application/pdf",
        file_size_bytes: 12345
      },
      {
        locale: "pl",
        label: null,
        storage_path: "fixtures/publications/a-pl.pdf",
        mime_type: "application/pdf",
        file_size_bytes: null
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
      hook = usePublications(activeLocale);
      return () => h("div", hook.result.value.kind);
    }
  });

  const wrapper = await mountWithPlugins(Probe, {
    supabase,
    initialRoute: `/${locale}/publications`
  });

  return { wrapper, activeLocale, hook };
}

async function mountDetailProbe(
  supabase: Client,
  slug: string,
  locale: Locale
) {
  const activeSlug = ref(slug);
  const activeLocale = ref<Locale>(locale);
  let hook!: ListingHook;

  const Probe = defineComponent({
    setup() {
      hook = usePublication(activeSlug, activeLocale);
      return () => h("div", hook.result.value.kind);
    }
  });

  const wrapper = await mountWithPlugins(Probe, {
    supabase,
    initialRoute: `/${locale}/publications/${slug}`
  });

  return { wrapper, hook };
}

async function flush() {
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe("usePublications", () => {
  it("starts loading, then resolves the listing with per-file download URLs", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [publicationRow()] }
    });
    const { wrapper, hook } = await mountListingProbe(fake.client);

    expect(wrapper.text()).toBe("loading");
    await flush();
    expect(wrapper.text()).toBe("ok");

    const items =
      hook.result.value.kind === "ok" ? hook.result.value.items : [];
    expect(items).toHaveLength(1);
    expect(items[0]?.files[0]?.downloadUrl).toContain(
      "public-documents/fixtures/publications/a-en.pdf?download=a-en.pdf"
    );
    // Metadata stays intact for the unlabelled/sizeless second version.
    expect(items[0]?.files[1]?.downloadUrl).toContain("a-pl.pdf");
    expect(items[0]?.files[1]?.sizeBytes).toBeNull();
  });

  it("re-fetches when the requested locale changes", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [publicationRow()] }
    });
    const { activeLocale } = await mountListingProbe(fake.client);
    await flush();

    activeLocale.value = "pl";
    await flush();

    const eqCalls = fake.calls.filter(
      call => call.table === "publications" && call.method === "eq"
    );
    expect(eqCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("reports unavailable without a client", async () => {
    const { wrapper } = await mountListingProbe(null);
    await flush();

    expect(wrapper.text()).toBe("unavailable");
  });
});

describe("usePublication", () => {
  it("resolves the strict (locale, slug) detail", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [publicationRow()] }
    });
    const { wrapper } = await mountDetailProbe(
      fake.client,
      "przykladowa-publikacja",
      "pl"
    );

    expect(wrapper.text()).toBe("loading");
    await flush();
    expect(wrapper.text()).toBe("ok");
  });

  it("reports empty when another locale owns the slug", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [publicationRow()] }
    });
    const { wrapper } = await mountDetailProbe(
      fake.client,
      "sample-publication",
      "pl"
    );
    await flush();

    expect(wrapper.text()).toBe("empty");
  });

  it("reports empty for a draft slug even when the payload leaks it", async () => {
    const fake = createFakeSupabase({
      tables: {
        publications: [
          publicationRow({
            id: "00000000-0000-4000-8000-000000000499",
            status: "draft",
            publication_translations: [
              {
                locale: "en",
                slug: "draft-secret",
                title: "Draft",
                abstract: "a",
                authors: "x"
              }
            ]
          })
        ]
      }
    });

    const { wrapper } = await mountDetailProbe(
      fake.client,
      "draft-secret",
      "en"
    );
    await flush();

    expect(wrapper.text()).toBe("empty");
  });
});
