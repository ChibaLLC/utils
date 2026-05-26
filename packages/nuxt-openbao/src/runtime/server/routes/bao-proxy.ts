import { joinURL } from "ufo";
import { defineLazyEventHandler, proxyRequest, defineEventHandler, createError } from "h3";
import { consola } from "consola";
import { useRuntimeConfig } from "nitropack/runtime";

const console = consola.withTag("kibao-bao-proxy");
export default defineLazyEventHandler(() => {
  const { kibao } = useRuntimeConfig();

  return defineEventHandler((event) => {
    if (!kibao.baoServerURL) {
      throw createError({
        message: "Could not find the 'baoServerURL'",
        status: 500,
      });
    }
    const target = joinURL(kibao.baoServerURL, event.path.replace("/bao-proxy", ""));
    console.info("proxying to: ", target);
    return proxyRequest(event, target, {
      onResponse(_, response) {
        console.info("response", response.status);
      },
    });
  });
});
