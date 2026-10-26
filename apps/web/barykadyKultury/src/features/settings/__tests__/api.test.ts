import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "@/types/database.types";

import {
  fetchAdminOrganizationSettings,
  fetchPublicOrganizationSettings,
  saveOrganizationSettings
} from "../api";

/**
 * T-048 — the settings data seam.
 *
 * The public read MUST carry an explicit `visible = true` filter. RLS is the
 * authorization boundary, but the filter is the client-side expression of the
 * same rule; without it a future policy mistake would leak hidden facts into
 * anonymous payloads (docs/architecture.md §6.1 visibility rule).
 */

interface Captured {
  table?: string;
  select?: string;
  filters: { column: string; value: unknown }[];
  order?: { column: string; options: unknown };
  rpc?: { name: string; args: unknown };
}

interface FakeOptions {
  rows?: readonly Record<string, unknown>[];
  error?: { message: string } | null;
  rpcError?: { message: string } | null;
}

function fakeClient(options: FakeOptions = {}) {
  const captured: Captured = { filters: [] };

  const builder = {
    select(columns: string) {
      captured.select = columns;
      return builder;
    },
    eq(column: string, value: unknown) {
      captured.filters.push({ column, value });
      return builder;
    },
    order(column: string, orderOptions: unknown) {
      captured.order = { column, options: orderOptions };
      return builder;
    },
    // The Supabase query builder is a thenable; this fake reproduces the
    // minimal contract the data module awaits (a deliberate test double).
    // oxlint-disable-next-line unicorn/no-thenable
    then(
      resolve: (value: {
        data: readonly Record<string, unknown>[] | null;
        error: { message: string } | null;
      }) => unknown
    ) {
      return Promise.resolve({
        data: options.rows ?? [],
        error: options.error ?? null
      }).then(resolve);
    }
  };

  const client = {
    from(table: string) {
      captured.table = table;
      return builder;
    },
    rpc(name: string, args: unknown) {
      captured.rpc = { name, args };
      return Promise.resolve({
        data: null,
        error: options.rpcError ?? null
      });
    }
  } as unknown as SupabaseClient<Database>;

  return { client, captured };
}

const ROW = {
  key: "contact.email",
  value: { en: "kontakt@example.test" },
  visible: true,
  updated_by: null,
  updated_by_email: null,
  updated_at: "2026-10-26T10:00:00.000Z"
};

describe("fetchPublicOrganizationSettings", () => {
  it("queries organization_settings and explicitly filters visible rows", async () => {
    const { client, captured } = fakeClient({ rows: [ROW] });

    const result = await fetchPublicOrganizationSettings(client);

    expect(result.ok).toBe(true);
    expect(captured.table).toBe("organization_settings");
    expect(captured.select).toBe("key, value, visible");
    expect(captured.filters).toContainEqual({ column: "visible", value: true });
  });

  it("returns the mapped rows on success", async () => {
    const { client } = fakeClient({ rows: [ROW] });
    const result = await fetchPublicOrganizationSettings(client);

    expect(result).toEqual({
      ok: true,
      rows: [
        {
          key: "contact.email",
          value: { en: "kontakt@example.test" },
          visible: true,
          updated_by: null,
          updated_by_email: null,
          updated_at: null
        }
      ]
    });
  });

  it("degrades to unavailable without a client and failed on a query error", async () => {
    expect(await fetchPublicOrganizationSettings(null)).toEqual({
      ok: false,
      code: "unavailable"
    });

    const { client } = fakeClient({ error: { message: "boom" } });
    expect(await fetchPublicOrganizationSettings(client)).toEqual({
      ok: false,
      code: "failed",
      message: "boom"
    });
  });
});

describe("fetchAdminOrganizationSettings", () => {
  it("reads every row including audit columns and does not filter visibility", async () => {
    const { client, captured } = fakeClient({ rows: [ROW] });

    const result = await fetchAdminOrganizationSettings(client);

    expect(result.ok).toBe(true);
    expect(captured.table).toBe("organization_settings");
    expect(captured.select).toBe(
      "key, value, visible, updated_by, updated_by_email, updated_at"
    );
    expect(captured.filters).toEqual([]);
    expect(captured.order?.column).toBe("key");
  });
});

describe("saveOrganizationSettings", () => {
  it("sends one transactional RPC with the complete change set", async () => {
    const { client, captured } = fakeClient();
    const changes = [
      {
        key: "contact.email",
        value: { en: "kontakt@example.test" },
        visible: true
      }
    ];

    const result = await saveOrganizationSettings(client, changes);

    expect(result.ok).toBe(true);
    expect(captured.rpc).toEqual({
      name: "save_settings_v1",
      args: { p_changes: changes }
    });
  });

  it("maps a denied RPC to a stable failure code", async () => {
    const { client } = fakeClient({
      rpcError: { message: "admin role required" }
    });

    expect(
      await saveOrganizationSettings(client, [
        { key: "org.nip", value: { en: "" }, visible: false }
      ])
    ).toEqual({ ok: false, code: "failed", message: "admin role required" });
  });

  it("rejects an empty change set without a request", async () => {
    const { client, captured } = fakeClient();
    const result = await saveOrganizationSettings(client, []);

    expect(result).toEqual({ ok: false, code: "empty" });
    expect(captured.rpc).toBeUndefined();
  });
});
