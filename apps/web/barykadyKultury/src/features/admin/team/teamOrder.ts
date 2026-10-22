/**
 * T-028 — deterministic team ordering.
 *
 * Design authority:
 *   - docs/PRODUCT_REQUIREMENTS.md §4-About: team members are presented
 *     consistently, in an editorial order.
 *   - docs/architecture.md §4: ordering is locale-independent and lives on the
 *     root row (`sort_order`).
 *   - T-028 acceptance: "Team reorder persists, is collision-free, and is
 *     keyboard operable." The UI renders explicit Up/Down buttons (never a
 *     drag-only interaction); this module owns the position maths so every
 *     caller writes the same gap-free 1..n sequence.
 *
 * Positions are 1-based because the existing index and seed data use 1..n.
 */

export type TeamMoveDirection = "up" | "down";

export interface TeamPosition {
  readonly id: string;
  readonly sortOrder: number;
}

function indexOf(ids: readonly string[], id: string): number {
  return ids.indexOf(id);
}

/**
 * Moves one member one position in `direction`.
 *
 * Returns a new array, or a copy of the input at the ends/for an unknown id.
 * A copy (rather than the same reference) keeps `onMove` handlers predictable:
 * the page can always await a reorder, even when nothing changed.
 */
export function moveTeamMember(
  ids: readonly string[],
  id: string,
  direction: TeamMoveDirection
): string[] {
  const next = [...ids];
  const index = indexOf(next, id);
  if (index === -1) return next;

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= next.length) return next;

  const [moved] = next.splice(index, 1);
  if (moved === undefined) return next;
  next.splice(target, 0, moved);
  return next;
}

/**
 * Moves one member to an explicit index (used by "move before/after" controls
 * and by keyboard shortcuts). Out-of-range targets are clamped so a caller
 * cannot create a hole.
 */
export function reorderTeamMembers(
  ids: readonly string[],
  id: string,
  targetIndex: number
): string[] {
  const next = [...ids];
  const index = indexOf(next, id);
  if (index === -1) return next;

  const target = Math.max(0, Math.min(next.length - 1, targetIndex));
  if (target === index) return next;

  const [moved] = next.splice(index, 1);
  if (moved === undefined) return next;
  next.splice(target, 0, moved);
  return next;
}

/**
 * The exact rows the reorder RPC should persist: dense 1..n positions in the
 * supplied order. Because the sequence is generated from the array index,
 * duplicate positions are unrepresentable.
 */
export function normalizeTeamOrder(
  ids: readonly string[]
): readonly TeamPosition[] {
  return ids.map((id, index) => ({ id, sortOrder: index + 1 }));
}

/** Next free position for a new member (max + 1; empty team starts at 1). */
export function nextSortOrder(existingOrders: readonly number[]): number {
  return existingOrders.reduce((max, order) => Math.max(max, order), 0) + 1;
}
