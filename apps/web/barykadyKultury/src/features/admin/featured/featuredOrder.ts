/**
 * T-030 — deterministic homepage featured ordering.
 *
 * Design authority:
 *   - docs/PRODUCT_REQUIREMENTS.md §5: featured projects appear "in configured
 *     order"; §6 gives administrators control of the order.
 *   - docs/architecture.md §4: ordering is locale-independent and lives on the
 *     root `projects.featured_rank`.
 *   - T-030 acceptance: ranks stay gap-free and unique after any add/remove/
 *     move sequence; reordering is keyboard operable (explicit Up/Down).
 *
 * This is the T-028 contract applied to projects. The pure maths lives in
 * `features/admin/shared/ordering`; this module only names the domain
 * (`rank`, 1-based, dense).
 */

import {
  moveItem,
  moveItemTo,
  nextPosition,
  normalizeOrder,
  type MoveDirection
} from "../shared/ordering";

export type FeaturedMoveDirection = MoveDirection;

export interface FeaturedPosition {
  readonly id: string;
  readonly rank: number;
}

/** Moves one featured project one slot; ends/unknown ids return a copy. */
export function moveFeaturedProject(
  ids: readonly string[],
  id: string,
  direction: FeaturedMoveDirection
): string[] {
  return moveItem(ids, id, direction);
}

/** Moves one featured project to an explicit index (keyboard shortcuts). */
export function reorderFeaturedProjects(
  ids: readonly string[],
  id: string,
  targetIndex: number
): string[] {
  return moveItemTo(ids, id, targetIndex);
}

/** Dense 1..n rows for the reorder RPC, derived from the array index. */
export function normalizeFeaturedOrder(
  ids: readonly string[]
): readonly FeaturedPosition[] {
  return normalizeOrder(ids).map(({ id, position }) => ({
    id,
    rank: position
  }));
}

/** Next appended slot (max + 1; empty featured list starts at 1). */
export function nextFeaturedRank(existingRanks: readonly number[]): number {
  return nextPosition(existingRanks);
}
