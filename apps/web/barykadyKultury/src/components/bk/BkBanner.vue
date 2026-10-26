<template>
  <QBanner v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QBanner>
</template>

<script setup lang="ts">
import { QBanner } from "quasar";

/**
 * BkBanner — the bk/ seam over Quasar QBanner.
 *
 * WHY a pass-through with no brand defaults: a banner is a neutral notice
 * surface; its colour and actions are chosen per message by the call-site.
 * Adding a default here would silently restyle existing notices. The wrapper
 * exists so Quasar UI imports stay inside bk/ (enforced by bk.test.ts) and so
 * a future primitive swap touches one file instead of every call-site.
 * Attributes, events and slots ride through untouched, keeping the rendered
 * DOM identical to raw QBanner.
 */
defineOptions({ inheritAttrs: false });
</script>
