import { describe, expect, test } from "bun:test";

import { buildDemoPdf } from "./pdf";

describe("buildDemoPdf", () => {
  test("emits a minimal, self-contained PDF with an xref and EOF marker", () => {
    const pdf = buildDemoPdf({
      title: "Demo Publication (Fictional)",
      subtitle: "Local demo environment",
      lines: ["This file is generated for local design testing only."]
    }).toString("latin1");

    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf).toContain("/Type /Catalog");
    expect(pdf).toContain("/Type /Page");
    expect(pdf).toContain("/BaseFont /Helvetica");
    expect(pdf).toContain("Demo Publication \\(Fictional\\)");
    expect(pdf).toContain("xref");
    expect(pdf).toContain("startxref");
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  test("escapes PDF string delimiters and replaces non-Latin-1 characters", () => {
    const pdf = buildDemoPdf({
      title: "Parentheses (demo) \\ test — ąę"
    }).toString("latin1");

    expect(pdf).toContain("Parentheses \\(demo\\) \\\\ test");
    expect(pdf).not.toContain("—");
  });

  test("is deterministic", () => {
    const build = () =>
      buildDemoPdf({ title: "Stable", lines: ["one", "two"] });
    expect(build()).toEqual(build());
  });

  test("keeps the xref offset pointing at the xref table", () => {
    const pdf = buildDemoPdf({ title: "Offsets", lines: ["line"] }).toString(
      "latin1"
    );
    const match = pdf.match(/startxref\n(\d+)\n%%EOF/);
    expect(match).not.toBeNull();
    const offset = Number(match![1]);
    expect(pdf.slice(offset, offset + 4)).toBe("xref");
  });
});
