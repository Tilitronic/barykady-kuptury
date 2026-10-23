/**
 * Shared deterministic ordering for admin-managed editorial lists (T-028,
 * T-030).
 *
 * Design authority:
 *   - docs/PRODUCT_REQUIREMENTS.md §4/§5: team entries and homepage projects
 *     have one editorial order.
 *   - docs/architecture.md §4: ordering lives on the root row and is
 *     locale-independent.
 *   - T-028 established the contract: explicit Up/Down controls (never
 *     drag-only), complete desired id sequences, dense 1..n positions.
 *   - T-030 reuses that contract for featured projects instead of growing a
 *     second, subtly different implementation.
 *
 * The helpers are pure and 1-based because both existing tables store 1..n
 * positions. Move helpers always return a new array, even at the ends, so a
 * caller can await a reorder without branching on "did anything change".
 */

export type MoveDirection = "up" | "down";

export interface OrderedPosition {
  readonly id: string;
  readonly position: number;
}

/**
 * Moves one item one slot in `direction`. Unknown ids and end positions are a
 * no-op (the returned array is still a copy).
 */
export function moveItem(
  ids: readonly string[],
  id: string,
  direction: MoveDirection
): string[] {
  const next = [...ids];
  const index = next.indexOf(id);
  if (index === -1) return next;

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= next.length) return next;

  const [moved] = next.splice(index, 1);
  if (moved === undefined) return next;
  next.splice(target, 0, moved);
  return next;
}

/**
 * Moves one item to an explicit index (keyboard shortcuts / "move to" calls).
 * Out-of-range targets are clamped so a caller cannot create a hole.
 */
export function moveItemTo(
  ids: readonly string[],
  id: string,
  targetIndex: number
): string[] {
  const next = [...ids];
  const index = next.indexOf(id);
  if (index === -1) return next;

  const target = Math.max(0, Math.min(next.length - 1, targetIndex));
  if (target === index) return next;

  const [moved] = next.splice(index, 1);
  if (moved === undefined) return next;
  next.splice(target, 0, moved);
  return next;
}

/**
 * The exact rows an order RPC should persist: dense 1..n positions in the
 * supplied order. Duplicate positions are unrepresentable because the sequence
 * is generated from the array index.
 */
export function normalizeOrder(
  ids: readonly string[]
): readonly OrderedPosition[] {
  return ids.map((id, index) => ({ id, position: index + 1 }));
}

/** Next free position for an appended item (empty list starts at 1). */
export function nextPosition(existing: readonly number[]): number {
  return existing.reduce((max, position) => Math.max(max, position), 0) + 1;
}
