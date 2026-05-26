import { defineEventHandler } from "h3";

export default defineEventHandler((event) => {
  return {
    vars: event.context.vars.data,
    processEnv: {
      PUBLIC_FROM_BAO: process.env.PUBLIC_FROM_BAO,
      PRIVATE_FROM_BAO: process.env.PRIVATE_FROM_BAO,
      SHARED_FROM_BAO: process.env.SHARED_FROM_BAO,
    },
  };
});
