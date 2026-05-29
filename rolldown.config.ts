import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";

const plugins = [dts()];

export default defineConfig([
  // --- Root Utils ---
  {
    input: "src/index.ts",
    plugins,
    external: [/node:.*/, "consola", "std-env"],
    output: {
      dir: "dist",
      format: "es",
    },
  },
  {
    input: "src/index.ts",
    external: [/node:.*/, "consola", "std-env"],
    output: [
      {
        format: "cjs",
        dir: "dist",
        entryFileNames: "index.cjs",
      },
      {
        format: "esm",
        dir: "dist",
        entryFileNames: "index.mjs",
      },
    ],
    platform: "neutral",
  },

  // --- Service Workers Runtime ---
  {
    input: "packages/service-workers/src/index.ts",
    plugins,
    external: [/node:.*/, "consola", "std-env", "ulid"],
    output: {
      dir: "dist/service-workers",
      format: "es",
    },
  },
  {
    input: "packages/service-workers/src/index.ts",
    external: [/node:.*/, "consola", "std-env", "ulid"],
    output: [
      {
        format: "cjs",
        dir: "dist/service-workers",
        entryFileNames: "index.js",
      },
      {
        format: "esm",
        dir: "dist/service-workers",
        entryFileNames: "index.mjs",
      },
    ],
    platform: "browser",
  },

  // --- Service Workers Vite Plugin ---
  {
    input: "packages/service-workers/src/plugin.ts",
    plugins,
    external: [/node:.*/, "vite", "consola"],
    output: {
      dir: "dist/service-workers",
      format: "es",
    },
  },
  {
    input: "packages/service-workers/src/plugin.ts",
    external: [/node:.*/, "vite", "consola"],
    output: [
      {
        format: "cjs",
        dir: "dist/service-workers",
        entryFileNames: "plugin.js",
      },
      {
        format: "esm",
        dir: "dist/service-workers",
        entryFileNames: "plugin.mjs",
      },
    ],
    platform: "node",
  },

  // --- Web Workers Runtime ---
  {
    input: "packages/web-workers/src/index.ts",
    plugins,
    external: [/node:.*/, "consola", "std-env", "ulid"],
    output: {
      dir: "dist/web-workers",
      format: "es",
    },
  },
  {
    input: "packages/web-workers/src/index.ts",
    external: [/node:.*/, "consola", "std-env", "ulid"],
    output: [
      {
        format: "cjs",
        dir: "dist/web-workers",
        entryFileNames: "index.js",
      },
      {
        format: "esm",
        dir: "dist/web-workers",
        entryFileNames: "index.mjs",
      },
    ],
    platform: "browser",
  },
]);
