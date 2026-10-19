import { describe, expect, test } from "bun:test";

import { parseStatusEnv, selectLocalStatus } from "./supabaseStatus";

describe("parseStatusEnv", () => {
  test("reads quoted KEY=VALUE lines and ignores warnings", () => {
    const parsed = parseStatusEnv(`
WARN: INBUCKET_URL is deprecated
API_URL="http://127.0.0.1:54321"
SERVICE_ROLE_KEY="service-role-value"
ANON_KEY="anon-value"
EMPTY=""
`);

    expect(parsed.API_URL).toBe("http://127.0.0.1:54321");
    expect(parsed.SERVICE_ROLE_KEY).toBe("service-role-value");
    expect(parsed.ANON_KEY).toBe("anon-value");
    expect(parsed.EMPTY).toBe("");
  });

  test("accepts single quotes and unquoted values", () => {
    const parsed = parseStatusEnv(
      "API_URL='http://localhost:54321'\nDB_URL=postgresql://x"
    );
    expect(parsed.API_URL).toBe("http://localhost:54321");
    expect(parsed.DB_URL).toBe("postgresql://x");
  });
});

describe("selectLocalStatus", () => {
  test("selects API URL, service-role key and publishable key", () => {
    const status = selectLocalStatus({
      API_URL: "http://127.0.0.1:54321",
      SERVICE_ROLE_KEY: "service-role-value",
      PUBLISHABLE_KEY: "publishable-value",
      ANON_KEY: "anon-value",
      DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    });

    expect(status.apiUrl).toBe("http://127.0.0.1:54321");
    expect(status.serviceRoleKey).toBe("service-role-value");
    expect(status.publishableKey).toBe("publishable-value");
    expect(status.dbUrl).toContain("54322");
  });

  test("falls back from SERVICE_ROLE_KEY to SECRET_KEY", () => {
    const status = selectLocalStatus({
      API_URL: "http://127.0.0.1:54321",
      SECRET_KEY: "secret-value"
    });
    expect(status.serviceRoleKey).toBe("secret-value");
  });

  test("fails closed when the API URL or service key is missing", () => {
    expect(() => selectLocalStatus({ SERVICE_ROLE_KEY: "x" })).toThrow();
    expect(() =>
      selectLocalStatus({ API_URL: "http://127.0.0.1:54321" })
    ).toThrow();
  });
});
