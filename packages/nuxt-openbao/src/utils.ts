import type { SmartString } from "@chiballc/types";
import type { KibaoAccess } from "./runtime/utils";
import { addTypeTemplate } from "@nuxt/kit";
import type { OpenBaoOptions } from "./types";
import { entries } from "@chiballc/utils";

export function printOpenBaoConfig(config: OpenBaoOptions) {
  for (const [access, options] of entries(config)) {
    if (!options) {
      continue;
    }

    const { location } = options;
    console.info(`OpenBao ${access} configuration:`);
    if (location?.path) {
      console.info(`  Location: ${location.path}`);
    } else if (location?.app) {
      console.info(`  Location: app=${location.app}, access=${access}`);
    }
  }
}

export function createTypeTemplates(vars: Record<string, string>, access: SmartString<KibaoAccess>) {
  const renderedVars = Object.keys(vars)
    .map((key) => `      ${JSON.stringify(key)}: string;`)
    .join("\n");

  const vartype = /* typescript */ `
    import type { KibaoConfig, KibaoVars } from "#imports";
    export interface ParsedKibaoConfig extends KibaoConfig["kibao"] {
      vars: {
        ${renderedVars}
      };
    }\n
  `;
  if (access === "private") {
    addTypeTemplate(
      {
        filename: "kibao-nitro-private-app.d.ts",
        getContents() {
          return (
            vartype +
            /* typescript */ `
            declare global {
              namespace NodeJS {
                interface ProcessEnv {
                  ${renderedVars}
                }
              }
            }

            declare module "h3" {
              interface H3EventContext {
                vars: {
                  readonly data: ParsedKibaoConfig['vars'];
                  refresh: () => Promise<void>;
                };
              }
            }

            export {};
          `
          );
        },
      },
      { nitro: true, nuxt: false },
    );
  } else {
    addTypeTemplate(
      {
        filename: "kibao-nuxt-app.d.ts",
        getContents() {
          return (
            vartype +
            /* typescript */ `
          interface KibaoNuxtVars {
            readonly data: ParsedKibaoConfig['vars'];
            refresh: () => Promise<void>;
          }

          declare module "#app" {
            interface NuxtApp {
              $vars: ParsedKibaoConfig['vars'];
            }
          }

          declare module "vue" {
            interface ComponentCustomProperties {
              $vars: ParsedKibaoConfig['vars'];
            }
          }

          export {};
        `
          );
        },
      },
      {
        nitro: false,
        nuxt: true,
      },
    );

    addTypeTemplate(
      {
        filename: `kibao-nitro-${access}-app.d.ts`,
        getContents() {
          return (
            vartype +
            /* typescript */ `
            declare global {
              namespace NodeJS {
                interface ProcessEnv {
                  ${renderedVars}
                }
              }
            }

            declare module "h3" {
              interface H3EventContext {
                vars: {
                  readonly data: ParsedKibaoConfig['vars'];
                  refresh: () => Promise<void>;
                };
              }
            }

            export {};
          `
          );
        },
      },
      { nitro: true, nuxt: false },
    );
  }
}
