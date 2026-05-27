import { joinURL } from "ufo";
import { defineLazyEventHandler, proxyRequest, defineEventHandler, createError } from "h3";
import { consola } from "consola";
import { useRuntimeConfig } from "nitropack/runtime";

const logger = consola.withTag("kibao-bao-proxy");
export default defineLazyEventHandler(() => {
  const { kibao } = useRuntimeConfig();

  return defineEventHandler(async (event) => {
    if (!kibao.baoServerURL) {
      throw createError({
        statusCode: 500,
        statusMessage: "Missing 'baoServerURL' runtime configuration",
      });
    }

    const start = performance.now();

    const target = joinURL(kibao.baoServerURL, event.path.replace("/bao-proxy", ""));

    return proxyRequest(event, target, {
      async onResponse(_, response) {
        const duration = Math.round(performance.now() - start);

        if (response.ok) {
          logger.info(
            `${event.method} ${event.path} → ${target} · ${response.status} ${response.statusText} · ${duration}ms`,
          );
        } else {
          logger.error(
            `${event.method} ${event.path} → ${target} · ${response.status} ${response.statusText} · ${duration}ms`,
          );
        }
      },
    });
  });
});
