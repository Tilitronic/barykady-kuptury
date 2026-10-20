import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { searchContent } from "@/features/search/api";
import type { Database } from "@/types/database.types";

/**
 * The RPC is the only authorization-relevant call in the search feature
 * (T-039). These tests pin the call shape (typed args, abort signal) and the
 * mapping from rows to locale-prefixed routes. No live Supabase, no network:
 * the fake implements only `rpc` and records every call.
 */

interface RpcCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
  signal?: AbortSignal;
}

interface FakeOptions {
  readonly data?: unknown;
  readonly error?: { readonly message: string } | null;
}

function createRpcFake(options: FakeOptions = {}) {
  const calls: RpcCall[] = [];
  const result = { data: options.data ?? [], error: options.error ?? null };

  const rpc = (name: string, args: Record<string, unknown>) => {
    const call: RpcCall = { name, args };
    calls.push(call);

    const builder = {
      abortSignal(signal: AbortSignal) {
        call.signal = signal;
        return builder;
      },
      // A PostgREST builder is thenable; this fake mirrors that shape.
      // oxlint-disable-next-line unicorn/no-thenable
      then<TResult1 = typeof result, TResult2 = never>(
        onfulfilled?:
          | ((value: typeof result) => TResult1 | PromiseLike<TResult1>)
          | null,
        onrejected?:
          | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
          | null
      ): PromiseLike<TResult1 | TResult2> {
        return Promise.resolve(result).then(onfulfilled, onrejected);
      }
    };

    return builder;
  };

  return {
    client: { rpc } as unknown as SupabaseClient<Database>,
    calls
  };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    kind: "page",
    entity_id: "00000000-0000-4000-8000-000000000101",
    title: "About us",
    excerpt: "About the association.",
    slug: null,
    page_key: "about",
    rank: 3,
    ...overrides
  };
}

describe("searchContent", () => {
  it("returns unavailable when Supabase is not configured", async () => {
    await expect(searchContent(null, "about", "en")).resolves.toEqual({
      kind: "unavailable"
    });
  });

  it("does not call the RPC for queries shorter than two characters", async () => {
    const fake = createRpcFake();

    await expect(searchContent(fake.client, " a ", "en")).resolves.toEqual({
      kind: "empty"
    });
    expect(fake.calls).toHaveLength(0);
  });

  it("does not call the RPC when the selected kind list is empty", async () => {
    const fake = createRpcFake();

    await expect(
      searchContent(fake.client, "calendar", "en", [])
    ).resolves.toEqual({ kind: "empty" });
    expect(fake.calls).toHaveLength(0);
  });

  it("calls the RPC with trimmed query, locale and kinds", async () => {
    const fake = createRpcFake({ data: [row()] });

    await searchContent(fake.client, "  about  ", "pl", ["document"]);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]).toMatchObject({
      name: "search_published_content",
      args: {
        search_query: "about",
        result_locale: "pl",
        result_kinds: ["document"]
      }
    });
    expect(fake.calls[0]?.args).not.toHaveProperty("result_limit");
  });

  it("omits result_kinds for 'all' (null kinds) and forwards a limit", async () => {
    const fake = createRpcFake({ data: [] });

    await searchContent(fake.client, "about", "en", null, { limit: 10 });

    expect(fake.calls[0]?.args).toEqual({
      search_query: "about",
      result_locale: "en",
      result_limit: 10
    });
  });

  it("maps every kind to its locale-prefixed route", async () => {
    const fake = createRpcFake({
      data: [
        row({ kind: "page", page_key: "home", title: "Home" }),
        row({ kind: "page", page_key: "about", title: "About us" }),
        row({
          kind: "project",
          entity_id: "00000000-0000-4000-8000-000000000201",
          slug: "sample-project",
          page_key: null,
          title: "Sample project"
        }),
        row({
          kind: "publication",
          entity_id: "00000000-0000-4000-8000-000000000401",
          slug: "sample-publication",
          page_key: null,
          title: "Sample publication"
        }),
        row({
          kind: "document",
          entity_id: "00000000-0000-4000-8000-000000000601",
          slug: "regulations",
          page_key: null,
          title: "Regulations"
        }),
        row({
          kind: "team",
          entity_id: "00000000-0000-4000-8000-000000000301",
          slug: null,
          page_key: null,
          title: "Sample Person"
        })
      ]
    });

    const result = await searchContent(fake.client, "sample", "pl", null);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    expect(result.items.map(item => item.route)).toEqual([
      "/pl",
      "/pl/about",
      "/pl/projects/sample-project",
      "/pl/publications/sample-publication",
      "/pl/about/documents/regulations",
      "/pl/about#team"
    ]);
    expect(result.items.map(item => item.id)).toEqual([
      "page:00000000-0000-4000-8000-000000000101",
      "page:00000000-0000-4000-8000-000000000101",
      "project:00000000-0000-4000-8000-000000000201",
      "publication:00000000-0000-4000-8000-000000000401",
      "document:00000000-0000-4000-8000-000000000601",
      "team:00000000-0000-4000-8000-000000000301"
    ]);
  });

  it("drops unknown kinds and unusable routes instead of inventing URLs", async () => {
    const fake = createRpcFake({
      data: [
        row({ kind: "event", entity_id: "fixture-event" }),
        row({ kind: "project", slug: null, page_key: null, title: "No slug" }),
        row({ kind: "page", page_key: null, title: "No key" }),
        row()
      ]
    });

    const result = await searchContent(fake.client, "about", "en");

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(
      "page:00000000-0000-4000-8000-000000000101"
    );
  });

  it("collapses an empty row set to the empty state", async () => {
    const fake = createRpcFake({ data: [] });

    await expect(searchContent(fake.client, "about", "en")).resolves.toEqual({
      kind: "empty"
    });
  });

  it("maps an RPC error to unavailable (never throws)", async () => {
    const fake = createRpcFake({ error: { message: "boom" } });

    await expect(searchContent(fake.client, "about", "en")).resolves.toEqual({
      kind: "unavailable"
    });
  });

  it("forwards the abort signal to the PostgREST request", async () => {
    const fake = createRpcFake({ data: [row()] });
    const controller = new AbortController();

    await searchContent(fake.client, "about", "en", null, {
      signal: controller.signal
    });

    expect(fake.calls[0]?.signal).toBe(controller.signal);
  });

  it("does not issue a request for an already-aborted signal", async () => {
    const fake = createRpcFake({ data: [row()] });
    const controller = new AbortController();
    controller.abort();

    await expect(
      searchContent(fake.client, "about", "en", null, {
        signal: controller.signal
      })
    ).resolves.toEqual({ kind: "unavailable" });
    expect(fake.calls).toHaveLength(0);
  });
});
