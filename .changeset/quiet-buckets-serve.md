---
"kibao": patch
---

fix: sync OpenBao variables into Nuxt runtime config and refresh them during Nitro runtime requests

Adds production and Cloudflare Worker coverage for build-time module visibility, runtime availability, and changed OpenBao values after the app is already running.
