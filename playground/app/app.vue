<script setup lang="ts">
// Nuxt 4 imports from our new workers directory
import swUrl from "./workers/sw.ts?serviceworker";
import TestWorker from "./workers/test.worker.ts?worker";

import { useServiceWorker } from "@chiballc/utils/service-workers";
import { useWebWorker } from "@chiballc/utils/web-workers";
import { AppServiceWorkers } from "./service-workers";

// Types for our communication log
interface LogEntry {
  id: string;
  type: "INFO" | "REQ" | "RES" | "EVENT" | "ERROR";
  source: "SW" | "WW" | "SYS";
  message: any;
  time: string;
}

const status = ref({
  sw: "IDLE",
  ww: "IDLE",
});
const logs = ref<LogEntry[]>([]);
const sw = ref<any>(null);
const ww = ref<any>(null);
const info = ref({
  sw: null,
  ww: null,
});

const addLog = (type: LogEntry["type"], source: LogEntry["source"], message: any) => {
  logs.value.unshift({
    id: Math.random().toString(36).substring(7),
    type,
    source,
    message,
    time: new Date().toLocaleTimeString(),
  });
};

// --- Service Worker Logic ---
const initSW = async () => {
  status.value.sw = "LOADING";
  addLog("INFO", "SYS", "Initializing Service Worker...");
  try {
    const swInstance = await useServiceWorker(swUrl, AppServiceWorkers.Test);
    if (!swInstance) throw new Error("SW initialization failed");

    sw.value = swInstance;
    status.value.sw = "READY";
    addLog("INFO", "SW", "Ready.");

    swInstance.onMessage((event: MessageEvent) => {
      addLog("EVENT", "SW", event.data);
    });

    const result = await swInstance.sendMessage("GET_INFO");
    info.value.sw = result;
  } catch (err: any) {
    status.value.sw = "ERROR";
    addLog("ERROR", "SW", err.message);
  }
};

const onPingSW = async () => {
  if (!sw.value) return;
  addLog("REQ", "SW", "Sending PING...");
  try {
    const res = await sw.value.sendMessage("PING", { at: Date.now() });
    addLog("RES", "SW", res);
  } catch (err: any) {
    addLog("ERROR", "SW", err.message);
  }
};

// --- Web Worker Logic ---
const initWW = async () => {
  status.value.ww = "LOADING";
  addLog("INFO", "SYS", "Initializing Web Worker...");
  try {
    // useWebWorker handles instantiation and communication wrapping
    const wwInstance = useWebWorker("test-worker", TestWorker);
    if (!wwInstance) throw new Error("WW initialization failed");

    ww.value = wwInstance;
    status.value.ww = "READY";
    addLog("INFO", "WW", "Ready.");

    wwInstance.onMessage((event) => {
      addLog("EVENT", "WW", event.data);
    });
  } catch (err: any) {
    status.value.ww = "ERROR";
    addLog("ERROR", "WW", err.message);
  }
};

const onPingWW = async () => {
  if (!ww.value) return;
  addLog("REQ", "WW", "Sending PING...");
  try {
    const res = await ww.value.sendMessage("PING", { val: Math.random() });
    addLog("RES", "WW", res);
  } catch (err: any) {
    addLog("ERROR", "WW", err.message);
  }
};

const onCalcWW = async () => {
  if (!ww.value) return;
  const n = 1000000;
  addLog("REQ", "WW", `Calculating sum up to ${n}...`);
  try {
    const res = await ww.value.sendMessage("CALCULATE", { n });
    addLog("RES", "WW", res);
  } catch (err: any) {
    addLog("ERROR", "WW", err.message);
  }
};

const clearLogs = () => (logs.value = []);

onMounted(() => {
  initSW();
  initWW();
});

onUnmounted(() => {
  sw.value?.close();
  ww.value?.terminate();
});
</script>

<template>
  <div class="sw-dashboard">
    <header class="main-header">
      <div class="brand">
        <h1>@chiballc/utils <span class="badge">Worker Factory</span></h1>
      </div>
      <div class="status-group">
        <div class="sw-state" :class="status.sw.toLowerCase()">
          <span class="indicator"></span>
          SW: {{ status.sw }}
        </div>
        <div class="sw-state" :class="status.ww.toLowerCase()">
          <span class="indicator"></span>
          WW: {{ status.ww }}
        </div>
      </div>
    </header>

    <div class="grid">
      <!-- Info Panel -->
      <aside class="panel info-panel glass">
        <h2>Worker Controls</h2>

        <div class="section">
          <h3>Service Worker (Broadcast)</h3>
          <div class="btn-group">
            <button class="btn primary" @click="onPingSW" :disabled="status.sw !== 'READY'">
              <span class="icon">⚡</span> SW Ping
            </button>
            <button class="btn" @click="initSW"><span class="icon">🔄</span> Re-init SW</button>
          </div>
        </div>

        <div class="section mt-8">
          <h3>Web Worker (Direct)</h3>
          <div class="btn-group">
            <button class="btn secondary" @click="onPingWW" :disabled="status.ww !== 'READY'">
              <span class="icon">✨</span> WW Ping
            </button>
            <button class="btn secondary" @click="onCalcWW" :disabled="status.ww !== 'READY'">
              <span class="icon">🖩</span> Heavy Calc Test
            </button>
            <button class="btn" @click="initWW"><span class="icon">🔄</span> Re-init WW</button>
          </div>
        </div>

        <div class="info-footer mt-8">
          <p>Nuxt 4 /workers convention</p>
          <code>{{ swUrl }}</code>
        </div>
      </aside>

      <!-- Logging Panel -->
      <main class="panel console-panel glass">
        <div class="panel-header">
          <h2>Unified Communication Bus</h2>
          <button class="btn-text" @click="clearLogs">Clear Logs</button>
        </div>

        <div class="console">
          <div
            v-for="log in logs"
            :key="log.id"
            class="log-entry"
            :class="[log.type.toLowerCase(), log.source.toLowerCase()]"
          >
            <div class="log-meta">
              <span class="log-time">{{ log.time }}</span>
              <span class="log-tag">[{{ log.source }}] {{ log.type }}</span>
            </div>
            <div class="log-content">
              <pre>{{ typeof log.message === "object" ? JSON.stringify(log.message, null, 2) : log.message }}</pre>
            </div>
          </div>
          <div v-if="logs.length === 0" class="empty-state">Idle... awaiting worker signals.</div>
        </div>
      </main>
    </div>
  </div>
</template>

<style>
:root {
  --primary: #6366f1;
  --secondary: #ec4899;
  --bg: #030712;
  --surface: #111827;
  --text: #f9fafb;
  --text-dim: #9ca3af;
  --border: rgba(255, 255, 255, 0.1);
  --success: #10b981;
}

body {
  background-color: var(--bg);
  color: var(--text);
  font-family: "Inter", system-ui, sans-serif;
  margin: 0;
}

.sw-dashboard {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.main-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.status-group {
  display: flex;
  gap: 1rem;
}

.sw-state {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--surface);
  padding: 0.4rem 0.8rem;
  border-radius: 2rem;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid var(--border);
}

.indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4b5563;
}
.ready .indicator {
  background: var(--success);
  box-shadow: 0 0 8px var(--success);
}
.loading .indicator {
  background: #f59e0b;
}

.grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 2rem;
}

.glass {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 1rem;
  padding: 1.5rem;
}

.section h3 {
  font-size: 0.8rem;
  color: var(--text-dim);
  text-transform: uppercase;
  margin-bottom: 1rem;
}

.btn-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.btn {
  padding: 0.6rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border);
  background: #1f2937;
  color: white;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
}

.btn.primary {
  background: var(--primary);
  border: none;
}
.btn.secondary {
  background: var(--secondary);
  border: none;
}

.console {
  background: #000;
  border-radius: 0.5rem;
  padding: 1rem;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.8rem;
  height: 600px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.log-entry {
  padding: 0.5rem;
  border-bottom: 1px solid #111827;
}

.sw .log-tag {
  color: var(--primary);
}
.ww .log-tag {
  color: var(--secondary);
}
.sys .log-tag {
  color: #9ca3af;
}

.req .log-tag {
  font-weight: bold;
}
.error .log-tag {
  color: #ef4444;
}

pre {
  margin: 0.2rem 0 0;
  white-space: pre-wrap;
  color: #d1d5db;
}

.mt-8 {
  margin-top: 2rem;
}
.badge {
  background: #4f46e5;
  padding: 0.1rem 0.4rem;
  border-radius: 1rem;
  font-size: 0.6rem;
}
</style>
