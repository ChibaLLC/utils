import { consola } from "consola";
import { ulid } from "ulid";
import { toNumber } from "@chiballc/utils";

declare module "h3" {
  interface H3EventContext {
    __meta?: {
      start?: number;
      id?: string;
    };
  }
}

export default defineNitroPlugin((app) => {
  const logger = consola.withTag("anouncer");

  app.hooks.hook("request", (event) => {
    const start = performance.now();
    event.context.__meta = {
      id: ulid(),
      start,
    };
  });

  app.hooks.hook("afterResponse", (event) => {
    if (event.context.__meta && event.context.__meta.start) {
      const duration = Math.round(performance.now() - event.context.__meta.start);

      if (toNumber(duration) <= 300) {
        logger.info(`${event.method} ${event.path} ${event.node.res.statusCode} · ${duration}ms`);
      } else {
        logger.warn(`${event.method} ${event.path} ${event.node.res.statusCode} ${event.node.res.statusMessage} · ${duration}ms`);
      }
    }
  });
});
