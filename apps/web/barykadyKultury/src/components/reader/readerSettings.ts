/**
 * Reader preference store (T-040, D-34).
 *
 * Pure module: the step model, validation, the per-reader localStorage key
 * and the storage round-trip. The UI components own no persistence logic,
 * so "persisted per reader", "reset" and hostile-payload safety are testable
 * without a component (docs/TESTING.md §2).
 *
 * Steps (not free values): every control maps to a small ordered list so the
 * rendered typography always matches a DESIGN_SYSTEM.md §2 baseline or a
 * documented step above it — line spacing never drops below 1.5, and the
 * narrow measure never goes under comfortable line lengths.
 */

export const TEXT_SIZE_STEPS = [1, 1.1875, 1.375, 1.625] as const;
export type ReaderMeasure = "narrow" | "medium" | "wide";
/** Slider order for the measure control (index = step). */
export const MEASURE_STOPS: readonly ReaderMeasure[] = [
  "narrow",
  "medium",
  "wide"
];
export const MEASURE_WIDTHS: Record<ReaderMeasure, string> = {
  narrow: "50ch",
  medium: "65ch",
  wide: "78ch"
};
/** Rendered `line-height` multipliers; step 0 is the DS baseline (never less). */
export const LINE_SPACING_STEPS = [1.5, 1.75, 2, 2.25] as const;

export interface ReaderSettings {
  readonly textSize: number;
  readonly measure: ReaderMeasure;
  readonly lineSpacing: number;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  // Step 0 everywhere: the DS baseline is the default, larger steps add.
  textSize: 0,
  measure: "medium",
  lineSpacing: 0
};

const STORAGE_PREFIX = "bk.reader";

/**
 * Settings inheritance (queue-3): the LAST committed choice seeds every
 * document the reader never configured. Per-document commits always win;
 * `removeReaderSettings` clears this source too so "reset" is honest —
 * re-opening must not re-inherit the values the reader just discarded.
 */
export const LAST_USED_SETTINGS_KEY = `${STORAGE_PREFIX}.last`;

export function readerSettingsKey(
  kind: "document" | "publication",
  slug: string
): string {
  return `${STORAGE_PREFIX}.${kind}.${slug}`;
}

function clampStep(value: unknown, length: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.round(value), 0), length - 1);
}

/** Defensive normalizer: any shape in, valid settings out. */
export function clampReaderSettings(value: unknown): ReaderSettings {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_READER_SETTINGS };
  }

  const candidate = value as Record<string, unknown>;
  const measure = candidate.measure;

  return {
    textSize: clampStep(
      candidate.textSize,
      TEXT_SIZE_STEPS.length,
      DEFAULT_READER_SETTINGS.textSize
    ),
    measure:
      measure === "narrow" || measure === "medium" || measure === "wide"
        ? measure
        : DEFAULT_READER_SETTINGS.measure,
    lineSpacing: clampStep(
      candidate.lineSpacing,
      LINE_SPACING_STEPS.length,
      DEFAULT_READER_SETTINGS.lineSpacing
    )
  };
}

/**
 * One storage read: absent or unparsable payload == null (the caller decides
 * the fallback), valid JSON is clamped step-by-step so a hostile payload can
 * never apply partially.
 */
function readStoredSettings(key: string): ReaderSettings | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;

  try {
    return clampReaderSettings(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeStoredSettings(key: string, settings: ReaderSettings): void {
  try {
    localStorage.setItem(key, JSON.stringify(settings));
  } catch {
    /* ignored by design: preferences are enhancement, not function */
  }
}

/**
 * Layered read (queue-3): the document's own committed settings win; a
 * document never configured inherits the reader's last-used choice; with no
 * history at all the DS baseline applies. Storage failures are invisible to
 * the reader — every level degrades to the next.
 */
export function loadReaderSettings(key: string): ReaderSettings {
  return (
    readStoredSettings(key) ??
    readStoredSettings(LAST_USED_SETTINGS_KEY) ?? { ...DEFAULT_READER_SETTINGS }
  );
}

/** Committing for one document also becomes the inheritance source. */
export function saveReaderSettings(
  key: string,
  settings: ReaderSettings
): void {
  const clean = clampReaderSettings(settings);
  writeStoredSettings(key, clean);
  if (key !== LAST_USED_SETTINGS_KEY) {
    writeStoredSettings(LAST_USED_SETTINGS_KEY, clean);
  }
}

/**
 * Reset = this document back to the baseline AND stop re-inheriting the
 * discarded choice into fresh documents (see LAST_USED_SETTINGS_KEY note).
 * Documents the reader configured by hand keep their own stored values.
 */
export function removeReaderSettings(key: string): void {
  try {
    localStorage.removeItem(key);
    if (key !== LAST_USED_SETTINGS_KEY) {
      localStorage.removeItem(LAST_USED_SETTINGS_KEY);
    }
  } catch {
    /* ignored — see saveReaderSettings */
  }
}
