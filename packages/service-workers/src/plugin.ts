import path from "node:path";
import fs from "node:fs";
import type { Plugin, ResolvedConfig } from "vite";
import { consola } from "consola";

const SERVICEWORKER_SUFFIX = "?serviceworker";

export interface ServiceWorkerPluginOptions {
  /**
   * Optional runtime reference to the app's enum.
   * Used only for diagnostics (e.g. logging available channels),
   * not for type generation.
   */
  appServiceWorkersEnum?: Record<string, string | number>;
  /**
   * Output format for the worker bundle.
   * - "iife" (default): classic self-executing script
   * - "es": native ES module worker
   */
  format?: "iife" | "es";
  /**
   * Explicit directory where built service workers should be written.
   * If omitted, the plugin falls back to:
   * - `<config.root>/public` if it exists
   * - otherwise `<config.root>/<config.build.outDir>`
   */
  publicDir?: string;
  /**
   * Adjust plugin log verbosity.
   * - "silent": no logs
   * - "info" (default): minimal high-level logs
   * - "debug": verbose diagnostics
   */
  logLevel?: "silent" | "info" | "debug";
}

interface ServiceWorkerEntry {
  /** Original source file path (absolute) */
  source: string;
  /** Output filename (e.g., "backup-sync-sw.js") */
  outputName: string;
}

/**
 * Vite plugin that provides `?serviceworker` query suffix support.
 *
 * In dev: Serves transformed workers from root via middleware.
 * In build: Bundles and places workers at root with a stable name.
 */
export default function serviceWorkerPlugin(options: ServiceWorkerPluginOptions = {}): Plugin[] {
  let config: ResolvedConfig;
  const swEntries = new Map<string, ServiceWorkerEntry>();
  const loggerBase = consola.withTag("vite-plugin-serviceworker");

  const logger =
    options.logLevel === "silent"
      ? {
          log: () => {},
          error: () => {},
          warn: () => {},
          debug: () => {},
        }
      : options.logLevel === "debug"
        ? loggerBase.withTag("debug")
        : loggerBase;

  /**
   * Generate a stable output name from a source file path.
   */
  function generateOutputName(sourcePath: string): string {
    const basename = path.basename(sourcePath);
    const name = basename.replace(/\.(ts|tsx|js|jsx|mjs|mts|cjs|cts)$/, "");
    if (name === "index") {
      const parentDir = path.basename(path.dirname(sourcePath));
      return `${parentDir}-sw.js`;
    }
    return `${name}-sw.js`;
  }

  /**
   * Get the public output directory for service workers.
   */
  function getPublicOutputDir(): string {
    if (options.publicDir) {
      return options.publicDir;
    }

    const sourcePublic = path.join(config.root, "public");
    if (fs.existsSync(sourcePublic)) {
      return sourcePublic;
    }

    return path.resolve(config.root, config.build.outDir);
  }

  let hasBuiltServiceWorkers = false;

  const mainPlugin: Plugin = {
    name: "vite-plugin-serviceworker",
    enforce: "pre",

    configResolved(resolvedConfig) {
      config = resolvedConfig;

      if (options.appServiceWorkersEnum && options.logLevel === "debug") {
        const keys = Object.keys(options.appServiceWorkersEnum);
        logger.debug(`Registered AppServiceWorkers enum with keys: ${keys.join(", ")}`);
      }
    },

    /**
     * Intercept dev server requests to serve service workers from root scope
     */
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || "";
        if (!url.endsWith("-sw.js")) {
          return next();
        }

        // Find the matching entry by output name
        const entryName = url.split("/").pop() || "";
        let entry: ServiceWorkerEntry | undefined;

        for (const e of swEntries.values()) {
          if (e.outputName === entryName) {
            entry = e;
            break;
          }
        }

        if (!entry) {
          return next();
        }

        try {
          // Use Vite's transformRequest to transpile the source on the fly
          const result = await server.transformRequest(entry.source);
          if (result) {
            res.setHeader("Content-Type", "application/javascript");
            res.setHeader("Cache-Control", "no-cache");
            res.end(result.code);
            return;
          }
        } catch (error) {
          logger.error(`Failed to transform ${entry.source} in dev:`, error);
        }

        next();
      });
    },

    async resolveId(source, importer, options) {
      if (!source.endsWith(SERVICEWORKER_SUFFIX)) {
        return null;
      }

      const rawPath = source.slice(0, -SERVICEWORKER_SUFFIX.length);
      const resolved = await this.resolve(rawPath, importer, { skipSelf: true });

      if (!resolved) {
        this.warn(`[vite-plugin-serviceworker] Could not resolve: ${source}`);
        return null;
      }

      const actualPath = resolved.id;
      const outputName = generateOutputName(actualPath);
      swEntries.set(actualPath, {
        source: actualPath,
        outputName,
      });

      return {
        id: actualPath + SERVICEWORKER_SUFFIX,
        external: false,
      };
    },

    load(id) {
      if (!id.endsWith(SERVICEWORKER_SUFFIX)) {
        return null;
      }

      const actualPath = id.slice(0, -SERVICEWORKER_SUFFIX.length);
      const entry = swEntries.get(actualPath);

      if (!entry) return null;

      // Consistently return root-level URL to ensure correct scope (/)
      // In dev, our middleware will intercept this
      // In prod, it will resolve to the root-level bundled file
      const swUrl = `/${entry.outputName}`;

      return {
        code: `export default ${JSON.stringify(swUrl)};`,
        map: null,
      };
    },
  };

  const buildPlugin: Plugin = {
    name: "vite-plugin-serviceworker:build",
    apply: "build",
    enforce: "post",

    async closeBundle() {
      if (swEntries.size === 0 || hasBuiltServiceWorkers) {
        return;
      }

      const { build } = await import("vite");
      const publicDir = getPublicOutputDir();

      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }

      logger.log(`Building ${swEntries.size} service worker(s) to ${publicDir}...`);

      const format = options.format ?? "iife";

      for (const [_, entry] of swEntries) {
        try {
          const swBundle = await build({
            configFile: false,
            root: config.root,
            base: "/",
            mode: config.mode,
            logLevel: "warn",
            build: {
              write: false,
              emptyOutDir: false,
              lib: {
                entry: entry.source,
                formats: [format],
                name: entry.outputName.replace(/[^a-zA-Z0-9]/g, "_"),
                fileName: () => entry.outputName.replace(/\.js$/, ""),
              },
              rollupOptions: {
                output: {
                  entryFileNames: entry.outputName,
                  inlineDynamicImports: true,
                },
              },
              minify: config.build.minify,
              sourcemap: config.build.sourcemap,
            },
            resolve: config.resolve,
            define: {
              ...config.define,
              "import.meta.env.SSR": "false",
            },
          });

          const bundleOutput = Array.isArray(swBundle) ? swBundle[0] : swBundle;
          if (bundleOutput && "output" in bundleOutput) {
            for (const chunk of bundleOutput.output) {
              if (chunk.type === "chunk" && chunk.isEntry) {
                const outputPath = path.join(publicDir, entry.outputName);
                fs.writeFileSync(outputPath, chunk.code, "utf-8");
                logger.log(`✓ ${entry.outputName} written`);

                if (chunk.map) {
                  fs.writeFileSync(`${outputPath}.map`, JSON.stringify(chunk.map), "utf-8");
                }
              }
            }
          }
        } catch (error) {
          logger.error(`Failed to bundle ${entry.source}:`, error);
        }
      }

      hasBuiltServiceWorkers = true;
    },
  };

  return [mainPlugin, buildPlugin];
}
