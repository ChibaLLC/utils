import { defineNitroPlugin } from "nitropack/runtime";
import { injectVars } from "../utils";

export default defineNitroPlugin(async (app) => {
  injectVars({
    app,
  });
});
