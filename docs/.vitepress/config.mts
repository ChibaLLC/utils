import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Chiba LLC Utils",
  description: "Utilities, worker messaging, and OpenBao integration for Nuxt.",
  base: "/utils/",
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Packages", link: "/packages/utils" },
      { text: "GitHub", link: "https://github.com/ChibaLLC/utils" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/guide/getting-started" },
        ],
      },
      {
        text: "Packages",
        items: [
          { text: "Core Utilities", link: "/packages/utils" },
          { text: "Ho3", link: "/packages/ho3" },
          { text: "Worker Messaging", link: "/packages/workers" },
          { text: "Kibao", link: "/packages/kibao" },
        ],
      },
      {
        text: "API Reference",
        items: [
          { text: "Core Exports", link: "/reference/core" },
          { text: "Worker Exports", link: "/reference/workers" },
          { text: "Kibao Exports", link: "/reference/kibao" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/ChibaLLC/utils" }],
    search: { provider: "local" },
    editLink: {
      pattern: "https://github.com/ChibaLLC/utils/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },
    footer: {
      message: "Released under the ISC license.",
      copyright: "Copyright 2026 Chiba LLC",
    },
  },
});
