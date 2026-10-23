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
 * T-030 moved the position maths into `features/admin/shared/ordering` so the
 * featured list reuses the exact same contract. These wrappers keep the
 * T-028 names (and therefore every existing caller/test) stable.
 *
 * Positions are 1-based because the existing index and seed data use 1..n.
 */

import {
  moveItem,
  moveItemTo,
  nextPosition,
  normalizeOrder,
  type MoveDirection
} from "../shared/ordering";

export type TeamMoveDirection = MoveDirection;

export interface TeamPosition {
  readonly id: string;
  readonly sortOrder: number;
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
  return moveItem(ids, id, direction);
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
  return moveItemTo(ids, id, targetIndex);
}

/**
 * The exact rows the reorder RPC should persist: dense 1..n positions in the
 * supplied order. Because the sequence is generated from the array index,
 * duplicate positions are unrepresentable.
 */
export function normalizeTeamOrder(
  ids: readonly string[]
): readonly TeamPosition[] {
  return normalizeOrder(ids).map(({ id, position }) => ({
    id,
    sortOrder: position
  }));
}

/** Next free position for a new member (max + 1; empty team starts at 1). */
export function nextSortOrder(existingOrders: readonly number[]): number {
  return nextPosition(existingOrders);
}
