<template>
  <!--
    T-031 — admin event mapping (`/:locale/admin/events`).

    Two independent reads, exactly like the public Events page
    (features/events/useEvents): the read-only Calendar adapter supplies event
    content, Supabase supplies the optional project mapping. A Calendar failure
    is therefore NOT a data loss: the mapping rows still render from Supabase
    and the page explains that titles/dates are temporarily missing
    (docs/architecture.md §4–§5, ticket acceptance criterion 4).

    No write reaches Google: the selectors only upsert/unassign
    `calendar_event_links`. Creating or editing calendar events is an explicit
    V1 non-goal (docs/PRODUCT_REQUIREMENTS.md §6).
  -->
  <AdminSubmitShell mode="event" :show-heading="false" class="admin-events">
    <h1 class="admin-events__heading">{{ t("admin.events.heading") }}</h1>
    <p class="admin-events__intro">{{ t("admin.events.intro") }}</p>

    <UiBanner
      v-if="calendarUnavailable"
      class="admin-events__banner"
      rounded
      role="status"
      data-testid="events-calendar-notice"
    >
      <p class="admin-events__banner-text">
        {{ t("admin.events.calendarUnavailable") }}
      </p>
      <UiBtn
        variant="flat"
        :label="t('admin.events.retry')"
        data-testid="events-retry"
        @click="load"
      />
    </UiBanner>

    <UiBanner
      v-if="loadError !== null"
      class="admin-events__banner"
      rounded
      role="alert"
      data-testid="events-error"
    >
      <p class="admin-events__banner-text">{{ errorMessage }}</p>
      <UiBtn
        variant="flat"
        :label="t('admin.events.retry')"
        data-testid="events-error-retry"
        @click="load"
      />
    </UiBanner>

    <p v-if="loading" class="admin-events__state" role="status">
      {{ t("content.loading") }}
    </p>

    <p
      v-else-if="rows.length === 0"
      class="admin-events__state"
      data-testid="events-empty"
    >
      {{ t("admin.events.empty") }}
    </p>

    <template v-if="!loading && rows.length > 0" #event-extra>
      <div class="admin-events__table-wrap">
        <table class="admin-events__table" data-testid="events-table">
          <caption class="sr-only">{{ t("admin.events.heading") }}</caption>
          <thead>
            <tr>
              <th scope="col">{{ t("admin.events.columns.event") }}</th>
              <th scope="col">{{ t("admin.events.columns.when") }}</th>
              <th scope="col">{{ t("admin.events.columns.status") }}</th>
              <th scope="col">{{ t("admin.events.columns.project") }}</th>
              <th scope="col">{{ t("admin.events.columns.publicLink") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.key"
              :data-testid="`event-row-${row.googleEventId}`"
            >
              <td>
                <span class="admin-events__event-title">{{ row.title }}</span>
                <span v-if="!row.inFeed" class="admin-events__hint">
                  {{ t("admin.events.notInFeed") }}
                </span>
              </td>
              <td>
                <time v-if="row.start !== null" :datetime="row.start">
                  {{ formattedStart(row) }}
                </time>
                <span v-else aria-hidden="true">—</span>
              </td>
              <td>{{ t(statusKey(row)) }}</td>
              <td>
                <UiSelect
                  :model-value="row.projectId ?? ''"
                  :options="projectOptions"
                  emit-value
                  map-options
                  :disable="pendingKey === row.key || projectsFailure"
                  :aria-label="
                    t('admin.events.projectFor', { event: row.title })
                  "
                  :data-testid="`event-project-${row.googleEventId}`"
                  @update:model-value="onProjectChange(row, $event)"
                />
              </td>
              <td>
                <RouterLink
                  v-if="publicDecision(row).public && publicDecision(row).path"
                  :to="publicPath(row)"
                  class="admin-events__public-link focus-ring"
                  :data-testid="`event-public-link-${row.googleEventId}`"
                >
                  {{ projectFor(row)?.title }}
                </RouterLink>
                <span
                  v-else
                  class="admin-events__no-link"
                  :data-testid="`event-no-public-link-${row.googleEventId}`"
                >
                  {{ publicLinkLabel(row) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <p
      v-if="statusMessage !== ''"
      class="admin-events__feedback"
      role="status"
      aria-live="polite"
      data-testid="events-status"
    >
      {{ statusMessage }}
    </p>

    <UiBanner
      v-if="actionError !== null"
      class="admin-events__banner"
      rounded
      role="alert"
      data-testid="events-action-error"
    >
      <p class="admin-events__banner-text">{{ actionError }}</p>
    </UiBanner>
  </AdminSubmitShell>
</template>

<script setup lang="ts">
import type { SupabaseClient } from "@supabase/supabase-js";
import { computed, inject, onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import AdminSubmitShell from "@/components/admin/AdminSubmitShell.vue";
import { UiBanner, UiBtn, UiSelect } from "@/components/ui";
import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import {
  assignEventProject,
  fetchAdminEventLinks,
  fetchAssignableProjects,
  unassignEventProject,
  type AdminEventLink,
  type AdminProjectOption
} from "@/features/admin/events/api";
import {
  publicLinkPolicy,
  type PublicLinkDecision
} from "@/features/admin/events/publicLinkPolicy";
import { fetchCalendarEvents } from "@/features/events/client";
import type { NormalizedEvent } from "@/features/events/normalize";
import { formatDate } from "@/features/i18n/format";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";
import type { Database } from "@/types/database.types";

/**
 * T-031 — mapping surface. Kept as page orchestration only: every write goes
 * through `features/admin/events/api`, every policy answer through
 * `publicLinkPolicy`. Mutations are await-then-refresh (no optimistic rows), so
 * a failed write can never leave the selector claiming a project that the
 * database did not store.
 */
const props = defineProps<{
  supabase?: SupabaseClient<Database> | null;
}>();

const { t } = useI18n();
const route = useRoute();
const injected = inject(SUPABASE_CLIENT_KEY, null);
const client = computed(() => props.supabase ?? injected);

const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

interface EventRow {
  /** Collision-free composite identity (NUL separates the id parts). */
  readonly key: string;
  readonly calendarId: string;
  readonly googleEventId: string;
  readonly title: string;
  readonly start: string | null;
  readonly allDay: boolean;
  readonly projectId: string | null;
  /** False when the mapping has no matching event in the current feed. */
  readonly inFeed: boolean;
}

type CalendarState = "loading" | "ok" | "empty" | "unavailable";

const events = ref<readonly NormalizedEvent[]>([]);
const calendarId = ref<string | null>(null);
const calendarState = ref<CalendarState>("loading");
const links = ref<readonly AdminEventLink[]>([]);
const projects = ref<readonly AdminProjectOption[]>([]);
const loading = ref(true);
const loadError = ref<"links" | "projects" | null>(null);
const pendingKey = ref<string | null>(null);
const statusMessage = ref("");
const actionError = ref<string | null>(null);

const projectsFailure = computed(() => loadError.value === "projects");
const calendarUnavailable = computed(
  () => calendarState.value === "unavailable"
);

const errorMessage = computed(() =>
  loadError.value === "links"
    ? t("admin.events.errors.links")
    : t("admin.events.errors.projects")
);

const projectOptions = computed(() => [
  { label: t("admin.events.noProject"), value: "" },
  ...projects.value.map(project => ({
    label: `${project.title} (${t(`admin.projects.statuses.${project.status}`)})`,
    value: project.id
  }))
]);

const projectById = computed(
  () => new Map(projects.value.map(project => [project.id, project]))
);

function linkKey(calendar: string, eventId: string): string {
  return `${calendar}\u0000${eventId}`;
}

/**
 * Feed events first, then mapping-only rows. The latter are what prove the
 * degradation contract: with the calendar down, Supabase still supplies one row
 * per stored mapping, keyed by the stable Google event id.
 */
const rows = computed<EventRow[]>(() => {
  const byEvent = new Map(
    links.value.map(link => [
      linkKey(link.calendarId, link.googleEventId),
      link
    ])
  );
  const result: EventRow[] = [];
  const feedKeys = new Set<string>();
  const feedCalendarId = calendarId.value;

  if (feedCalendarId !== null) {
    for (const event of events.value) {
      const key = linkKey(feedCalendarId, event.id);
      feedKeys.add(key);
      result.push({
        key,
        calendarId: feedCalendarId,
        googleEventId: event.id,
        title: event.title,
        start: event.start,
        allDay: event.allDay,
        projectId: byEvent.get(key)?.projectId ?? null,
        inFeed: true
      });
    }
  }

  for (const link of links.value) {
    const key = linkKey(link.calendarId, link.googleEventId);
    if (feedKeys.has(key)) continue;

    result.push({
      key,
      calendarId: link.calendarId,
      googleEventId: link.googleEventId,
      // No calendar title is available; the stable event id is the honest
      // identifier and is what an administrator matches in Google Calendar.
      title: link.googleEventId,
      start: null,
      allDay: false,
      projectId: link.projectId,
      inFeed: false
    });
  }

  return result.sort((left, right) => {
    if (left.start === null && right.start === null) {
      return left.title.localeCompare(right.title);
    }
    if (left.start === null) return 1;
    if (right.start === null) return -1;
    return left.start.localeCompare(right.start);
  });
});

function projectFor(row: EventRow): AdminProjectOption | null {
  return row.projectId === null
    ? null
    : (projectById.value.get(row.projectId) ?? null);
}

function publicDecision(row: EventRow): PublicLinkDecision {
  return publicLinkPolicy(projectFor(row), currentLocale.value);
}

/** Empty string is unreachable behind the `public` guard; keeps `to` a string. */
function publicPath(row: EventRow): string {
  return publicDecision(row).path ?? "";
}

function publicLinkLabel(row: EventRow): string {
  if (row.projectId !== null && projectFor(row) === null) {
    return t("admin.events.publicLink.projectUnavailable");
  }

  const decision = publicDecision(row);
  switch (decision.reason) {
    case "published":
      return t("admin.events.publicLink.published");
    case "draft":
      return t("admin.events.publicLink.draft");
    case "archived":
      return t("admin.events.publicLink.archived");
    case "missing-translation":
      return t("admin.events.publicLink.missingTranslation");
    case "unlinked":
      return t("admin.events.publicLink.unlinked");
  }
}

function statusKey(row: EventRow): string {
  if (!row.inFeed) return "admin.events.statuses.notInFeed";
  if (row.start === null) return "admin.events.statuses.unknown";

  const start = Date.parse(row.start);
  const upcoming = Number.isNaN(start) ? false : start >= Date.now();
  return upcoming
    ? "admin.events.statuses.upcoming"
    : "admin.events.statuses.past";
}

function formattedStart(row: EventRow): string {
  if (row.start === null) return "";

  // Date-only values are all-day events: formatting them as an instant could
  // shift the day in a negative-offset timezone, so they keep a date-only
  // label (the same rule as the public formatter).
  return row.allDay
    ? formatDate(new Date(`${row.start}T00:00:00Z`), currentLocale.value, {
        dateStyle: "medium"
      })
    : formatDate(new Date(row.start), currentLocale.value, {
        dateStyle: "medium",
        timeStyle: "short"
      });
}

async function refreshLinks(): Promise<void> {
  const result = await fetchAdminEventLinks(client.value);
  if (result.ok) links.value = result.links;
}

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  statusMessage.value = "";
  actionError.value = null;

  const [calendar, linkResult, projectResult] = await Promise.all([
    fetchCalendarEvents(),
    fetchAdminEventLinks(client.value),
    fetchAssignableProjects(client.value)
  ]);

  if (calendar.kind === "ok") {
    calendarId.value = calendar.calendarId;
    events.value = calendar.events;
    calendarState.value = "ok";
  } else {
    calendarId.value = null;
    events.value = [];
    calendarState.value = calendar.kind;
  }

  links.value = linkResult.ok ? linkResult.links : [];
  projects.value = projectResult.ok ? projectResult.projects : [];

  if (!linkResult.ok) {
    loadError.value = "links";
  } else if (!projectResult.ok) {
    loadError.value = "projects";
  }

  loading.value = false;
}

function failureMessage(code: string): string {
  return code === "project-missing"
    ? t("admin.events.errors.projectMissing")
    : t("admin.events.errors.saveFailed");
}

async function onProjectChange(row: EventRow, value: unknown): Promise<void> {
  const projectId = typeof value === "string" ? value : "";
  const nextProjectId = projectId === "" ? null : projectId;
  if (nextProjectId === row.projectId) return;

  pendingKey.value = row.key;
  statusMessage.value = "";
  actionError.value = null;

  const identity = {
    calendarId: row.calendarId,
    googleEventId: row.googleEventId
  };

  const result =
    nextProjectId === null
      ? await unassignEventProject(client.value, identity)
      : await assignEventProject(client.value, {
          ...identity,
          projectId: nextProjectId
        });

  pendingKey.value = null;

  if (!result.ok) {
    actionError.value = failureMessage(result.code);
    if (result.code === "project-missing") {
      // The selector can be stale; re-read the visible project set so the
      // removed option disappears instead of failing on the next attempt.
      const refreshed = await fetchAssignableProjects(client.value);
      if (refreshed.ok) projects.value = refreshed.projects;
    }
    return;
  }

  statusMessage.value =
    nextProjectId === null
      ? t("admin.events.messages.unassigned")
      : t("admin.events.messages.assigned");

  // Persisted, not optimistic: the row's mapping is re-read from Supabase.
  await refreshLinks();
}

onMounted(load);
</script>

<style scoped>
.admin-events__heading {
  margin: 0 0 0.5rem;
  font-size: var(--font-size-h2);
  font-weight: 700;
}

.admin-events__intro {
  margin: 0 0 1.5rem;
  max-width: 70ch;
  color: var(--color-text-muted);
  line-height: 1.6;
}

.admin-events__banner {
  margin-bottom: 1rem;
}

.admin-events__banner-text {
  margin: 0 0 0.5rem;
  max-width: 70ch;
}

.admin-events__state {
  color: var(--color-text-muted);
}

/*
 * Data tables may scroll horizontally at 320 px rather than forcing the whole
 * page wide; the caption keeps the table named for screen readers
 * (docs/DESIGN_SYSTEM.md §6).
 */
.admin-events__table-wrap {
  overflow-x: auto;
}

.admin-events__table {
  width: 100%;
  border-collapse: collapse;
  text-align: start;
}

.admin-events__table th,
.admin-events__table td {
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  vertical-align: top;
}

.admin-events__event-title {
  display: block;
  font-weight: 600;
}

.admin-events__hint {
  display: block;
  margin-top: 0.125rem;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.admin-events__public-link {
  color: var(--color-link);
  font-weight: 600;
}

.admin-events__no-link {
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.admin-events__feedback {
  margin-top: 1rem;
  font-weight: 600;
}
</style>
