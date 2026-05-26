<template>
  <main class="shell">
    <section class="panel status-panel">
      <div>
        <p class="eyebrow">Kibao OpenBao Playground</p>
        <h1>{{ isConfigured ? "Connected runtime" : "Disabled runtime" }}</h1>
      </div>

      <div class="status-grid">
        <div>
          <span>Provider</span>
          <strong>{{ hasProvider ? "available" : "missing" }}</strong>
        </div>
        <div>
          <span>Variables</span>
          <strong>{{ variableCount }}</strong>
        </div>
        <div>
          <span>Refresh</span>
          <strong>{{ refreshState }}</strong>
        </div>
      </div>

      <button type="button" :disabled="!hasProvider || refreshState === 'refreshing'" @click="refreshVars">
        Refresh
      </button>
    </section>

    <section class="panel">
      <header>
        <h2>Runtime Variables</h2>
        <p>{{ variableSummary }}</p>
      </header>

      <div v-if="variableRows.length" class="table">
        <div v-for="row in variableRows" :key="row.key" class="row">
          <code>{{ row.key }}</code>
          <span>{{ row.value }}</span>
        </div>
      </div>

      <div v-else class="empty">
        <code>NUXT_KIBAO_PLAYGROUND=true</code>
        <span>Enable the module and provide OpenBao credentials in `.env`.</span>
      </div>
    </section>

    <section class="panel">
      <header>
        <h2>Import Surface</h2>
        <p>Published subpaths loaded by this page.</p>
      </header>

      <div class="exports">
        <div v-for="item in exportChecks" :key="item.name">
          <code>{{ item.name }}</code>
          <strong>{{ item.type }}</strong>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import kibaoRuntime, { getAllVars, reconsileConfig } from "@chiballc/utils/kibao/runtime";
import { getKibaoHeaders } from "@chiballc/utils/kibao/runtime/utils";
import { setEnv } from "@chiballc/utils/kibao/runtime/env";

type VarsProvider = {
  data: Record<string, string>;
  refresh: () => Promise<void>;
};

const nuxtApp = useNuxtApp();
const varsProvider = computed(() => (nuxtApp.$vars as unknown as VarsProvider | undefined) || null);
const refreshState = ref<"idle" | "refreshing" | "done" | "error">("idle");

const hasProvider = computed(() => Boolean(varsProvider.value));
const isConfigured = computed(() => hasProvider.value && variableCount.value > 0);
const vars = computed(() => varsProvider.value?.data || {});
const variableRows = computed(() =>
  Object.entries(vars.value)
    .filter(([key]) => key !== "_created")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      key,
      value,
    })),
);
const variableCount = computed(() => variableRows.value.length);
const variableSummary = computed(() =>
  variableCount.value === 1 ? "1 variable resolved." : `${variableCount.value} variables resolved.`,
);

const exportChecks = [
  { name: "runtime.default", type: typeof kibaoRuntime },
  { name: "runtime.getAllVars", type: typeof getAllVars },
  { name: "runtime.reconsileConfig", type: typeof reconsileConfig },
  { name: "utils.getKibaoHeaders", type: typeof getKibaoHeaders },
  { name: "env.setEnv", type: typeof setEnv },
];

async function refreshVars() {
  if (!varsProvider.value) {
    return;
  }

  refreshState.value = "refreshing";
  try {
    await varsProvider.value.refresh();
    refreshState.value = "done";
  } catch {
    refreshState.value = "error";
  }
}
</script>

<style>
:root {
  color: #182018;
  background: #eef3ed;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body {
  margin: 0;
}

.shell {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  padding: 40px 0;
  display: grid;
  gap: 16px;
}

.panel {
  background: #ffffff;
  border: 1px solid #d7dfd5;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 12px 30px rgb(31 52 35 / 8%);
}

.status-panel {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(300px, 1.4fr) auto;
  align-items: center;
  gap: 24px;
}

.eyebrow,
header p,
.empty span {
  margin: 0;
  color: #667260;
  font-size: 0.9rem;
}

h1,
h2 {
  margin: 0;
  line-height: 1.1;
}

h1 {
  margin-top: 6px;
  font-size: clamp(2rem, 6vw, 4.8rem);
}

h2 {
  font-size: 1.1rem;
}

header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid #dfe6dd;
  border-radius: 8px;
  overflow: hidden;
}

.status-grid div,
.exports div {
  min-width: 0;
  padding: 14px;
  display: grid;
  gap: 4px;
}

.status-grid div + div {
  border-left: 1px solid #dfe6dd;
}

.status-grid span {
  color: #667260;
  font-size: 0.78rem;
  text-transform: uppercase;
}

button {
  min-width: 112px;
  height: 42px;
  border: 0;
  border-radius: 8px;
  background: #1f5f46;
  color: #ffffff;
  font-weight: 700;
  cursor: pointer;
}

button:disabled {
  background: #b8c4b6;
  cursor: not-allowed;
}

.table {
  display: grid;
  border: 1px solid #dfe6dd;
  border-radius: 8px;
  overflow: hidden;
}

.row {
  display: grid;
  grid-template-columns: minmax(180px, 0.6fr) minmax(0, 1fr);
  gap: 16px;
  padding: 12px 14px;
}

.row + .row {
  border-top: 1px solid #dfe6dd;
}

code {
  overflow-wrap: anywhere;
  color: #264238;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 0.9rem;
}

.row span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.empty {
  min-height: 120px;
  border: 1px dashed #b8c4b6;
  border-radius: 8px;
  display: grid;
  place-content: center;
  gap: 10px;
  text-align: center;
}

.exports {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  border: 1px solid #dfe6dd;
  border-radius: 8px;
  overflow: hidden;
}

.exports div + div {
  border-left: 1px solid #dfe6dd;
}

@media (max-width: 860px) {
  .status-panel,
  .status-grid,
  .row,
  .exports {
    grid-template-columns: 1fr;
  }

  .status-grid div + div,
  .exports div + div {
    border-left: 0;
    border-top: 1px solid #dfe6dd;
  }

  header {
    display: grid;
  }
}
</style>
