import { describe, expect, test } from "bun:test";

import {
  buildDbReferenceQuery,
  buildDemoDigestQuery,
  parseCountRows,
  parseDbReferenceRows,
  readProjectId
} from "./db";

describe("readProjectId", () => {
  test("reads the first project_id from config.toml", () => {
    expect(readProjectId('project_id = "barykadyKultury"\n')).toBe(
      "barykadyKultury"
    );
  });

  test("fails when project_id is absent", () => {
    expect(() => readProjectId("[db]\nport = 54322\n")).toThrow();
  });
});

describe("database reference query parsing", () => {
  test("parses bucket|path rows and ignores blanks", () => {
    const rows = parseDbReferenceRows(
      "public-media|demo/projects/a-cover.png\n\npublic-documents|demo/documents/b-en.pdf\n"
    );
    expect(rows).toEqual([
      { bucket: "public-media", path: "demo/projects/a-cover.png" },
      { bucket: "public-documents", path: "demo/documents/b-en.pdf" }
    ]);
  });

  test("queries every table that stores a public object path", () => {
    const sql = buildDbReferenceQuery();
    expect(sql).toContain("public.projects");
    expect(sql).toContain("public.team_members");
    expect(sql).toContain("public.publication_files");
    expect(sql).toContain("public.organization_documents");
    expect(sql).toContain("cover_path");
    expect(sql).toContain("portrait_path");
  });

  test("demo digest covers every content table touched by seed.demo.sql", () => {
    const sql = buildDemoDigestQuery();
    for (const table of [
      "site_pages",
      "site_page_translations",
      "projects",
      "project_translations",
      "team_members",
      "team_member_translations",
      "publications",
      "publication_translations",
      "publication_files",
      "organization_documents",
      "organization_document_translations",
      "calendar_event_links"
    ]) {
      expect(sql).toContain(`public.${table}`);
    }
  });
});

describe("parseCountRows", () => {
  test("parses key|value rows", () => {
    const counts = parseCountRows("projects|8\nfeatured_ranks|1,2,5\n");
    expect(counts.get("projects")).toBe("8");
    expect(counts.get("featured_ranks")).toBe("1,2,5");
  });
});
