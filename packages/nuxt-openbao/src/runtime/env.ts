import { entries, keys } from "@chiballc/utils";
import { consola } from "consola";
import { defu } from "defu";
import type { RuntimeConfig } from "nuxt/schema";
import type { KibaoConfig } from "../types";
import type { None } from "@chiballc/types";
import { env } from "std-env";

const console = consola.withTag("kibao-env");
type ModuleRuntimeOptions = Partial<KibaoConfig["kibao"]> & {
  baseURL?: string;
};

export function crawlVarsFromEnv(): Record<string, string> {
  const vars: Record<string, string> = {};
  if (typeof process === "undefined" || !process.env) {
    console.warn("No process object");
    return vars;
  }

  for (const key in process.env) {
    if (key.startsWith("KIBAO_")) {
      vars[key] = `NUXT_${process.env[key]}`;
      continue;
    }

    if (key.startsWith("OPENBAO_")) {
      vars[key] = `NUXT_${process.env[key]?.replace("OPENBAO_", "KIBAO_OPENBAO_")}`;
      continue;
    }

    if (key.startsWith("NUXT_KIBAO_") || key.startsWith("NUXT_OPENBAO_")) {
      vars[key] = process.env[key] as string;
      continue;
    }
  }
  return vars;
}

// TODO: stack
function buildNestedObject(path: string[], value: string): any {
  if (path.length === 0) {
    return value;
  }

  const [head, ...rest] = path;

  if (!head) {
    throw new TypeError("Unexpected empty path segment in environment variable key");
  }

  return {
    [head]: buildNestedObject(rest, value),
  };
}

export function getEnvSereverURL(): string | undefined {
  return (
    (
      process.env.NUXT_KIBAO_BAO_SERVER_URL ||
      process.env.NUXT_PUBLIC_KIBAO_BAO_SERVER_URL ||
      process.env.DEFAULT_BAO_BASE_URL
    )?.trim() || undefined
  );
}

/** @see https://github.com/nitrojs/nitro/blob/v2/src/runtime/internal/utils.env.ts */
export function reconsileConfig<T extends RuntimeConfig>(
  options: ModuleRuntimeOptions | None,
  config: T | None,
): KibaoConfig["kibao"] {
  if (!config) {
    config = {} as any;
  }

  if (!config!.kibao) {
    config!.kibao = {} as any;
  }

  const moduleOptions = (options || {}) as ModuleRuntimeOptions;
  const publicKibao = (config?.public?.kibao || {}) as Partial<KibaoConfig["kibao"]>;

  let merged = defu(config!.kibao, {
    disabled: publicKibao.disabled || moduleOptions.disabled,
    baoServerURL: getEnvSereverURL() || publicKibao.baoServerURL || moduleOptions.baseURL,
    openbao: defu(publicKibao.openbao || {}, moduleOptions.openbao),
    vars: defu(publicKibao.vars || {}, moduleOptions.vars),
    serverURL: publicKibao.serverURL || moduleOptions.serverURL,
  });

  const overrides = crawlVarsFromEnv();
  for (const key of keys(overrides)) {
    const value = overrides[key];
    if (!value) continue;
    if (key.startsWith("NUXT_KIBAO_")) {
      const path = key
        .replace("NUXT_KIBAO_", "")
        .split("_")
        .map((part) => part.toLowerCase());
      const obj = buildNestedObject(path, value);
      merged = defu(merged, obj);
    } else {
      console.warn(`Unknown environment variable ${key} with value ${value} is not applied to kibao configuration`);
    }
  }

  console.success("Finished parsing openbao env variables");
  return merged as unknown as KibaoConfig["kibao"];
}

export function setEnv(kibao: { vars: Record<string, string> }) {
  if (typeof process === "undefined") {
    console.info("Injecting process");
    globalThis.process = {} as any;
  }

  if (!globalThis.process.env) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    globalThis.process.env = {};
  }

  for (const [key, val] of entries(kibao.vars)) {
    process.env[key] = val;
    env[key] = val;
  }
}
