import { defineNuxtPlugin, createError } from "nuxt/app";
import { consola } from "consola";
import { defu } from "defu";
import { joinURL } from "ufo";
import { setEnv } from "../env";
import { getSecrets } from "../utils";
import type { KibaoConfig, KibaoVars } from "../../types";

export default defineNuxtPlugin({
  enforce: "pre",
  async setup(app) {
    const console = consola.withTag("kibao");
    const config = app.$config.public.kibao as unknown as KibaoConfig["kibao"];
    if (!config) {
      throw createError({
        message: "Unable to find config",
        data: app.$config,
      });
    }

    async function refresh() {
      if (config.openbao?.public) {
        console.info("Fetching public vars");
        const _vars = await getSecrets(
          {
            baseURL: joinURL(config.serverURL || "", "/bao-proxy"),
            token: config.openbao.public.token as any,
            location: config.openbao.public?.location as any,
          },
          "public",
        );
        setEnv(_vars);
        console.success("Successfully substituted public variables from OpenBao");
        return _vars;
      } else {
        console.fatal("Unable to fetch public variables");
      }
    }

    if (!config.vars) {
      config.vars = {} as any;
    }

    if (config.vars?._created) {
      setEnv({ vars: config.vars });
      console.info("Variables already exist in environment, skipping refetch");
    } else if (config.openbao?.public) {
      const { vars: _vars } = (await refresh()) || {};
      config.vars = defu(_vars, config.vars) as KibaoVars;
    }

    return {
      provide: {
        vars: {
          get data() {
            return config.vars;
          },
          async refresh() {
            const { vars: _vars } = (await refresh()) || {};
            config.vars = defu(_vars, config.vars);
          },
        },
      },
    };
  },
});
