import { defineNitroPlugin, useRuntimeConfig } from "nitropack/runtime";
import { defu } from "defu";
import { entries } from "@chiballc/utils";
import { reconsileConfig, setEnv } from "../../env";
import { getAllVars } from "../../utils";
import type { KibaoVars } from "../../../types";

export default defineNitroPlugin(async (app) => {
  const config = useRuntimeConfig();
  if (config.kibao?.disabled) {
    return;
  }

  const kibao = reconsileConfig(null, config);
  const groupedVars = await getAllVars(kibao.openbao);
  for (const [_, _vars] of entries(groupedVars)) {
    kibao.vars = defu(kibao.vars, _vars) as KibaoVars;
    setEnv({ vars: _vars || {} });
  }

  app.hooks.hook("request", async (event) => {
    event.context.vars = {
      get data() {
        return kibao.vars || {};
      },
      async refresh() {
        const vars = await getAllVars(kibao.openbao);
        for (const [_, _vars] of entries(vars)) {
          kibao.vars = defu(kibao.vars, _vars) as KibaoVars;
          setEnv({ vars: _vars || {} });
        }
      },
    };
  });
});
