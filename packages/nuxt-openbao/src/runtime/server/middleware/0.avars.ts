import { defineEventHandler } from "h3";
import { injectVars } from "../utils";
import { consola } from "consola";

const console = consola.withTag("kibao").withTag("0.vars.ts");
export default defineEventHandler((event) => {
  try {
    injectVars({ event });
  } catch (e) {
    console.error(e);
  }
});
