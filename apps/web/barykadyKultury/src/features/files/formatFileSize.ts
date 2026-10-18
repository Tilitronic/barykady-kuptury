import type { Locale } from "@/features/i18n/locales";

/**
 * Binary-unit file size label (T-020): B up to 1023, then KB/MB/GB/TB with
 * at most one decimal. Sizes are storage-reported bytes, so the binary base
 * matches how the platforms the NGO uploads from display them; the number
 * itself is Intl-formatted per the active locale (Polish decimal comma).
 */
const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

const KIBIBYTE = 1024;

export function formatFileSize(bytes: number, locale: Locale): string {
  let value = bytes;
  let unit = 0;

  while (value >= KIBIBYTE && unit < UNITS.length - 1) {
    value /= KIBIBYTE;
    unit += 1;
  }

  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1
  }).format(value);

  return `${formatted} ${UNITS[unit]}`;
}
