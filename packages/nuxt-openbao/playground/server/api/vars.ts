import { keys, toArray } from "@chiballc/utils";

export default defineEventHandler((event) => {
  return toArray(keys(event.context.vars?.data));
});
