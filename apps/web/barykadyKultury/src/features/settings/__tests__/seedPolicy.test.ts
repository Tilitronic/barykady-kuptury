import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { SETTING_DEFINITION_BY_KEY } from "../definition";
import { validateSettingValue } from "../validation";

/**
 * T-048 gate fix — seed policy guard.
 *
 * Production organization facts are authored by a root administrator after
 * deploy, never seeded. The seed files may therefore contain only clearly
 * fictional values: example.test names/addresses/URLs and identifier-shaped
 * placeholders whose checksums are deliberately invalid. This test fails if a
 * verified identifier, real social URL or real organization name returns to a
 * seed.
 */

function findRepoRoot(start: string): string {
  let current = resolve(start);
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(current, "docs", "architecture.md"))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`seed policy guard cannot locate repo root from ${start}`);
}

const REPO_ROOT = findRepoRoot(process.cwd());

function settingsBlock(file: string): string {
  const path = join(REPO_ROOT, "supabase", file);
  if (!existsSync(path)) {
    throw new Error(`seed policy guard cannot find ${path}`);
  }
  const sql = readFileSync(path, "utf8");
  const index = sql.indexOf("-- T-048 organization settings");
  if (index === -1) {
    throw new Error(`seed policy guard cannot find the T-048 block in ${file}`);
  }
  return sql.slice(index);
}

const FORBIDDEN = [
  "7831961912",
  "545503070",
  "Barykady Kultury",
  "BARYKADYKULTURY",
  "instagram.com/barykadykultury",
  "t.me/barykadykultury",
  "@barykadykultury"
];

describe.each(["seed.sql", "seed.demo.sql"])(
  "organization settings seed policy (%s)",
  file => {
    const block = settingsBlock(file);

    it("contains no verified production identifier, name or social URL", () => {
      for (const value of FORBIDDEN) {
        expect(block.includes(value), `${file}: ${value}`).toBe(false);
      }
    });

    it("uses clearly fictional example.test contact and social values", () => {
      expect(block).toContain("Example Culture Association (Fictional)");
      expect(block).toContain("Example City");
      expect(block).toContain("contact@example.test");
      expect(block).toContain("https://social.example.test/facebook");
      expect(block).toContain("https://example.test/privacy");
    });

    it("ships identifier-shaped placeholders with invalid checksums", () => {
      const nip = SETTING_DEFINITION_BY_KEY.get("org.nip");
      const regon = SETTING_DEFINITION_BY_KEY.get("org.regon");
      if (!nip || !regon) throw new Error("missing identifier definitions");

      expect(block).toContain('{"en":"1234567890"}');
      expect(block).toContain('{"en":"123456789"}');
      expect(validateSettingValue(nip, { en: "1234567890" })).toBe("nip");
      expect(validateSettingValue(regon, { en: "123456789" })).toBe("regon");
    });
  }
);
