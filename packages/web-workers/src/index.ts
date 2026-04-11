import { isWebWorker } from "../../../src/env";

interface ViteWorker {
  prototype: Worker;
  new (options?: WorkerOptions): Worker;
}

const workerCache = new Map<string, Worker>();

export type WorkerWrapper = (options?: WorkerOptions) => Worker;
interface ViteWorker {
  prototype: Worker;
  new (options?: WorkerOptions): Worker;
}

function isViteWorker(worker: any): worker is ViteWorker {
  return worker?.prototype instanceof Worker;
}

type PendingRequest = {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

export interface WorkerClient<T = any> {
  postMessage(message: any): void;
  sendMessage<T>(type: string, data?: any, timeoutMs?: number): Promise<T>;
  sendMessages<T>(messages: Array<{ type: string; data?: any }>, timeoutMs?: number): Promise<T[]>;
  onMessage(cb: (event: MessageEvent) => void): () => void;
  onError(cb: (event: ErrorEvent) => void): () => void;
  release(): void;
  terminate(): void;
  readonly worker: Worker;
}

type RegistryEntry = {
  worker: Worker;
  client: WorkerClient;
  pendingRequests: Map<number, PendingRequest>;
  messageHandlers: Set<(e: MessageEvent) => void>;
  errorHandlers: Set<(e: ErrorEvent) => void>;
  requestId: number;
  refCount: number;
  options: {
    ephemeral?: boolean;
    autoTerminateOnRelease?: boolean;
    alwaysNew?: boolean;
  };
};

const workerRegistry = new Map<string, RegistryEntry>();

export function createRawWorker(wrapper: WorkerWrapper | Worker | ViteWorker | URL | string): Worker | undefined {
  if (wrapper instanceof Worker) {
    return wrapper;
  }

  if (wrapper instanceof URL) {
    return new Worker(wrapper, { type: "module" });
  }

  if (isViteWorker(wrapper)) {
    return new (wrapper as ViteWorker)({ type: "module" });
  }

  if (typeof wrapper === "string") {
    return new Worker(wrapper, { type: "module" });
  }

  return wrapper({ type: "module" });
}

let newInstanceCounter = 0;
function makeUniqueRegistryKey(baseKey: string) {
  newInstanceCounter++;
  return `${baseKey}__new__${Date.now().toString(36)}_${newInstanceCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * useWebWorker(...) returns a WorkerClient.
 *
 * Call shapes:
 *   useWebWorker(key, wrapper, options?)
 *   useWebWorker(wrapper, options?)
 *
 * Options:
 *  - ephemeral?: boolean
 *  - enableInSSR?: boolean
 *  - autoTerminateOnRelease?: boolean
 *  - alwaysNew?: boolean   <-- NEW: when true ALWAYS create a fresh instance (default false)
 */
export function useWebWorker<T = any>(
  maybeKeyOrWrapper: string | WorkerWrapper | Worker | ViteWorker | URL,
  maybeWrapperOrOptions?:
    | WorkerWrapper
    | Worker
    | ViteWorker
    | URL
    | { ephemeral?: boolean; autoTerminateOnRelease?: boolean; alwaysNew?: boolean },
  maybeOptions?: { ephemeral?: boolean; autoTerminateOnRelease?: boolean; alwaysNew?: boolean },
): WorkerClient<T> | undefined {
  // Normalize arguments
  let key: string | undefined;
  let wrapper: WorkerWrapper | Worker | ViteWorker | URL | undefined;
  let options: { ephemeral?: boolean; autoTerminateOnRelease?: boolean; alwaysNew?: boolean } | undefined;

  if (typeof maybeKeyOrWrapper === "string") {
    key = maybeKeyOrWrapper;
    wrapper = maybeWrapperOrOptions as WorkerWrapper | Worker | ViteWorker | URL;
    options = maybeOptions;
  } else {
    wrapper = maybeKeyOrWrapper as WorkerWrapper | Worker | ViteWorker | URL;
    options = (maybeWrapperOrOptions as any) || {};
    if (wrapper instanceof URL) {
      key = wrapper.href;
    } else if (wrapper instanceof Worker) {
      key = `__worker_ref_${getOrCreateWorkerId(wrapper)}`;
    } else if (isViteWorker(wrapper)) {
      key = `vite:${String((wrapper as any).name || Math.random().toString(36).slice(2, 9))}`;
    } else {
      key = `wrap:${hashString(String(wrapper))}`;
    }
  }

  if (!key || !wrapper) {
    return undefined;
  }

  // If NOT alwaysNew, reuse cached instance if present.
  if (!options?.alwaysNew) {
    const existing = workerRegistry.get(key);
    if (existing) {
      existing.refCount++;
      return existing.client;
    }
  }

  // Determine registry key: either base key or unique key when alwaysNew==true
  const registryKey = options?.alwaysNew ? makeUniqueRegistryKey(key) : key;

  // Create the worker instance
  const worker = createRawWorker(wrapper);
  if (!worker) {
    console.error("Failed to create worker instance");
    return undefined;
  }

  // Create registry entry
  const entry: RegistryEntry = {
    worker,
    client: null as unknown as WorkerClient,
    pendingRequests: new Map(),
    messageHandlers: new Set(),
    errorHandlers: new Set(),
    requestId: 0,
    refCount: 1,
    options: {
      ephemeral: options?.ephemeral ?? false,
      autoTerminateOnRelease: options?.autoTerminateOnRelease ?? false,
      alwaysNew: options?.alwaysNew ?? false,
    },
  };

  worker.addEventListener("message", (event: MessageEvent) => {
    const payload = event.data;
    const id = payload?.id;
    const data = payload?.data;
    const error = payload?.error;

    if (id !== undefined && entry.pendingRequests.has(id)) {
      const pending = entry.pendingRequests.get(id)!;
      clearTimeout(pending.timeoutId);
      entry.pendingRequests.delete(id);

      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve(data);
      }
      return;
    }

    // broadcast / unsolicited
    entry.messageHandlers.forEach((h) => {
      try {
        h(event);
      } catch (e) {
        console.error("Worker message handler error", e);
      }
    });
  });

  worker.addEventListener("error", (ev) => {
    entry.errorHandlers.forEach((h) => {
      try {
        h(ev);
      } catch (e) {
        console.error("Worker error handler error", e);
      }
    });
  });
  // Build client
  const client: WorkerClient = {
    worker,

    postMessage(message: any) {
      try {
        worker.postMessage(message);
      } catch (e) {
        console.error("Failed to postMessage to worker", e);
      }
    },

    sendMessage<T = any>(type: string, data?: any, timeoutMs: number = 10000): Promise<T> {
      const id = ++entry.requestId;
      return new Promise<T>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          entry.pendingRequests.delete(id);
          reject(new Error(`Web Worker response timeout after ${timeoutMs}ms`));
        }, timeoutMs);

        entry.pendingRequests.set(id, { resolve, reject, timeoutId });
        try {
          worker.postMessage({ id, type, data });
        } catch (err) {
          clearTimeout(timeoutId);
          entry.pendingRequests.delete(id);
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    },

    sendMessages<T = any>(messages: Array<{ type: string; data?: any }>, timeoutMs?: number) {
      return Promise.all(messages.map((m) => client.sendMessage<T>(m.type, m.data, timeoutMs)));
    },

    onMessage(cb: (event: MessageEvent) => void) {
      entry.messageHandlers.add(cb);
      return () => entry.messageHandlers.delete(cb);
    },

    onError(cb: (event: ErrorEvent) => void) {
      entry.errorHandlers.add(cb);
      return () => entry.errorHandlers.delete(cb);
    },

    release() {
      entry.refCount = Math.max(0, entry.refCount - 1);

      const shouldTerminate = entry.refCount === 0 && (entry.options.ephemeral || entry.options.autoTerminateOnRelease);

      if (shouldTerminate) {
        client.terminate();
      }
    },

    terminate() {
      entry.pendingRequests.forEach((p) => clearTimeout(p.timeoutId));
      entry.pendingRequests.clear();
      entry.messageHandlers.clear();

      try {
        worker.terminate();
      } catch (e) {}

      workerRegistry.delete(registryKey);
    },
  };

  entry.client = client;
  workerRegistry.set(registryKey, entry);

  return client;
}

const workerIdMap = new WeakMap<Worker, string>();
let workerIdCounter = 0;
function getOrCreateWorkerId(w: Worker) {
  if (workerIdMap.has(w)) return workerIdMap.get(w)!;
  const id = `${Date.now().toString(36)}_${++workerIdCounter}`;
  workerIdMap.set(w, id);
  return id;
}

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * Terminate and remove a cached worker
 */
export function terminateCachedWorker(key: string): void {
  const worker = workerCache.get(key);
  if (worker) {
    worker.terminate();
    workerCache.delete(key);
  }
}

type TransporterHandler<T = any, R = any> = (data: T, event: MessageEvent) => R | Promise<R> | void | Promise<void>;

/**
 * Define a message handler for a web worker script.
 *
 * Usage (inside worker):
 *
 * defineWTransporter(async (data, event) => {
 *   if(data.type === 'PING') {
 *     return { pong: true };
 *   }
 * });
 */
export function defineWTransporter<T = any, R = any>(handler: TransporterHandler<T, R>) {
  if (!isWebWorker) {
    console.warn("defineWTransporter can only be used in web workers, did you mean defineSwTransporter?");
    return;
  }
  globalThis.addEventListener("message", async (event: MessageEvent) => {
    const { id, type, data } = event.data ?? {};
    try {
      const result = await handler({ type, ...data }, event);

      if (id !== undefined) {
        globalThis.postMessage({ id, data: result });
      }
    } catch (error) {
      if (id !== undefined) {
        const message = error instanceof Error ? error.message : String(error);
        globalThis.postMessage({ id, error: message });
      }
    }
  });
}

export function defineWRouter<T extends { type: string }>(handlers: Record<string, TransporterHandler<any, any>>) {
  return defineWTransporter<T>(async (data, event) => {
    const handler = handlers[data.type];

    if (!handler) {
      console.warn(`[worker] No handler for message type: ${data.type}`);
      return;
    }

    return await handler(data, event);
  });
}
