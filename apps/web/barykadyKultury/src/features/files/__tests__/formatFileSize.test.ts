import { describe, expect, it } from "vitest";

import { formatFileSize } from "@/features/files/formatFileSize";

/**
 * Pure display helper (T-020): file sizes are labelled in binary units with
 * one decimal, formatted through Intl so the locale's number separators are
 * honoured (Polish decimal comma). `null` (unknown size) renders nothing —
 * never a fabricated "—".
 */
describe("formatFileSize", () => {
  it("formats zero and byte counts with locale grouping", () => {
    expect(formatFileSize(0, "en")).toBe("0 B");
    expect(formatFileSize(512, "en")).toBe("512 B");
    expect(formatFileSize(1023, "en")).toBe("1,023 B");
  });

  it("switches to KB at 1024 bytes with one decimal", () => {
    expect(formatFileSize(1024, "en")).toBe("1 KB");
    expect(formatFileSize(12345, "en")).toBe("12.1 KB"); // 12345/1024 = 12.056
    expect(formatFileSize(23456, "en")).toBe("22.9 KB");
  });

  it("switches to MB and GB at the binary boundaries", () => {
    expect(formatFileSize(1048576, "en")).toBe("1 MB");
    expect(formatFileSize(5_000_000, "en")).toBe("4.8 MB");
    expect(formatFileSize(3_221_225_472, "en")).toBe("3 GB");
  });

  it("uses the locale number separators", () => {
    expect(formatFileSize(23456, "pl")).toBe("22,9 KB");
  });
});
