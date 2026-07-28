# Documentation Deployment

The documentation site is built with VitePress and deployed by GitHub Actions whenever changes reach `main`. It is published at `https://chiballc.github.io/utils/` when GitHub Pages is enabled for this repository.

The VitePress configuration sets its base path to `/utils/`, which is required because this is a project site rather than an organization root site. If the site is later moved to a custom domain or an organization root site, update `base` in `docs/.vitepress/config.mts` to match the deployed path.

## Work locally

Install the workspace dependencies, then start the VitePress development server.

```bash
pnpm install
pnpm docs:dev
```

Use `pnpm docs:build` to create the production site in `docs/.vitepress/dist`. `pnpm docs:preview` serves that output locally for a final check.

## Enable GitHub Pages

The deployment workflow uploads the generated VitePress site as a GitHub Pages artifact and deploys it with the GitHub Pages environment. In the repository's GitHub settings, open **Pages** and set **Build and deployment** to **GitHub Actions**. No `gh-pages` branch or committed build output is required.
