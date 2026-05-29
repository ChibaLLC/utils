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

type KibaoVarsByAccess = Partial<Record<SmartString<KibaoAccess>, Record<string, string>>>;

function renderVars(vars: Record<string, string>) {
  return Object.keys(vars)
    .sort()
    .map((key) => `      ${JSON.stringify(key)}: string;`)
    .join("\n");
}

export function createTypeTemplates(vars: KibaoVarsByAccess) {
  const publicVars = vars.public ?? {};

  const allVars = Object.values(vars).reduce<Record<string, string>>((acc, current) => ({ ...acc, ...current }), {});

  const renderedPublicVars = renderVars(publicVars);
  const renderedAllVars = renderVars(allVars);

  const createVarsType = (name: string, renderedVars: string) => /* typescript */ `
    import type { KibaoConfig } from "#imports";

    export interface ${name} extends KibaoConfig["kibao"] {
      vars: {
        ${renderedVars}
      };
    }
    `;

  const createNitroTemplate = () => /* typescript */ `
    ${createVarsType("ParsedKibaoNitroConfig", renderedAllVars)}

    declare global {
      namespace NodeJS {
        interface ProcessEnv {
          ${renderedAllVars}
        }
      }
    }

    declare module "h3" {
      interface H3EventContext {
        vars?: {
          readonly data: ParsedKibaoNitroConfig["vars"];
          refresh: () => Promise<void>;
        };
      }
    }

    export {};
    `;

  const createNuxtTemplate = () => /* typescript */ `
    ${createVarsType("ParsedKibaoNuxtConfig", renderedPublicVars)}

    declare module "#app" {
      interface NuxtApp {
        $vars?: {
          readonly data: ParsedKibaoNuxtConfig["vars"];
          refresh: () => Promise<void>;
        };
      }
    }

    declare module "vue" {
      interface ComponentCustomProperties {
        $vars?: {
          readonly data: ParsedKibaoNuxtConfig["vars"];
          refresh: () => Promise<void>;
        };
      }
    }

    export {};
    `;

  addTypeTemplate(
    {
      filename: "kibao-nitro-app.d.ts",
      getContents: createNitroTemplate,
    },
    {
      nitro: true,
      nuxt: false,
    },
  );

  addTypeTemplate(
    {
      filename: "kibao-nuxt-app.d.ts",
      getContents: createNuxtTemplate,
    },
    {
      nitro: false,
      nuxt: true,
    },
  );
}
