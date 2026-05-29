import { defineEventHandler } from "h3";
import runtimeVars from "./runtime-vars";

export default defineEventHandler(async (event) => {
  await event.context.vars.refresh(event);
  return runtimeVars(event);
});
