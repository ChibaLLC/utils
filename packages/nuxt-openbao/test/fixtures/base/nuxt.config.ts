import Kibao from "../../../src/module";

export default defineNuxtConfig({
  modules: [Kibao],
  kibao: {
    serverOnly: true,
  },
});
