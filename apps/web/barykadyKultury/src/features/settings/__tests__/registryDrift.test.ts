import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import messagesEn from "@/i18n/en";
import messagesPl from "@/i18n/pl";
import messagesUk from "@/i18n/uk";

import {
  SETTING_DEFINITIONS,
  SETTING_KEYS,
  SETTINGS_SENTINEL_KEY
} from "../definition";

/**
 * T-048 — drift guardrails for the settings registry.
 *
 * The key vocabulary is expressed in three places that must not diverge:
 *   1. the TypeScript definitions (form + resolver),
 *   2. the SQL whitelist inside `save_settings_v1` (the authoritative write
 *      contract),
 *   3. the en/pl/uk field labels rendered by the form.
 *
 * A new fact added to only one place would either be unwritable, unrenderable
 * or untranslated; this test fails at the first divergence.
 */

function findRepoRoot(start: string): string {
  let current = resolve(start);
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(current, "docs", "architecture.md"))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`settings drift guard cannot locate repo root from ${start}`);
}

const REPO_ROOT = findRepoRoot(process.cwd());

function migrationSql(): string {
  const path = join(
    REPO_ROOT,
    "supabase",
    "migrations",
    "20261026120000_organization_settings.sql"
  );
  if (!existsSync(path)) {
    throw new Error(`settings drift guard cannot find ${path}`);
  }
  return readFileSync(path, "utf8");
}

/** Keys accepted by the RPC's `v_key not in (...)` guard. */
function sqlKeys(): string[] {
  const sql = migrationSql();
  const block = /v_key not in\s*\(([\s\S]*?)\)\s*then/.exec(sql);
  if (block === null) {
    throw new Error("settings drift guard cannot find the SQL key whitelist");
  }
  const keys = [...(block[1] ?? "").matchAll(/'([^']+)'/g)].map(
    match => match[1] ?? ""
  );
  return [...new Set(keys)].sort();
}

function labelAt(catalogue: unknown, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      catalogue
    );
}

describe("organization-settings registry drift guardrail", () => {
  it("keeps the TypeScript definitions and the SQL whitelist identical", () => {
    // The writable vocabulary is exactly the editable facts. The provisioning
    // sentinel is inserted by the RPC itself and must not be client-writable.
    expect(sqlKeys()).toEqual([...SETTING_KEYS].sort());
    expect(sqlKeys()).not.toContain(SETTINGS_SENTINEL_KEY);
  });

  it("has a non-empty localized label for every definition in en/pl/uk", () => {
    for (const locale of ["en", "pl", "uk"] as const) {
      const catalogue =
        locale === "en"
          ? messagesEn
          : locale === "pl"
            ? messagesPl
            : messagesUk;

      for (const definition of SETTING_DEFINITIONS) {
        const label = labelAt(catalogue, definition.labelKey);
        expect(
          typeof label === "string" && label.trim().length > 0,
          `${locale}: ${definition.labelKey}`
        ).toBe(true);
      }
    }
  });

  it("declares each key exactly once", () => {
    expect(new Set(SETTING_KEYS).size).toBe(SETTING_KEYS.length);
  });
});
