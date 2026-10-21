import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_READER_SETTINGS,
  LAST_USED_SETTINGS_KEY,
  LINE_SPACING_STEPS,
  MEASURE_STOPS,
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
    // 16 px body and 1.5 line-height: the defaults ARE the baseline; every
    // control step only adds. Paragraph spacing left the model entirely —
    // block rhythm is the DS baseline now (header-lane simplification).
    expect(TEXT_SIZE_STEPS[0]).toBe(1);
    expect(LINE_SPACING_STEPS[0]).toBe(1.5);
    expect(MEASURE_STOPS).toEqual(["narrow", "medium", "wide"]);
    expect(DEFAULT_READER_SETTINGS).toEqual({
      textSize: 0,
      measure: "medium",
      lineSpacing: 0
    });
  });

  it("drops the legacy paragraphSpacing key from stored payloads", () => {
    const clamped = clampReaderSettings({
      ...DEFAULT_READER_SETTINGS,
      paragraphSpacing: 2
    });
    expect(clamped).not.toHaveProperty("paragraphSpacing");
    expect(clamped).toEqual(DEFAULT_READER_SETTINGS);
  });

  it("keeps valid values untouched", () => {
    const valid: ReaderSettings = {
      textSize: 2,
      measure: "wide" as const,
      lineSpacing: 2
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
      lineSpacing: 1
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

/*
 * Queue-3 (settings inheritance): a reader who sizes the statute up should
 * not have to size up every later document too. The LAST committed choice
 * seeds documents never configured; a per-document commit always wins; and
 * "reset" must clear the inheritance source as well — otherwise re-opening
 * re-inherits the very values the reader just discarded.
 */
describe("settings inheritance across documents", () => {
  it("a never-configured document inherits the last committed settings", () => {
    const chosen: ReaderSettings = {
      textSize: 2,
      measure: "wide",
      lineSpacing: 1
    };
    saveReaderSettings(readerSettingsKey("document", "regulations"), chosen);

    expect(
      loadReaderSettings(readerSettingsKey("publication", "annual-report"))
    ).toEqual(chosen);
  });

  it("per-document commits win over the inherited last-used settings", () => {
    saveReaderSettings(readerSettingsKey("document", "a"), {
      textSize: 2,
      measure: "wide",
      lineSpacing: 1
    });
    saveReaderSettings(readerSettingsKey("document", "b"), {
      ...DEFAULT_READER_SETTINGS,
      textSize: 1
    });

    expect(loadReaderSettings(readerSettingsKey("document", "a"))).toEqual({
      textSize: 2,
      measure: "wide",
      lineSpacing: 1
    });
  });

  it("reset clears the document entry AND the inheritance source", () => {
    const key = readerSettingsKey("document", "regulations");
    saveReaderSettings(key, { textSize: 3, measure: "narrow", lineSpacing: 2 });

    removeReaderSettings(key);

    expect(loadReaderSettings(key)).toEqual(DEFAULT_READER_SETTINGS);
    expect(
      loadReaderSettings(readerSettingsKey("publication", "never-opened"))
    ).toEqual(DEFAULT_READER_SETTINGS);
  });

  it("a corrupt last-used payload falls back to defaults, never throws", () => {
    localStorage.setItem(readerSettingsKey("document", "a"), "{oops");
    localStorage.setItem(LAST_USED_SETTINGS_KEY, "]nope[");

    expect(loadReaderSettings(readerSettingsKey("document", "b"))).toEqual(
      DEFAULT_READER_SETTINGS
    );
  });
});
