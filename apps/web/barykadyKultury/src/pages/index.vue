<template>
  <div class="home">
    <h1 class="home__title">{{ t("app.name") }}</h1>
    <p class="home__lead">{{ t("home.placeholder") }}</p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>

<style scoped>
.home {
  max-width: 68ch;
  margin: 0 auto;
  padding: 4rem 1.25rem;
}

.home__title {
  margin: 0 0 1rem;
  font-size: clamp(2rem, 6vw, 4rem);
  line-height: 1.05;
}

.home__lead {
  margin: 0;
  font-size: 1.125rem;
  line-height: 1.6;
}
</style>
