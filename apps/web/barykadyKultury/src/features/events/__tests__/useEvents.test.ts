import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref, type Ref } from "vue";
import type { SupabaseClient } from "@supabase/supabase-js";

import { useEvents, type EventView } from "@/features/events/useEvents";
import type { NormalizedEvent } from "@/features/events/normalize";
import type { Locale } from "@/features/i18n/locales";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";
import type { ContentResult } from "@/shared/content/result";
import type { Database } from "@/types/database.types";

/**
 * Hook axis (T-024): the calendar function and the Supabase link query are
 * fetched **independently** and joined by `(calendarId, googleEventId)`.
 * Failure isolation is the contract under test: a failed link query must not
 * blank the events, and a failed calendar must surface `unavailable` — never
 * a blank success. Stale responses are discarded exactly like `useProjects`.
 */

const CALENDAR_ID = "fixture-calendar@example.org";
const NOW = Date.UTC(2030, 4, 1);

function calendarEvent(
  overrides: Partial<NormalizedEvent> = {}
): NormalizedEvent {
  return {
    id: "fixture-event-timed",
    title: "Sample timed event",
    start: "2030-05-14T16:00:00+02:00",
    end: "2030-05-14T18:00:00+02:00",
    allDay: false,
    timezone: "Europe/Warsaw",
    location: null,
    description: null,
    registrationUrl: null,
    ...overrides
  };
}

function linkRow(
  overrides: Record<string, unknown> = {},
  project: Record<string, unknown> = {}
) {
  return {
    calendar_id: CALENDAR_ID,
    google_event_id: "fixture-event-timed",
    project_id: "00000000-0000-4000-8000-000000000201",
    projects: {
      slug: "sample-project",
      status: "published",
      project_translations: [
        {
          locale: "en",
          title: "Sample Project (EN)"
        },
        {
          locale: "pl",
          title: "Przykladowy projekt (PL)"
        }
      ],
      ...project
    },
    ...overrides
  };
}

function okResponse(events: NormalizedEvent[], calendarId = CALENDAR_ID) {
  return new Response(
    JSON.stringify({
      calendarId,
      events,
      generatedAt: "2030-04-30T12:00:00.000Z"
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

type Hook = {
  readonly result: Ref<ContentResult<EventView>>;
  readonly retry: () => void;
};

async function mountHook(options: {
  supabase: SupabaseClient<Database> | null;
  fetchImpl: typeof fetch;
  locale?: Locale;
}): Promise<{
  wrapper: Awaited<ReturnType<typeof mountWithPlugins>>;
  hook: Hook;
  activeLocale: Ref<Locale>;
}> {
  const activeLocale = ref<Locale>(options.locale ?? "en");
  let hook!: Hook;

  const Probe = defineComponent({
    setup() {
      hook = useEvents(activeLocale, {
        fetchImpl: options.fetchImpl,
        now: () => new Date(NOW)
      });
      return () => h("div", hook.result.value.kind);
    }
  });

  const wrapper = await mountWithPlugins(Probe, {
    supabase: options.supabase,
    initialRoute: `/${options.locale ?? "en"}/events`
  });

  return { wrapper, hook, activeLocale };
}

async function flush() {
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 0));
  await nextTick();
}

describe("useEvents", () => {
  it("starts loading, then joins the published project by (calendarId, googleEventId)", async () => {
    const fake = createFakeSupabase({
      tables: { calendar_event_links: [linkRow()] }
    });
    const { wrapper, hook } = await mountHook({
      supabase: fake.client,
      fetchImpl: vi.fn(async () =>
        okResponse([calendarEvent()])
      ) as unknown as typeof fetch
    });

    expect(wrapper.text()).toBe("loading");
    await flush();
    expect(wrapper.text()).toBe("ok");

    const items =
      hook.result.value.kind === "ok" ? hook.result.value.items : [];
    expect(items).toHaveLength(1);
    expect(items[0]?.project).toMatchObject({
      slug: "sample-project",
      title: "Sample Project (EN)",
      isFallback: false
    });
  });

  it("leaves the project off when the link names a different calendar", async () => {
    const fake = createFakeSupabase({
      tables: {
        calendar_event_links: [
          linkRow({ calendar_id: "other-calendar@example.org" })
        ]
      }
    });
    const { hook } = await mountHook({
      supabase: fake.client,
      fetchImpl: vi.fn(async () =>
        okResponse([calendarEvent()])
      ) as unknown as typeof fetch
    });
    await flush();

    const items =
      hook.result.value.kind === "ok" ? hook.result.value.items : [];
    expect(items[0]?.project).toBeNull();
  });

  it("renders events normally when the link query failed (partial data)", async () => {
    const fake = createFakeSupabase({ error: { message: "rls hiccup" } });
    const { wrapper, hook } = await mountHook({
      supabase: fake.client,
      fetchImpl: vi.fn(async () =>
        okResponse([calendarEvent()])
      ) as unknown as typeof fetch
    });
    await flush();

    expect(wrapper.text()).toBe("ok");
    const items =
      hook.result.value.kind === "ok" ? hook.result.value.items : [];
    expect(items).toHaveLength(1);
    expect(items[0]?.project).toBeNull();
  });

  it("renders events without links at all when Supabase is unconfigured", async () => {
    const { wrapper } = await mountHook({
      supabase: null,
      fetchImpl: vi.fn(async () =>
        okResponse([calendarEvent()])
      ) as unknown as typeof fetch
    });
    await flush();

    expect(wrapper.text()).toBe("ok");
  });

  it("surfaces the calendar failure as unavailable, never a blank success", async () => {
    const fake = createFakeSupabase({ tables: { calendar_event_links: [] } });
    const { wrapper } = await mountHook({
      supabase: fake.client,
      fetchImpl: vi.fn(
        async () =>
          new Response('{"error":"calendar_unavailable"}', { status: 502 })
      ) as unknown as typeof fetch
    });
    await flush();

    expect(wrapper.text()).toBe("unavailable");
  });

  it("maps past-only events to the empty state", async () => {
    const fake = createFakeSupabase({ tables: { calendar_event_links: [] } });
    const { wrapper } = await mountHook({
      supabase: fake.client,
      fetchImpl: vi.fn(async () =>
        okResponse([calendarEvent({ start: "2030-04-01T10:00:00+02:00" })])
      ) as unknown as typeof fetch
    });
    await flush();

    expect(wrapper.text()).toBe("empty");
  });

  it("sorts joined events soonest-first", async () => {
    const fake = createFakeSupabase({ tables: { calendar_event_links: [] } });
    const { hook } = await mountHook({
      supabase: fake.client,
      fetchImpl: vi.fn(async () =>
        okResponse([
          calendarEvent({ id: "later", start: "2030-07-01T10:00:00+02:00" }),
          calendarEvent({ id: "soonest", start: "2030-05-20T10:00:00+02:00" })
        ])
      ) as unknown as typeof fetch
    });
    await flush();

    const items =
      hook.result.value.kind === "ok" ? hook.result.value.items : [];
    expect(items.map(e => e.id)).toEqual(["soonest", "later"]);
  });

  it("re-fetches both sources when the locale changes", async () => {
    const fake = createFakeSupabase({ tables: { calendar_event_links: [] } });
    const fetchImpl = vi.fn(async () => okResponse([calendarEvent()]));
    const { activeLocale } = await mountHook({
      supabase: fake.client,
      fetchImpl: fetchImpl as unknown as typeof fetch
    });
    await flush();

    const before = fetchImpl.mock.calls.length;
    activeLocale.value = "pl";
    await flush();

    expect(fetchImpl.mock.calls.length).toBeGreaterThan(before);
    const eqCalls = fake.calls.filter(
      call =>
        call.table === "calendar_event_links" && call.method === "overrideTypes"
    );
    expect(eqCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("discards a stale calendar response when a newer one already resolved", async () => {
    const fake = createFakeSupabase({ tables: { calendar_event_links: [] } });

    let resolveFirst: ((r: Response) => void) | undefined;
    const first = new Promise<Response>(resolve => {
      resolveFirst = resolve;
    });

    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(() => first)
      .mockImplementationOnce(async () =>
        okResponse([calendarEvent({ id: "newer", title: "Newer event" })])
      );

    const { hook, activeLocale } = await mountHook({
      supabase: fake.client,
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    activeLocale.value = "pl";
    await flush();

    resolveFirst!(
      okResponse([calendarEvent({ id: "stale", title: "Stale event" })])
    );
    await flush();

    const items =
      hook.result.value.kind === "ok" ? hook.result.value.items : [];
    expect(items.map(e => e.id)).toEqual(["newer"]);
  });

  it("retry() re-runs the fetch and recovers from unavailable", async () => {
    const fake = createFakeSupabase({ tables: { calendar_event_links: [] } });
    let fail = true;
    const fetchImpl = vi.fn(async () => {
      if (fail) {
        return new Response('{"error":"calendar_unavailable"}', {
          status: 502
        });
      }
      return okResponse([calendarEvent()]);
    });

    const { wrapper, hook } = await mountHook({
      supabase: fake.client,
      fetchImpl: fetchImpl as unknown as typeof fetch
    });
    await flush();
    expect(wrapper.text()).toBe("unavailable");

    fail = false;
    hook.retry();
    await flush();

    expect(wrapper.text()).toBe("ok");
    expect(fetchImpl.mock.calls.length).toBe(2);
  });
});
