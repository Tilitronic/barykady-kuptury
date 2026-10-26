<template>
  <!--
    T-030 — homepage featured ordering (`/:locale/admin/featured`).

    Contract:
      * only published projects are offered; the add path re-checks status in
        the service and the database;
      * the featured list is the exact homepage order; Up/Down buttons are the
        only ordering control (keyboard operable, no drag-only path);
      * every mutation is awaited, then the lists are re-read — no optimistic
        rows (the T-027/T-028 pattern);
      * empty featured set is a valid state: the public homepage falls back to
        recently published projects, so the empty copy explains that.
  -->
  <div class="admin-featured">
    <p class="admin-featured__back">
      <RouterLink
        :to="`/${currentLocale}/admin/projects`"
        class="admin-featured__back-link focus-ring"
      >
        {{ t("admin.featured.actions.backToProjects") }}
      </RouterLink>
    </p>

    <h1 class="admin-featured__heading">{{ t("admin.featured.heading") }}</h1>
    <p class="admin-featured__intro">{{ t("admin.featured.intro") }}</p>

    <p v-if="loading" class="admin-featured__state" role="status">
      {{ t("content.loading") }}
    </p>

    <BkBanner
      v-else-if="loadError !== null"
      class="admin-featured__banner"
      rounded
      role="status"
      aria-live="polite"
      data-testid="featured-error"
    >
      <p class="admin-featured__banner-text">{{ loadErrorMessage }}</p>
      <BkButton
        variant="flat"
        :label="t('admin.featured.errors.retry')"
        data-testid="featured-retry"
        @click="load"
      />
    </BkBanner>

    <template v-else>
      <section
        class="admin-featured__section"
        :aria-labelledby="featuredHeadingId"
      >
        <h2 :id="featuredHeadingId" class="admin-featured__section-title">
          {{ t("admin.featured.featuredHeading") }}
        </h2>

        <p
          v-if="featured.length === 0"
          class="admin-featured__state"
          data-testid="featured-empty"
        >
          {{ t("admin.featured.empty") }}
        </p>

        <ol v-else class="admin-featured__list" data-testid="featured-list">
          <li
            v-for="(project, index) in featured"
            :key="project.id"
            class="admin-featured__item"
            :data-testid="`featured-item-${project.id}`"
          >
            <div class="admin-featured__identity">
              <span class="admin-featured__rank" aria-hidden="true">
                {{ project.rank ?? index + 1 }}
              </span>
              <div>
                <p class="admin-featured__title">{{ project.title }}</p>
                <p class="admin-featured__slug">{{ project.slug }}</p>
              </div>
            </div>

            <div class="admin-featured__actions">
              <!-- Explicit Up/Down controls: the only ordering path. -->
              <BkButton
                variant="flat"
                :label="t('admin.featured.actions.moveUp')"
                :aria-label="
                  t('admin.featured.actions.moveUpProject', {
                    title: project.title
                  })
                "
                :disable="index === 0 || pending !== null"
                :data-testid="`featured-up-${project.id}`"
                @click="move(project, 'up')"
              />
              <BkButton
                variant="flat"
                :label="t('admin.featured.actions.moveDown')"
                :aria-label="
                  t('admin.featured.actions.moveDownProject', {
                    title: project.title
                  })
                "
                :disable="index === featured.length - 1 || pending !== null"
                :data-testid="`featured-down-${project.id}`"
                @click="move(project, 'down')"
              />
              <BkButton
                variant="outline"
                :label="t('admin.featured.actions.remove')"
                :aria-label="
                  t('admin.featured.actions.removeProject', {
                    title: project.title
                  })
                "
                :disable="pending !== null"
                :data-testid="`featured-remove-${project.id}`"
                @click="remove(project)"
              />
            </div>
          </li>
        </ol>
      </section>

      <section
        class="admin-featured__section"
        :aria-labelledby="availableHeadingId"
      >
        <h2 :id="availableHeadingId" class="admin-featured__section-title">
          {{ t("admin.featured.availableHeading") }}
        </h2>

        <p
          v-if="available.length === 0"
          class="admin-featured__state"
          data-testid="featured-available-empty"
        >
          {{ t("admin.featured.availableEmpty") }}
        </p>

        <ul
          v-else
          class="admin-featured__list"
          data-testid="featured-available"
        >
          <li
            v-for="project in available"
            :key="project.id"
            class="admin-featured__item"
            :data-testid="`featured-available-${project.id}`"
          >
            <div class="admin-featured__identity">
              <div>
                <p class="admin-featured__title">{{ project.title }}</p>
                <p class="admin-featured__slug">{{ project.slug }}</p>
              </div>
            </div>

            <BkButton
              variant="flat"
              :label="t('admin.featured.actions.add')"
              :aria-label="
                t('admin.featured.actions.addProject', {
                  title: project.title
                })
              "
              :disable="pending !== null"
              :data-testid="`featured-add-${project.id}`"
              @click="add(project)"
            />
          </li>
        </ul>
      </section>

      <p
        class="admin-featured__status-message"
        :class="{
          'admin-featured__status-message--error': statusKind === 'error',
          'admin-featured__status-message--success': statusKind === 'success'
        }"
        role="status"
        aria-live="polite"
        data-testid="featured-status-message"
      >
        {{ statusMessage }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { SupabaseClient } from "@supabase/supabase-js";
import { computed, inject, onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import { BkBanner, BkButton } from "@/components/bk";
import {
  addFeaturedProject,
  fetchFeaturedAdminData,
  moveFeaturedProject,
  removeFeaturedProject,
  type FeaturedAdminData,
  type FeaturedFailure,
  type FeaturedProject
} from "@/features/admin/featured/api";
import type { FeaturedMoveDirection } from "@/features/admin/featured/featuredOrder";
import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";
import type { Database } from "@/types/database.types";

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

const featuredHeadingId = "admin-featured-order";
const availableHeadingId = "admin-featured-available";

const featured = ref<readonly FeaturedProject[]>([]);
const available = ref<readonly FeaturedProject[]>([]);
const loading = ref(true);
const loadError = ref<"unavailable" | "failed" | null>(null);
const pending = ref<string | null>(null);
const statusMessage = ref("");
const statusKind = ref<"success" | "error" | null>(null);

const loadErrorMessage = computed(() =>
  loadError.value === "unavailable"
    ? t("admin.featured.errors.unavailable")
    : t("admin.featured.errors.loadFailed")
);

function failureMessage(failure: FeaturedFailure): string {
  switch (failure.code) {
    case "unavailable":
      return t("admin.featured.errors.unavailable");
    case "not-found":
      return t("admin.featured.errors.notFound");
    case "not-published":
      return t("admin.featured.errors.notPublished");
    case "failed":
      return t("admin.featured.errors.failed");
  }
}

function setStatus(kind: "success" | "error", message: string): void {
  statusKind.value = kind;
  statusMessage.value = message;
}

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;

  const result = await fetchFeaturedAdminData(client.value);

  if (result.ok) {
    const data: FeaturedAdminData = result;
    featured.value = data.featured;
    available.value = data.available;
  } else {
    featured.value = [];
    available.value = [];
    loadError.value = result.code === "unavailable" ? "unavailable" : "failed";
  }

  loading.value = false;
}

async function add(project: FeaturedProject): Promise<void> {
  pending.value = `add:${project.id}`;
  statusKind.value = null;
  statusMessage.value = "";

  const result = await addFeaturedProject(client.value, project.id);

  if (result.ok) {
    await load();
    setStatus("success", t("admin.featured.messages.added"));
  } else {
    setStatus("error", failureMessage(result));
  }

  pending.value = null;
}

async function remove(project: FeaturedProject): Promise<void> {
  pending.value = `remove:${project.id}`;
  statusKind.value = null;
  statusMessage.value = "";

  const result = await removeFeaturedProject(client.value, project.id);

  if (result.ok) {
    await load();
    setStatus("success", t("admin.featured.messages.removed"));
  } else {
    setStatus("error", failureMessage(result));
  }

  pending.value = null;
}

async function move(
  project: FeaturedProject,
  direction: FeaturedMoveDirection
): Promise<void> {
  pending.value = `move:${project.id}`;
  statusKind.value = null;
  statusMessage.value = "";

  const ids = featured.value.map(entry => entry.id);
  const result = await moveFeaturedProject(
    client.value,
    ids,
    project.id,
    direction
  );

  if (result.ok) {
    await load();
    setStatus("success", t("admin.featured.messages.reordered"));
  } else {
    setStatus("error", failureMessage(result));
  }

  pending.value = null;
}

onMounted(load);
</script>

<style scoped>
.admin-featured {
  display: grid;
  gap: var(--space-4);
}

.admin-featured__back-link {
  /* T-033: link TEXT takes the link token (AA on all dark surfaces). */
  color: var(--color-link);
}

.admin-featured__heading {
  margin: 0;
  font-size: var(--font-size-2xl);
}

.admin-featured__intro {
  margin: 0;
  max-width: 62ch;
  color: var(--color-text-muted);
}

.admin-featured__section {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.admin-featured__section-title {
  margin: 0;
  font-size: var(--font-size-lg);
}

.admin-featured__state {
  margin: 0;
  color: var(--color-text-muted);
}

.admin-featured__list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.admin-featured__item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}

.admin-featured__item:last-child {
  border-bottom: 0;
}

.admin-featured__identity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.admin-featured__rank {
  display: inline-grid;
  place-items: center;
  min-width: 2rem;
  min-height: 2rem;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.admin-featured__title {
  margin: 0;
  font-weight: 600;
}

.admin-featured__slug {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.admin-featured__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.admin-featured__status-message:empty {
  display: none;
}

.admin-featured__status-message--error {
  color: var(--color-danger);
}

.admin-featured__status-message--success {
  color: var(--color-success);
}
</style>
