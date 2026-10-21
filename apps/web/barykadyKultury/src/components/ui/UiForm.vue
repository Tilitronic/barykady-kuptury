<template>
  <!--
    UiForm.vue — the ui/ seam over Quasar QForm. Pure pass-through of
    attrs, slots and events: the rendered DOM is identical to the raw
    component, so migrating a call-site can never restyle anything. 
  -->
  <QForm v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QForm>
</template>

<script setup lang="ts">
import { QForm } from "quasar";

defineOptions({ inheritAttrs: false });
</script>
