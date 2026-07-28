# Kibao

Kibao is a Nuxt module that reads public and private variables from OpenBao and applies them to Nuxt runtime configuration. It is published as `kibao` and bundled into the root package's `@chiballc/utils/kibao` export for consumers that need the packaged module directly.

```bash
pnpm add kibao
```

## Configure OpenBao access

Register the module and provide one or both access levels. Public variables are made available in Nuxt's public runtime configuration. Private variables remain server-side.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["kibao"],
  kibao: {
    openbao: {
      public: {
        baseURL: "https://bao.example.com",
        location: { app: "storefront", environment: "production" },
        token: "yes_this_ok_to_be_public_example-token",
      },
      private: {
        baseURL: "https://bao.example.com",
        location: { path: "v1/storefront/data/production/private" },
        token: "is_private_access_example-token",
      },
    },
  },
});
```

Public tokens must be explicitly prefixed with `yes_this_ok_to_be_public_`. Private tokens can be prefixed with `is_private_access_`; tokens without either prefix are treated as private. Do not put a real private token or secret in client-side code or committed configuration.

Kibao also supports AppRole credentials using `bao.role.id` and `bao.secret.id`. It logs in to OpenBao, uses the returned token for the secret request, and keeps the configured namespace at `root` unless one is supplied.

## Runtime behavior

At module setup, Kibao loads configured OpenBao values, writes them to the server environment, and applies values to matching paths already present in runtime configuration. Browser code receives only the public group. Set `serverOnly: true` to prevent Kibao's browser plugin and proxy route from being registered.

Environment variables can override configuration. Kibao recognizes `NUXT_KIBAO_*`, `KIBAO_*`, and `OPENBAO_*` forms. The OpenBao server URL can be supplied through `NUXT_KIBAO_SERVER_BAO`, `NUXT_PUBLIC_KIBAO_BAO_SERVER_URL`, or `DEFAULT_BAO_BASE_URL`.

## Request safety

The runtime helpers `getSecrets`, `getKibaoHeaders`, and `getKibaoToken` accept a caller-owned `AbortSignal`. Responses must be JSON and are streamed with a maximum size of 64 KiB. Kibao does not retry failed network operations, and its transport errors avoid including credentials, tokens, URLs, or response bodies.

```ts
import { getSecrets } from "kibao/runtime";

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 2_000);

try {
  const { vars } = await getSecrets(credentials, "private", {
    signal: controller.signal,
  });
  console.log(vars);
} finally {
  clearTimeout(timeout);
}
```

`maxResponseBytes` can make the response limit smaller, but cannot raise it above 64 KiB.

## Test fixtures

Use `kibao.test` only in controlled test environments. It injects fixture values without contacting OpenBao and does not expose private fixture values to public runtime configuration.

```ts
export default defineNuxtConfig({
  kibao: {
    test: {
      enabled: true,
      vars: {
        public: { NUXT_PUBLIC_API_ORIGIN: "https://example.test" },
        private: { API_TOKEN: "synthetic-test-token" },
      },
    },
  },
});
```

Never enable test fixture values in a deployed application.
