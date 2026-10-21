import { flushPromises } from "@vue/test-utils";
import { effectScope, nextTick, ref } from "vue";
import type { RouteLocationRaw } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildReaderLangLocation,
  useReaderDocument
} from "@/features/reader/useReaderDocument";
import { fetchReaderDocument } from "@/features/reader/api";
import type {
  ReaderDocumentModel,
  ReaderTranslation
} from "@/features/reader/types";

vi.mock("@/features/reader/api", () => ({
  fetchReaderDocument: vi.fn()
}));

const fetchMock = vi.mocked(fetchReaderDocument);

function translation(
  locale: ReaderTranslation["locale"],
  readable = true
): ReaderTranslation {
  return {
    locale,
    title: `Title ${locale}`,
    description: null,
    bodyAst: readable ? { kind: "document", blocks: [] } : null,
    body: null,
    hasReadableContent: readable
  };
}

function model(
  translations: readonly ReaderTranslation[]
): ReaderDocumentModel {
  return {
    id: "00000000-0000-4000-8000-000000000601",
    kind: "document",
    slug: "regulations",
    translations,
    availableLocales: translations
      .filter(candidate => candidate.hasReadableContent)
      .map(candidate => candidate.locale),
    assets: [],
    documentType: "regulations",
    language: null,
    publicationDate: null,
    externalUrl: null,
    allowOriginalDownload: false,
    updatedAt: "2026-10-20T12:00:00Z"
  };
}

function createRouter() {
  const calls: RouteLocationRaw[] = [];
  return {
    calls,
    router: {
      replace(to: RouteLocationRaw) {
        calls.push(to);
        return Promise.resolve();
      }
    }
  };
}

interface SetupOptions {
  readonly slug?: string | null;
  readonly locale?: "en" | "pl" | "uk";
  readonly requestedLang?: string | null;
  readonly route?: {
    readonly path: string;
    readonly hash: string;
    readonly query: Readonly<Record<string, unknown>>;
  };
}

function setup(options: SetupOptions = {}) {
  const slug = ref<string | null | undefined>(
    options.slug === undefined ? "regulations" : options.slug
  );
  const locale = ref<"en" | "pl" | "uk">(options.locale ?? "en");
  const requestedLang = ref<string | null>(options.requestedLang ?? null);
  const router = createRouter();
  const route = options.route ?? {
    path: "/en/about/documents/regulations",
    hash: "",
    query: {}
  };

  const scope = effectScope();
  const reader = scope.run(() =>
    useReaderDocument({
      kind: "document",
      slug,
      locale,
      requestedLang,
      supabase: null,
      router: router.router,
      route
    })
  );

  if (!reader) throw new Error("composable was not created");

  return {
    ...reader,
    slug,
    uiLocale: locale,
    contentLocale: reader.locale,
    requestedLang,
    routerCalls: router.calls,
    stop: () => scope.stop()
  };
}

describe("buildReaderLangLocation", () => {
  it("replaces lang while preserving path, hash and other query values", () => {
    expect(
      buildReaderLangLocation(
        {
          path: "/en/about/documents/regulations",
          hash: "#reader",
          query: { foo: "bar", lang: "uk", tags: ["one", "two"], empty: null }
        },
        "pl"
      )
    ).toEqual({
      path: "/en/about/documents/regulations",
      query: { foo: "bar", tags: ["one", "two"], lang: "pl" },
      hash: "#reader"
    });
  });
});

describe("useReaderDocument", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("fetches once and selects the UI locale by default", async () => {
    fetchMock.mockResolvedValue({
      kind: "ok",
      items: [model([translation("en"), translation("pl")])]
    });
    const harness = setup({ locale: "pl" });

    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(harness.status.value).toBe("ready");
    expect(harness.contentLocale.value).toBe("pl");
    expect(harness.selected.value?.locale).toBe("pl");
    expect(harness.routerCalls).toHaveLength(0);

    harness.stop();
  });

  it("falls back to English when the UI locale is unavailable", async () => {
    fetchMock.mockResolvedValue({
      kind: "ok",
      items: [model([translation("en")])]
    });
    const harness = setup({ locale: "uk" });

    await flushPromises();

    expect(harness.selected.value?.locale).toBe("en");
    expect(harness.status.value).toBe("ready");

    harness.stop();
  });

  it("falls back to the first available translation", async () => {
    fetchMock.mockResolvedValue({
      kind: "ok",
      items: [model([translation("pl"), translation("uk")])]
    });
    const harness = setup({ locale: "en" });

    await flushPromises();

    expect(harness.selected.value?.locale).toBe("pl");

    harness.stop();
  });

  it("selects a valid requested ?lang without touching the URL", async () => {
    fetchMock.mockResolvedValue({
      kind: "ok",
      items: [model([translation("en"), translation("pl"), translation("uk")])]
    });
    const harness = setup({ locale: "en", requestedLang: "uk" });

    await flushPromises();

    expect(harness.selected.value?.locale).toBe("uk");
    expect(harness.contentLocale.value).toBe("uk");
    expect(harness.routerCalls).toHaveLength(0);

    harness.stop();
  });

  it("normalizes an unavailable ?lang and preserves the rest of the URL", async () => {
    fetchMock.mockResolvedValue({
      kind: "ok",
      items: [model([translation("en"), translation("pl")])]
    });
    const harness = setup({
      locale: "pl",
      requestedLang: "uk",
      route: {
        path: "/pl/about/documents/regulations",
        hash: "#section-2",
        query: { from: "search", lang: "uk" }
      }
    });

    await flushPromises();

    expect(harness.selected.value?.locale).toBe("pl");
    expect(harness.routerCalls).toEqual([
      {
        path: "/pl/about/documents/regulations",
        query: { from: "search", lang: "pl" },
        hash: "#section-2"
      }
    ]);

    harness.stop();
  });

  it("re-selects on ?lang change without refetching the document", async () => {
    fetchMock.mockResolvedValue({
      kind: "ok",
      items: [model([translation("en"), translation("pl")])]
    });
    const harness = setup({ locale: "en" });

    await flushPromises();
    expect(harness.selected.value?.locale).toBe("en");

    harness.requestedLang.value = "pl";
    await nextTick();

    expect(harness.selected.value?.locale).toBe("pl");
    expect(harness.contentLocale.value).toBe("pl");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    harness.stop();
  });

  it("reports unsupported when no translation has readable content", async () => {
    fetchMock.mockResolvedValue({
      kind: "ok",
      items: [model([translation("en", false)])]
    });
    const harness = setup({ locale: "en" });

    await flushPromises();

    expect(harness.status.value).toBe("unsupported");
    expect(harness.selected.value).toBeNull();
    expect(harness.routerCalls).toHaveLength(0);

    harness.stop();
  });

  it("reports empty for an unresolved slug", async () => {
    fetchMock.mockResolvedValue({ kind: "empty" });
    const harness = setup();

    await flushPromises();

    expect(harness.status.value).toBe("empty");
    expect(harness.model.value).toBeNull();

    harness.stop();
  });

  it("refresh preserves the current copy when the refetch fails", async () => {
    fetchMock.mockResolvedValue({
      kind: "ok",
      items: [model([translation("en")])]
    });
    const harness = setup();
    await flushPromises();
    expect(harness.status.value).toBe("ready");

    fetchMock.mockResolvedValueOnce({ kind: "unavailable" });
    harness.refresh();
    await flushPromises();

    expect(harness.status.value).toBe("ready");
    expect(harness.selected.value?.title).toBe("Title en");
  });

  it("reports unavailable when the fetch fails", async () => {
    fetchMock.mockResolvedValue({ kind: "unavailable" });
    const harness = setup();

    await flushPromises();

    expect(harness.status.value).toBe("unavailable");
    expect(harness.selected.value).toBeNull();

    harness.stop();
  });

  it("does not fetch for a missing slug", async () => {
    const harness = setup({ slug: null });

    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(harness.status.value).toBe("empty");

    harness.stop();
  });

  it("retries a failed load", async () => {
    fetchMock
      .mockResolvedValueOnce({ kind: "unavailable" })
      .mockResolvedValueOnce({
        kind: "ok",
        items: [model([translation("en")])]
      });
    const harness = setup();

    await flushPromises();
    expect(harness.status.value).toBe("unavailable");

    harness.retry();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(harness.status.value).toBe("ready");

    harness.stop();
  });

  it("drops a stale response when the slug changes", async () => {
    let resolveFirst!: (value: {
      kind: "ok";
      items: ReaderDocumentModel[];
    }) => void;
    const first = new Promise<{ kind: "ok"; items: ReaderDocumentModel[] }>(
      resolve => {
        resolveFirst = resolve;
      }
    );

    fetchMock.mockImplementation((_client, _kind, slug) =>
      slug === "first"
        ? first
        : Promise.resolve({
            kind: "ok",
            items: [{ ...model([translation("en")]), slug: "second" }]
          })
    );

    const harness = setup({ slug: "first" });
    await nextTick();

    harness.slug.value = "second";
    await flushPromises();

    expect(harness.model.value?.slug).toBe("second");

    resolveFirst({
      kind: "ok",
      items: [{ ...model([translation("pl")]), slug: "first" }]
    });
    await flushPromises();

    expect(harness.model.value?.slug).toBe("second");

    harness.stop();
  });
});
