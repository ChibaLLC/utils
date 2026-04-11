import swPlugin from "@chiballc/utils/plugins";
import { AppServiceWorkers } from "./app/service-workers";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const cwd = dirname(fileURLToPath(import.meta.url));
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  vite: {
    plugins: [
      swPlugin({
        appServiceWorkersEnum: AppServiceWorkers,
        publicDir: join(cwd, "public"),
        format: "iife",
      }) as any,
    ],
  },
});
