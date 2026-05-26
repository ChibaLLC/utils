import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const source = resolve(root, "packages/nuxt-openbao/dist");
const target = resolve(root, "dist/kibao");
const output = resolve(target, "dist");

if (!existsSync(source)) {
  throw new Error(`Kibao build output was not found at ${source}`);
}

rmSync(target, { force: true, recursive: true });
mkdirSync(output, { recursive: true });
cpSync(source, output, { recursive: true });

writeFileSync(
  resolve(output, "runtime/index.js"),
  [
    'export * from "./env.js";',
    'export * from "./utils.js";',
    'import * as env from "./env.js";',
    'import * as utils from "./utils.js";',
    "export default { ...env, ...utils };",
    "",
  ].join("\n"),
);

writeFileSync(
  resolve(output, "runtime/index.d.ts"),
  [
    'export * from "./env.js";',
    'export * from "./utils.js";',
    'import * as env from "./env.js";',
    'import * as utils from "./utils.js";',
    "declare const runtime: typeof env & typeof utils;",
    "export default runtime;",
    "",
  ].join("\n"),
);
