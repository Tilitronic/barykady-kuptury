/**
 * Typed in-memory fake for the read side of the Supabase client (T-015).
 *
 * `vitest.config.ts` excludes `src/test-utils/**` from coverage; this module
 * never reaches the production bundle. It implements only the query-builder
 * surface the feature data-access modules use and performs no I/O, so the
 * `api.test.ts` suites prove filtering and row mapping without a network
 * (docs/TESTING.md §2: deterministic fixtures, no live Supabase).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

/** One recorded builder call, in order, for asserting the query shape. */
export interface FakeQueryCall {
  readonly table: string;
  readonly method: string;
  readonly args: readonly unknown[];
}

export interface FakeStorageCall {
  readonly op: "upload" | "remove";
  readonly bucket: string;
  readonly path: string;
  readonly contentType?: string;
}

export interface FakeSupabase {
  /** The value passed to the data-access function under test. */
  readonly client: SupabaseClient<Database>;
  /** Every builder call in order (`.from` excluded). */
  readonly calls: FakeQueryCall[];
  /** Every `rpc()` call in order (T-039 search seam). */
  readonly rpcCalls: { name: string; args: Record<string, unknown> }[];
  /** Every Storage upload/remove in order (T-029 upload seam). */
  readonly storageCalls: FakeStorageCall[];
}

export interface FakeSupabaseOptions {
  /** Rows returned per table name; a missing table resolves to `[]`. */
  readonly tables?: Readonly<Record<string, readonly unknown[]>>;
  /** When set, every query resolves to this error and no rows. */
  readonly error?: { readonly message: string; readonly code?: string } | null;
  /**
   * Result of a write chain (`insert`/`update`/`upsert`/`delete`), including
   * an optional `.select(...).single()` tail (T-027 admin mutations). Reads
   * keep using `tables`; a write never mutates the fixture — the test asserts
   * the recorded payload instead of re-implementing Postgres.
   */
  readonly writes?: {
    readonly data?: unknown;
    readonly error?: {
      readonly message: string;
      readonly code?: string;
    } | null;
  };
  /**
   * The `{data, error}` envelope every `rpc()` call resolves with (T-039:
   * `search_published_content` and the publications-years query share this
   * fake). Defaults to `{ data: [], error: null }`.
   */
  readonly rpc?: {
    readonly data?: unknown;
    /** `code` mirrors PostgREST's SQLSTATE so callers can map 23505. */
    readonly error?: {
      readonly message: string;
      readonly code?: string;
    } | null;
  };
  /**
   * Per-call RPC envelopes, consumed in order (T-028 gate fix). The first
   * entry answers the first call, the second the second, and so on; calls
   * beyond the array fall back to `rpc`. This is the seam that proves a
   * transient `23505`/`40P01` retry without re-implementing Postgres.
   */
  readonly rpcResults?: readonly {
    readonly data?: unknown;
    readonly error?: {
      readonly message: string;
      readonly code?: string;
    } | null;
  }[];
  /**
   * Per-table failures (T-039): tables listed here resolve to an error while
   * others keep their `tables` fixture — the seam that proves one failing
   * page section does not blank its siblings.
   */
  readonly tableErrors?: Readonly<Record<string, string>>;
}

interface FakeResult {
  readonly data: unknown;
  readonly error: { readonly message: string } | null;
}

/**
 * Chainable PostgREST-builder stand-in. Every narrowing method returns itself,
 * so a real `.from(...).select(...).eq(...).order(...)` chain runs unchanged;
 * `await` resolves the configured fixture.
 */
class FakeQueryBuilder implements PromiseLike<FakeResult> {
  /** Set by a mutation verb so `result()` reads the configured write result. */
  private isWrite = false;
  /** Set by `single()`/`maybeSingle()` so the fixture unwraps to one row. */
  private unwrapSingle = false;

  constructor(
    private readonly table: string,
    private readonly options: FakeSupabaseOptions,
    private readonly calls: FakeQueryCall[]
  ) {}

  private record(method: string, args: unknown[]): this {
    this.calls.push({ table: this.table, method, args });
    return this;
  }

  private mutate(method: string, args: unknown[]): this {
    this.isWrite = true;
    return this.record(method, args);
  }

  select(...args: unknown[]): this {
    return this.record("select", args);
  }

  eq(...args: unknown[]): this {
    return this.record("eq", args);
  }

  order(...args: unknown[]): this {
    return this.record("order", args);
  }

  limit(...args: unknown[]): this {
    return this.record("limit", args);
  }

  not(...args: unknown[]): this {
    return this.record("not", args);
  }

  insert(...args: unknown[]): this {
    return this.mutate("insert", args);
  }

  update(...args: unknown[]): this {
    return this.mutate("update", args);
  }

  upsert(...args: unknown[]): this {
    return this.mutate("upsert", args);
  }

  delete(...args: unknown[]): this {
    return this.mutate("delete", args);
  }

  /** PostgREST `.single()`: unwraps the fixture to one row (or null). */
  single(): this {
    this.unwrapSingle = true;
    return this.record("single", []);
  }

  /** PostgREST `.maybeSingle()`: same contract as `single()` in the fake. */
  maybeSingle(): this {
    this.unwrapSingle = true;
    return this.record("maybeSingle", []);
  }

  overrideTypes(...args: unknown[]): this {
    return this.record("overrideTypes", args);
  }

  // A PostgREST builder is thenable (`await client.from(...)...`); the fake must
  // be too, so it is a deliberate, test-only exception to the no-thenable rule.
  // oxlint-disable-next-line unicorn/no-thenable
  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?:
      | ((value: FakeResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result()).then(onfulfilled, onrejected);
  }

  private result(): FakeResult {
    if (this.options.error) {
      return { data: null, error: this.options.error };
    }

    if (this.isWrite) {
      const writeData = this.options.writes?.data ?? null;
      return {
        data:
          this.unwrapSingle && Array.isArray(writeData)
            ? (writeData[0] ?? null)
            : writeData,
        error: this.options.writes?.error ?? null
      };
    }

    const tableError = this.options.tableErrors?.[this.table];
    if (tableError) {
      return { data: null, error: { message: tableError } };
    }

    const rows = this.options.tables?.[this.table] ?? [];
    return {
      data: this.unwrapSingle ? (rows[0] ?? null) : rows,
      error: null
    };
  }
}

/**
 * Builds a fake client plus its recorded calls. Only the builder methods the
 * data-access modules actually use are implemented; the cast confines that
 * approximation to the test seam.
 */
export function createFakeSupabase(
  options: FakeSupabaseOptions = {}
): FakeSupabase {
  const calls: FakeQueryCall[] = [];
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
  const storageCalls: FakeStorageCall[] = [];
  let rpcIndex = 0;
  const from = (table: string) => new FakeQueryBuilder(table, options, calls);

  /**
   * RPC builder: records the call, mirrors `.abortSignal()` (the search API
   * chains it) and is thenable like a PostgREST builder.
   */
  const rpc = (name: string, args: Record<string, unknown>) => {
    rpcCalls.push({ name, args });

    const queued = options.rpcResults?.[rpcIndex];
    rpcIndex += 1;
    const result = queued
      ? {
          data: "data" in queued ? queued.data : [],
          error: queued.error ?? null
        }
      : {
          data: options.rpc?.data ?? [],
          error: options.rpc?.error ?? null
        };
    const builder = {
      abortSignal: () => builder,
      // oxlint-disable-next-line unicorn/no-thenable
      then: <T1, T2>(
        onfulfilled?: ((value: typeof result) => T1 | PromiseLike<T1>) | null,
        onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
      ) => Promise.resolve(result).then(onfulfilled, onrejected)
    };
    return builder;
  };

  // Read-side storage surface used by T-018: `getPublicUrl` is synchronous URL
  // derivation in the real client, so the fake only mirrors its shape with a
  // fixed fake origin — no I/O, never a real bucket. T-029 adds the write
  // surface (upload/remove) and records every call so ordering (validate →
  // upload → persist → cleanup) is assertable without a network.
  const storage = {
    from: (bucket: string) => ({
      getPublicUrl: (path: string) => ({
        data: {
          publicUrl: `https://fake.supabase.test/storage/v1/object/public/${bucket}/${path}`
        }
      }),
      upload: async (
        path: string,
        _file: unknown,
        options?: { contentType?: string }
      ) => {
        storageCalls.push({
          op: "upload",
          bucket,
          path,
          ...(options?.contentType === undefined
            ? {}
            : { contentType: options.contentType })
        });
        return { data: { path }, error: null };
      },
      remove: async (paths: readonly string[]) => {
        for (const path of paths) {
          storageCalls.push({ op: "remove", bucket, path });
        }
        return { data: null, error: null };
      }
    })
  };

  const client = { from, storage, rpc } as unknown as SupabaseClient<Database>;

  return { client, calls, rpcCalls, storageCalls };
}
