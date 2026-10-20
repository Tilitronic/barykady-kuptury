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
export const MEASURE_WIDTHS: Record<ReaderMeasure, string> = {
  narrow: "50ch",
  medium: "65ch",
  wide: "78ch"
};
/** Rendered `line-height` multipliers; step 0 is the DS baseline (never less). */
export const LINE_SPACING_STEPS = [1.5, 1.75, 2, 2.25] as const;
/** Paragraph bottom space in rem; step 0 is the DS baseline. */
export const PARAGRAPH_SPACING_STEPS = [1, 1.35, 1.75, 2.25] as const;

export interface ReaderSettings {
  readonly textSize: number;
  readonly measure: ReaderMeasure;
  readonly lineSpacing: number;
  readonly paragraphSpacing: number;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  // Step 0 everywhere: the DS baseline is the default, larger steps add.
  textSize: 0,
  measure: "medium",
  lineSpacing: 0,
  paragraphSpacing: 0
};

const STORAGE_PREFIX = "bk.reader";

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
    ),
    paragraphSpacing: clampStep(
      candidate.paragraphSpacing,
      PARAGRAPH_SPACING_STEPS.length,
      DEFAULT_READER_SETTINGS.paragraphSpacing
    )
  };
}

export function loadReaderSettings(key: string): ReaderSettings {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return { ...DEFAULT_READER_SETTINGS };
  }
  if (raw === null) return { ...DEFAULT_READER_SETTINGS };

  try {
    return clampReaderSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_READER_SETTINGS };
  }
}

/** Storage failures (quota, private mode) must never break the reader. */
export function saveReaderSettings(
  key: string,
  settings: ReaderSettings
): void {
  try {
    localStorage.setItem(key, JSON.stringify(clampReaderSettings(settings)));
  } catch {
    /* ignored by design: preferences are enhancement, not function */
  }
}

export function removeReaderSettings(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignored — see saveReaderSettings */
  }
}
