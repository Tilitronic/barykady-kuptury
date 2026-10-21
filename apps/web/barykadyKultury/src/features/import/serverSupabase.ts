import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "../../types/database.types";

/**
 * Minimal server-side Supabase REST/Storage adapter used by Netlify functions.
 *
 * The app's browser client is not suitable here: background/scheduled functions
 * need a service-role key and run outside the SPA. Keeping the adapter on
 * `fetch` avoids a second package installation in `netlify/functions` and makes
 * the secret boundary explicit. It is never imported by a public route.
 *
 * Requests never log or echo the key or an upstream body.
 */
export interface ServerSupabaseConfig {
  readonly url: string;
  readonly serviceKey: string;
  readonly fetchImpl?: typeof fetch;
}

export interface AdminIdentity {
  readonly id: string;
  readonly email: string | null;
}

function normalizedUrl(config: ServerSupabaseConfig): string {
  return config.url.replace(/\/+$/u, "");
}

function headers(
  config: ServerSupabaseConfig,
  extra: Readonly<Record<string, string>> = {}
): Record<string, string> {
  return {
    apikey: config.serviceKey,
    authorization: `Bearer ${config.serviceKey}`,
    accept: "application/json",
    ...extra
  };
}

export async function selectRows(
  config: ServerSupabaseConfig,
  table: string,
  query: string
): Promise<Record<string, unknown>[]> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `${normalizedUrl(config)}/rest/v1/${table}?${query}`,
    { headers: headers(config) }
  );
  if (!response.ok) return [];
  const payload: unknown = await response.json();
  return Array.isArray(payload)
    ? payload.filter(
        (row): row is Record<string, unknown> =>
          typeof row === "object" && row !== null
      )
    : [];
}

export async function updateRows(
  config: ServerSupabaseConfig,
  table: string,
  query: string,
  patch: Record<string, unknown>
): Promise<boolean> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `${normalizedUrl(config)}/rest/v1/${table}?${query}`,
    {
      method: "PATCH",
      headers: headers(config, {
        "content-type": "application/json",
        prefer: "return=minimal"
      }),
      body: JSON.stringify(patch)
    }
  );
  return response.ok;
}

export async function insertRows(
  config: ServerSupabaseConfig,
  table: string,
  value: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `${normalizedUrl(config)}/rest/v1/${table}`,
    {
      method: "POST",
      headers: headers(config, {
        "content-type": "application/json",
        prefer: "return=representation"
      }),
      body: JSON.stringify(value)
    }
  );
  if (!response.ok) return null;
  const payload: unknown = await response.json();
  return Array.isArray(payload) && typeof payload[0] === "object"
    ? (payload[0] as Record<string, unknown>)
    : null;
}

export async function callServiceRpc(
  config: ServerSupabaseConfig,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `${normalizedUrl(config)}/rest/v1/rpc/${name}`,
    {
      method: "POST",
      headers: headers(config, { "content-type": "application/json" }),
      body: JSON.stringify(args)
    }
  );
  if (!response.ok) return null;
  // Void RPCs (record_content_check_result_v1) return an empty body/204.
  if (response.status === 204) return null;
  const text = await response.text();
  if (text === "") return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function verifyAdminToken(
  config: ServerSupabaseConfig,
  token: string
): Promise<AdminIdentity | null> {
  if (token.trim() === "") return null;
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(`${normalizedUrl(config)}/auth/v1/user`, {
    headers: {
      apikey: config.serviceKey,
      authorization: `Bearer ${token}`,
      accept: "application/json"
    }
  });
  if (!response.ok) return null;

  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null) return null;
  const user = payload as {
    id?: unknown;
    email?: unknown;
    app_metadata?: { role?: unknown };
  };
  if (typeof user.id !== "string") return null;
  if (user.app_metadata?.role !== "admin") return null;

  return {
    id: user.id,
    email: typeof user.email === "string" ? user.email : null
  };
}

interface StorageUploadOptions {
  readonly contentType?: string;
  readonly upsert?: boolean;
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map(segment => encodeURIComponent(segment))
    .join("/");
}

/**
 * The subset `persistConvertedTranslation` needs. The cast is confined to this
 * adapter: the writer remains compiled against the generated Supabase types.
 */
export function createServerSupabaseClient(
  config: ServerSupabaseConfig
): SupabaseClient<Database> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const url = normalizedUrl(config);

  const storage = {
    from: (bucket: string) => ({
      upload: async (
        path: string,
        bytes: ArrayBuffer,
        options: StorageUploadOptions = {}
      ) => {
        const response = await fetchImpl(
          `${url}/storage/v1/object/${bucket}/${encodePath(path)}`,
          {
            method: "POST",
            headers: headers(config, {
              "content-type": options.contentType ?? "application/octet-stream",
              "x-upsert": options.upsert === false ? "false" : "true"
            }),
            body: bytes
          }
        );
        return response.ok
          ? { data: { path }, error: null }
          : { data: null, error: { message: "storage upload failed" } };
      },
      remove: async (paths: string[]) => {
        const response = await fetchImpl(`${url}/storage/v1/object/${bucket}`, {
          method: "DELETE",
          headers: headers(config, { "content-type": "application/json" }),
          body: JSON.stringify({ prefixes: paths })
        });
        return response.ok
          ? { data: [], error: null }
          : { data: null, error: { message: "storage remove failed" } };
      }
    })
  };

  const rpc = async (name: string, args: Record<string, unknown>) => {
    try {
      const data = await callServiceRpc(config, name, args);
      if (data === null) {
        return { data: null, error: { message: "rpc failed" } };
      }
      return { data, error: null };
    } catch {
      return { data: null, error: { message: "rpc failed" } };
    }
  };

  return { storage, rpc } as unknown as SupabaseClient<Database>;
}

export type JsonObject = { readonly [key: string]: Json };
