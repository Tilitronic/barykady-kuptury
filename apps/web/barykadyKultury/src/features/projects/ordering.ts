/**
 * Project ordering helpers (T-015).
 *
 * docs/PRODUCT_REQUIREMENTS.md §5 and docs/TESTING.md §2 fix the homepage
 * contract: "featured projects in configured order; when no projects are
 * featured, recent published projects are shown". T-025 consumes these
 * functions; keeping them pure and separate from the query means the ordering
 * and the draft-exclusion rule are proven without a client.
 */

/** The lifecycle status a project must hold to be publicly ordered. */
export type ProjectStatus = "draft" | "published" | "archived";

/**
 * The subset of a project the ordering rules need. `ProjectSummary` from
 * `./api` satisfies this structurally, so these helpers accept real query
 * results without importing the data-access module.
 */
export interface OrderableProject {
  readonly id: string;
  readonly status: ProjectStatus;
  readonly featuredRank: number | null;
  readonly updatedAt: string;
}

/** Compares by `updatedAt` descending, breaking ties by `id` for stability. */
function byUpdatedAtDescending(
  a: OrderableProject,
  b: OrderableProject
): number {
  const aTime = Date.parse(a.updatedAt);
  const bTime = Date.parse(b.updatedAt);

  if (aTime !== bTime) return bTime - aTime;
  return a.id.localeCompare(b.id);
}

function publishedOnly<T extends OrderableProject>(
  projects: readonly T[]
): T[] {
  return projects.filter(project => project.status === "published");
}

/** Published projects, most recently updated first (drafts/archived excluded). */
export function recentProjects<T extends OrderableProject>(
  projects: readonly T[]
): T[] {
  return publishedOnly(projects).sort(byUpdatedAtDescending);
}

/**
 * The homepage project list: featured projects in ascending `featured_rank`
 * order; when none are featured, the most recently updated published projects
 * (the documented fallback). Drafts are excluded in both branches.
 */
export function featuredProjects<T extends OrderableProject>(
  projects: readonly T[]
): T[] {
  const featured = publishedOnly(projects).filter(
    project => project.featuredRank !== null
  );

  if (featured.length === 0) {
    return recentProjects(projects);
  }

  return featured.sort((a, b) => (a.featuredRank ?? 0) - (b.featuredRank ?? 0));
}
