<template>
  <main>
    <h1>Kibao fixture</h1>
    <dl>
      <dt>public</dt>
      <dd data-testid="public">{{ vars.PUBLIC_FROM_BAO }}</dd>
      <dt>shared</dt>
      <dd data-testid="shared">{{ vars.SHARED_FROM_BAO }}</dd>
    </dl>
  </main>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useNuxtApp } from "nuxt/app";

const { $vars } = useNuxtApp() as unknown as {
  $vars: {
    data: Record<string, string>;
  };
};
const vars = computed(() => $vars.data);
</script>
