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

export interface FakeSupabase {
  /** The value passed to the data-access function under test. */
  readonly client: SupabaseClient<Database>;
  /** Every builder call in order (`.from` excluded). */
  readonly calls: FakeQueryCall[];
}

export interface FakeSupabaseOptions {
  /** Rows returned per table name; a missing table resolves to `[]`. */
  readonly tables?: Readonly<Record<string, readonly unknown[]>>;
  /** When set, every query resolves to this error and no rows. */
  readonly error?: { readonly message: string } | null;
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
  constructor(
    private readonly table: string,
    private readonly options: FakeSupabaseOptions,
    private readonly calls: FakeQueryCall[]
  ) {}

  private record(method: string, args: unknown[]): this {
    this.calls.push({ table: this.table, method, args });
    return this;
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

    return { data: this.options.tables?.[this.table] ?? [], error: null };
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
  const from = (table: string) => new FakeQueryBuilder(table, options, calls);
  const client = { from } as unknown as SupabaseClient<Database>;

  return { client, calls };
}
