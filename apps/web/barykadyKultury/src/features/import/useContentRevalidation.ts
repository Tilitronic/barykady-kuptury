import { onMounted, ref, watch, type Ref } from "vue";

/**
 * T-042 S9 — public stale-while-revalidate trigger.
 *
 * The reader has already rendered its stored copy. This composable asks the
 * lightweight check endpoint after mount, shows only a non-blocking banner when
 * an update exists, and never swaps text until the user asks. All throttling is
 * server-side (source_checked_at + backoff); a failed check is silent.
 */
export interface ContentCheckResponse {
  readonly updateAvailable?: boolean;
  readonly jobId?: string | null;
}

export interface UseContentRevalidationOptions {
  readonly kind: "document" | "publication";
  readonly slug: Ref<string>;
  readonly check?: (
    kind: "document" | "publication",
    slug: string
  ) => Promise<ContentCheckResponse>;
}

async function defaultCheck(
  kind: "document" | "publication",
  slug: string
): Promise<ContentCheckResponse> {
  const response = await fetch(
    `/api/content-check?kind=${encodeURIComponent(kind)}&slug=${encodeURIComponent(slug)}`,
    { headers: { accept: "application/json" }, cache: "no-store" }
  );
  if (!response.ok) return { updateAvailable: false };
  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null) {
    return { updateAvailable: false };
  }
  const body = payload as { updateAvailable?: unknown; jobId?: unknown };
  return {
    updateAvailable: body.updateAvailable === true,
    jobId: typeof body.jobId === "string" ? body.jobId : null
  };
}

export function useContentRevalidation(options: UseContentRevalidationOptions) {
  const updateAvailable = ref(false);
  const applying = ref(false);
  const jobId = ref<string | null>(null);
  let checkedSlug: string | null = null;

  async function checkNow(): Promise<void> {
    const slug = options.slug.value.trim();
    if (slug === "" || checkedSlug === slug) return;
    checkedSlug = slug;

    try {
      const result = await (options.check ?? defaultCheck)(options.kind, slug);
      updateAvailable.value = result.updateAvailable === true;
      jobId.value = result.jobId ?? null;
    } catch {
      // A revalidation failure must be invisible to the reader.
      updateAvailable.value = false;
    }
  }

  onMounted(() => {
    void checkNow();
  });

  watch(options.slug, () => {
    checkedSlug = null;
    updateAvailable.value = false;
    void checkNow();
  });

  async function applyUpdate(run: () => Promise<void>): Promise<void> {
    applying.value = true;
    updateAvailable.value = false;
    try {
      await run();
    } finally {
      applying.value = false;
    }
  }

  function dismiss(): void {
    updateAvailable.value = false;
  }

  return {
    updateAvailable,
    applying,
    jobId,
    checkNow,
    applyUpdate,
    dismiss
  };
}
