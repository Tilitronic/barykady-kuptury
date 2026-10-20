import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_READER_SETTINGS,
  LINE_SPACING_STEPS,
  PARAGRAPH_SPACING_STEPS,
  TEXT_SIZE_STEPS,
  clampReaderSettings,
  loadReaderSettings,
  readerSettingsKey,
  removeReaderSettings,
  saveReaderSettings,
  type ReaderSettings
} from "../readerSettings";

/**
 * T-040 (D-34) — persisted reading preferences.
 *
 * The store is deliberately dumb: validation, localStorage and the per-reader
 * key builder are pure enough to test without a component, and the renderer
 * only consumes the clamped result. Corrupt or hostile payloads fall back to
 * defaults step-by-step (never a partial apply, never a throw).
 */

beforeEach(() => {
  localStorage.clear();
});

describe("readerSettingsKey", () => {
  it("scopes settings per reader (kind + canonical slug)", () => {
    expect(readerSettingsKey("document", "regulations")).toBe(
      "bk.reader.document.regulations"
    );
    expect(readerSettingsKey("publication", "annual-report")).toBe(
      "bk.reader.publication.annual-report"
    );
  });
});

describe("clampReaderSettings", () => {
  it("step 0 is the DESIGN_SYSTEM baseline — never below (rev-1 F)", () => {
    // 16 px body, 1.5 line-height, 1 rem paragraph space: the defaults ARE
    // the baseline; every control step only adds.
    expect(TEXT_SIZE_STEPS[0]).toBe(1);
    expect(LINE_SPACING_STEPS[0]).toBe(1.5);
    expect(PARAGRAPH_SPACING_STEPS[0]).toBe(1);
    expect(DEFAULT_READER_SETTINGS).toEqual({
      textSize: 0,
      measure: "medium",
      lineSpacing: 0,
      paragraphSpacing: 0
    });
  });

  it("keeps valid values untouched", () => {
    const valid: ReaderSettings = {
      textSize: 2,
      measure: "wide" as const,
      lineSpacing: 2,
      paragraphSpacing: 1
    };
    expect(clampReaderSettings(valid)).toEqual(valid);
  });

  it("clamps numeric steps into range", () => {
    expect(
      clampReaderSettings({ ...DEFAULT_READER_SETTINGS, textSize: 99 }).textSize
    ).toBe(
      3 // highest step index
    );
    expect(
      clampReaderSettings({ ...DEFAULT_READER_SETTINGS, textSize: -3 }).textSize
    ).toBe(0);
  });

  it("rejects unknown measures and non-numbers", () => {
    expect(
      clampReaderSettings({
        ...DEFAULT_READER_SETTINGS,
        measure: "huge"
      } as never).measure
    ).toBe(DEFAULT_READER_SETTINGS.measure);
    expect(
      clampReaderSettings({
        ...DEFAULT_READER_SETTINGS,
        lineSpacing: "2"
      } as never).lineSpacing
    ).toBe(DEFAULT_READER_SETTINGS.lineSpacing);
  });

  it("falls back entirely for non-objects", () => {
    for (const junk of [null, undefined, "nope", 42, []]) {
      expect(clampReaderSettings(junk)).toEqual(DEFAULT_READER_SETTINGS);
    }
  });
});

describe("localStorage round-trip", () => {
  it("saves and loads the same clamped settings", () => {
    const key = readerSettingsKey("document", "regulations");
    const settings: ReaderSettings = {
      textSize: 3,
      measure: "narrow",
      lineSpacing: 1,
      paragraphSpacing: 2
    };

    saveReaderSettings(key, settings);

    expect(loadReaderSettings(key)).toEqual(settings);
  });

  it("returns defaults when nothing is stored", () => {
    expect(loadReaderSettings("bk.reader.document.absent")).toEqual(
      DEFAULT_READER_SETTINGS
    );
  });

  it("returns defaults for corrupt JSON", () => {
    const key = readerSettingsKey("document", "regulations");
    localStorage.setItem(key, "{not json");

    expect(loadReaderSettings(key)).toEqual(DEFAULT_READER_SETTINGS);
  });

  it("removes the stored entry on reset", () => {
    const key = readerSettingsKey("publication", "report");
    saveReaderSettings(key, { ...DEFAULT_READER_SETTINGS, textSize: 1 });

    removeReaderSettings(key);

    expect(localStorage.getItem(key)).toBeNull();
    expect(loadReaderSettings(key)).toEqual(DEFAULT_READER_SETTINGS);
  });

  it("survives storage failures without throwing", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });

    expect(() =>
      saveReaderSettings(
        readerSettingsKey("document", "x"),
        DEFAULT_READER_SETTINGS
      )
    ).not.toThrow();

    setItem.mockRestore();
  });
});
