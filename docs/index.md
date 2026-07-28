---
layout: home

hero:
  name: Chiba LLC Utils
  text: Small building blocks for TypeScript and Nuxt
  tagline: Core utilities, browser worker messaging, and OpenBao-backed runtime configuration.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/ChibaLLC/utils

features:
  - title: Practical TypeScript utilities
    details: Work with values, iterables, promises, time, caches, queues, and sortable identifiers without pulling in many small packages.
  - title: Worker communication
    details: Build request-response and broadcast messaging around web workers and service workers while keeping lifecycle management explicit.
  - title: Nuxt and OpenBao
    details: Use Kibao to load typed public and private configuration from OpenBao with bounded responses and server-first defaults.
---

## Choose the package you need

`@chiballc/utils` is the primary package. It exports the general-purpose helpers used throughout the repository and provides worker-related subpath exports. `kibao` is a Nuxt module for reading configuration from OpenBao.

The packages are designed to be used independently. Install only the package and entry point your application needs.

::: tip
Start with the [getting started guide](/guide/getting-started), then see the package pages for behavior, lifecycle details, and examples.
:::
