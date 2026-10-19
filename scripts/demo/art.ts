/**
 * Deterministic, brand-safe demo artwork.
 *
 * Design authority: docs/DESIGN_SYSTEM.md §1 — the verified palette contains
 * exactly SCARLET #C60001, NERO #262424 and GRAY93 #EDEDED. Using only those
 * three values keeps every generated cover/avatar inside the brand and makes
 * the assets obviously synthetic (no borrowed photography, no invented people).
 *
 * The shapes are derived from a hash of the asset slug, so a rebuild produces
 * the same file and different projects/members still look distinct.
 */
import { encodePng, type Rgb } from "./png";

export const BRAND = {
  scarlet: { r: 198, g: 0, b: 1 },
  nero: { r: 38, g: 36, b: 36 },
  gray: { r: 237, g: 237, b: 237 }
} as const satisfies Record<string, Rgb>;

const COVER_WIDTH = 960;
const COVER_HEIGHT = 540;
const AVATAR_SIZE = 384;

function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function inCircle(
  x: number,
  y: number,
  cx: number,
  cy: number,
  radius: number
): boolean {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * 16:9 cover: a flat GRAY93 field, a NERO horizon band, a SCARLET disc and a
 * small SCARLET square. The disc/band offsets are slug-derived.
 */
export function renderProjectCover(slug: string): Buffer {
  const h = hash(slug);
  const variant = h % 3;
  const discX = Math.round(
    COVER_WIDTH * (variant === 0 ? 0.32 : variant === 1 ? 0.7 : 0.5)
  );
  const discY = Math.round(COVER_HEIGHT * (variant === 2 ? 0.5 : 0.38));
  const discRadius = 170 + (h % 60);
  const horizon = Math.round(COVER_HEIGHT * (0.68 + ((h >>> 8) % 10) / 100));
  const barX = Math.round(COVER_WIDTH * (0.15 + ((h >>> 16) % 50) / 100));

  return encodePng(COVER_WIDTH, COVER_HEIGHT, (x, y) => {
    if (y >= horizon) return BRAND.nero;
    if (inCircle(x, y, discX, discY, discRadius)) {
      return inCircle(x, y, discX, discY, Math.round(discRadius * 0.55))
        ? BRAND.gray
        : BRAND.scarlet;
    }
    if (x >= barX && x < barX + 28 && y > 64 && y < horizon - 48) {
      return BRAND.nero;
    }
    if (x >= COVER_WIDTH - 150 && y >= 48 && x < COVER_WIDTH - 78 && y < 120) {
      return BRAND.scarlet;
    }
    return BRAND.gray;
  });
}

/**
 * Square avatar: a geometric medallion with no face, initials or personal data.
 * Alternating NERO/GRAY93 backgrounds keep the five cards visually distinct.
 */
export function renderTeamAvatar(slug: string): Buffer {
  const h = hash(slug);
  const dark = h % 2 === 0;
  const background = dark ? BRAND.nero : BRAND.gray;
  const foreground = dark ? BRAND.gray : BRAND.nero;
  const cx = AVATAR_SIZE / 2;
  const cy = AVATAR_SIZE / 2;
  const offset = (h >>> 5) % 36;

  return encodePng(AVATAR_SIZE, AVATAR_SIZE, (x, y) => {
    if (inCircle(x, y, cx, cy, 154 + offset)) {
      if (inCircle(x, y, cx, cy, 86 + (offset % 20))) return background;
      return BRAND.scarlet;
    }

    // Four notches make the medallion read as a deliberate icon, not a photo.
    const notch = 26;
    const nearCenterX = Math.abs(x - cx) < notch;
    const nearCenterY = Math.abs(y - cy) < notch;
    if (
      (nearCenterX && (y < 36 || y > AVATAR_SIZE - 36)) ||
      (nearCenterY && (x < 36 || x > AVATAR_SIZE - 36))
    ) {
      return foreground;
    }

    return background;
  });
}
