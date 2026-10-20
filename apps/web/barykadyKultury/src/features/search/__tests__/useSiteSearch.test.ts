import type { SupabaseClient } from "@supabase/supabase-js";
import { effectScope, nextTick, ref } from "vue";
import type { Ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { searchEvents } from "@/features/search/eventsSearch";
import {
  SEARCH_CONTENT_ERROR,
  SEARCH_DEBOUNCE_MS,
  filterForRoute,
  filterToSourceKinds,
  useSiteSearch
} from "@/features/search/useSiteSearch";
import type { ContentSearchResult } from "@/features/search/types";
import type { Database } from "@/types/database.types";

vi.mock("@/features/search/eventsSearch", () => ({
  searchEvents: vi.fn()
}));

const searchEventsMock = vi.mocked(searchEvents);

interface RpcOutcome {
  readonly data?: unknown;
  readonly error?: { readonly message: string } | null;
}

interface RpcCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
  signal?: AbortSignal;
}

function createRpcFake(
  responder: (call: number) => RpcOutcome | Promise<RpcOutcome>
) {
  const calls: RpcCall[] = [];

  const rpc = (name: string, args: Record<string, unknown>) => {
    const call: RpcCall = { name, args };
    calls.push(call);
    const response = responder(calls.length - 1);

    const builder = {
      abortSignal(signal: AbortSignal) {
        call.signal = signal;
        return builder;
      },
      // oxlint-disable-next-line unicorn/no-thenable
      then<TResult1 = RpcOutcome, TResult2 = never>(
        onfulfilled?:
          | ((value: RpcOutcome) => TResult1 | PromiseLike<TResult1>)
          | null,
        onrejected?:
          | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
          | null
      ): PromiseLike<TResult1 | TResult2> {
        return Promise.resolve(response).then(onfulfilled, onrejected);
      }
    };

    return builder;
  };

  return {
    client: { rpc } as unknown as SupabaseClient<Database>,
    calls
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolver => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function contentRow(overrides: Record<string, unknown> = {}) {
  return {
    kind: "document",
    entity_id: "00000000-0000-4000-8000-000000000601",
    title: "Regulations",
    excerpt: "The association regulations.",
    slug: "regulations",
    page_key: null,
    rank: 3,
    ...overrides
  };
}

function eventResult(id: string, title: string): ContentSearchResult {
  return {
    id: `event:${id}`,
    kind: "event",
    title,
    excerpt: null,
    route: `/en/events#event-${id}`,
    rank: 3
  };
}

function setup(options: {
  routeName?: string | null;
  supabase: SupabaseClient<Database> | null;
  publicationYears?: Ref<readonly number[]>;
}) {
  const locale = ref<"en" | "pl" | "uk">("en");
  const routeName = ref<string | null | undefined>(options.routeName);
  const scope = effectScope();

  const composable = scope.run(() =>
    useSiteSearch({
      locale,
      routeName,
      supabase: options.supabase,
      ...(options.publicationYears
        ? { publicationYears: options.publicationYears }
        : {})
    })
  );

  if (!composable) throw new Error("composable was not created");

  return { ...composable, locale, routeName, stop: () => scope.stop() };
}

describe("filter mapping", () => {
  it("maps routes to the default chip", () => {
    expect(filterForRoute("projects")).toBe("projects");
    expect(filterForRoute("project-detail")).toBe("projects");
    expect(filterForRoute("publications")).toBe("publications");
    expect(filterForRoute("publication-detail")).toBe("publications");
    expect(filterForRoute("events")).toBe("events");
    expect(filterForRoute("about")).toBe("all");
    expect(filterForRoute(null)).toBe("all");
  });

  it("maps chips to RPC kinds", () => {
    expect(filterToSourceKinds("all")).toBeNull();
    expect(filterToSourceKinds("pages")).toEqual(["page"]);
    expect(filterToSourceKinds("projects")).toEqual(["project"]);
    expect(filterToSourceKinds("publications")).toEqual(["publication"]);
    expect(filterToSourceKinds("documents")).toEqual(["document"]);
    expect(filterToSourceKinds("team")).toEqual(["team"]);
    expect(filterToSourceKinds("events")).toEqual([]);
  });
});

describe("useSiteSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    searchEventsMock.mockReset();
    searchEventsMock.mockResolvedValue({ kind: "empty" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-sets the filter from the route and resets a user override on navigation", async () => {
    const harness = setup({
      routeName: "projects",
      supabase: createRpcFake(() => ({ data: [] })).client
    });

    expect(harness.filter.value).toBe("projects");

    harness.routeName.value = "publication-detail";
    await nextTick();
    expect(harness.filter.value).toBe("publications");

    harness.setFilter("team");
    expect(harness.filter.value).toBe("team");

    harness.routeName.value = "contact";
    await nextTick();
    expect(harness.filter.value).toBe("all");

    harness.stop();
  });

  it("returns navigation results instantly, before any debounce/network", async () => {
    const fake = createRpcFake(() => ({ data: [] }));
    const harness = setup({ routeName: "about", supabase: fake.client });

    harness.query.value = "documents";
    await nextTick();

    expect(
      harness.navigationResults.value.some(
        result => result.route === "/en/about#documents"
      )
    ).toBe(true);
    expect(fake.calls).toHaveLength(0);

    harness.stop();
  });

  it("debounces content search by ~200 ms", async () => {
    const fake = createRpcFake(() => ({ data: [] }));
    const harness = setup({ routeName: "projects", supabase: fake.client });

    harness.query.value = "sample";
    await nextTick();

    expect(harness.status.value).toBe("loading");
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 1);
    expect(fake.calls).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.args).toMatchObject({
      search_query: "sample",
      result_kinds: ["project"]
    });

    harness.stop();
  });

  it("includes publication year anchors when the UI supplies years", async () => {
    const fake = createRpcFake(() => ({ data: [] }));
    const publicationYears = ref<readonly number[]>([2026]);
    const harness = setup({
      routeName: "publications",
      supabase: fake.client,
      publicationYears
    });

    harness.query.value = "2026";
    await nextTick();

    expect(harness.navigationResults.value).toContainEqual(
      expect.objectContaining({ route: "/en/publications#2026" })
    );

    harness.stop();
  });

  it("does not search for queries shorter than two characters", async () => {
    const fake = createRpcFake(() => ({ data: [] }));
    const harness = setup({ routeName: "about", supabase: fake.client });

    harness.query.value = "a";
    await nextTick();
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);

    expect(fake.calls).toHaveLength(0);
    expect(harness.status.value).toBe("idle");

    harness.stop();
  });

  it("drops a stale response when a newer query wins", async () => {
    const first = deferred<RpcOutcome>();
    const fake = createRpcFake(call =>
      call === 0
        ? first.promise
        : { data: [contentRow({ title: "Second result" })] }
    );
    const harness = setup({ routeName: "documents", supabase: fake.client });

    harness.query.value = "first";
    await nextTick();
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);

    harness.query.value = "second";
    await nextTick();
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);

    // The superseded request is actively aborted, not merely ignored.
    expect(fake.calls[0]?.signal?.aborted).toBe(true);
    expect(harness.contentResults.value[0]?.title).toBe("Second result");

    first.resolve({ data: [contentRow({ title: "First result" })] });
    await vi.advanceTimersByTimeAsync(0);

    expect(harness.contentResults.value[0]?.title).toBe("Second result");

    harness.stop();
  });

  it("isolates a content failure: navigation stays usable and error is set", async () => {
    const fake = createRpcFake(() => ({ error: { message: "boom" } }));
    const harness = setup({ routeName: "about", supabase: fake.client });

    harness.query.value = "about";
    await nextTick();
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);

    expect(harness.status.value).toBe("error");
    expect(harness.error.value).toBe(SEARCH_CONTENT_ERROR);
    expect(harness.contentResults.value).toEqual([]);
    expect(harness.navigationResults.value.length).toBeGreaterThan(0);

    harness.stop();
  });

  it("sets a visible error when Supabase is not configured", async () => {
    const harness = setup({ routeName: "projects", supabase: null });

    // "projects" matches the navigation registry, proving that section stays
    // usable while the content source is unavailable.
    harness.query.value = "projects";
    await nextTick();
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);

    expect(harness.status.value).toBe("error");
    expect(harness.error.value).toBe(SEARCH_CONTENT_ERROR);
    expect(harness.navigationResults.value.length).toBeGreaterThan(0);

    harness.stop();
  });

  it("merges calendar events for the Events chip without calling the RPC", async () => {
    const fake = createRpcFake(() => ({ data: [] }));
    searchEventsMock.mockResolvedValue({
      kind: "ok",
      items: [eventResult("one", "Koncert")]
    });
    const harness = setup({ routeName: "events", supabase: fake.client });

    harness.query.value = "koncert";
    await nextTick();
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);

    expect(fake.calls).toHaveLength(0);
    expect(harness.status.value).toBe("ready");
    expect(harness.contentResults.value).toEqual([
      eventResult("one", "Koncert")
    ]);

    harness.stop();
  });

  it("merges DB and event results for 'all'", async () => {
    const fake = createRpcFake(() => ({ data: [contentRow()] }));
    searchEventsMock.mockResolvedValue({
      kind: "ok",
      items: [eventResult("two", "Koncert")]
    });
    const harness = setup({ routeName: "contact", supabase: fake.client });

    harness.query.value = "regulations";
    await nextTick();
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);

    expect(fake.calls[0]?.args).not.toHaveProperty("result_kinds");
    // Both rank 3; the merged list is title-sorted ("Koncert" < "Regulations").
    expect(harness.contentResults.value.map(item => item.id)).toEqual([
      "event:two",
      "document:00000000-0000-4000-8000-000000000601"
    ]);

    harness.stop();
  });

  it("keeps DB results usable when the calendar fails in 'all'", async () => {
    const fake = createRpcFake(() => ({ data: [contentRow()] }));
    searchEventsMock.mockResolvedValue({ kind: "unavailable" });
    const harness = setup({ routeName: "contact", supabase: fake.client });

    harness.query.value = "regulations";
    await nextTick();
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);

    expect(harness.status.value).toBe("ready");
    expect(harness.error.value).toBeNull();
    expect(harness.contentResults.value).toHaveLength(1);

    harness.stop();
  });

  it("retries the content search after a failure", async () => {
    const fake = createRpcFake(call =>
      call === 0
        ? { error: { message: "boom" } }
        : { data: [contentRow({ title: "Recovered" })] }
    );
    const harness = setup({ routeName: "documents", supabase: fake.client });

    harness.query.value = "regulations";
    await nextTick();
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    expect(harness.status.value).toBe("error");

    harness.retry();
    await vi.advanceTimersByTimeAsync(0);

    expect(fake.calls).toHaveLength(2);
    expect(harness.status.value).toBe("ready");
    expect(harness.contentResults.value[0]?.title).toBe("Recovered");

    harness.stop();
  });

  it("reset clears the query, results and filter override", async () => {
    const fake = createRpcFake(() => ({ data: [contentRow()] }));
    const harness = setup({ routeName: "projects", supabase: fake.client });

    harness.query.value = "regulations";
    await nextTick();
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    harness.setFilter("documents");
    expect(harness.filter.value).toBe("documents");

    harness.reset();

    expect(harness.query.value).toBe("");
    expect(harness.filter.value).toBe("projects");
    expect(harness.contentResults.value).toEqual([]);
    expect(harness.status.value).toBe("idle");
    expect(harness.navigationResults.value).toEqual([]);

    harness.stop();
  });
});
