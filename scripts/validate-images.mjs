import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Build check for `@chiballc/utils/images`: every target entry exists, the Workers and Bun entries cannot reach sharp,
 * ipx or a Node built-in, and each export condition resolves to its own adapter.
 */
const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const dist = resolve(root, "dist/images");
const NODE_ONLY = [
  /^node:/,
  /^sharp$/,
  /^ipx$/,
  /^image-meta$/,
  /^unstorage\/drivers\/fs/,
  /^unstorage\/drivers\/lru-cache$/,
  /^lru-cache$/,
];

for (const name of ["core", "cloudflare", "node", "bun", "nitro", "nuxt"]) {
  assert(existsSync(resolve(dist, `${name}.mjs`)), `Missing dist/images/${name}.mjs`);
  assert(existsSync(resolve(dist, `${name}.d.mts`)), `Missing dist/images/${name}.d.mts`);
}

for (const entry of ["cloudflare", "bun", "core"]) {
  const forbidden = bareImports(resolve(dist, `${entry}.mjs`)).filter((specifier) =>
    NODE_ONLY.some((pattern) => pattern.test(specifier)),
  );
  // Bun is allowed the filesystem layer's unstorage drivers, never sharp, ipx or a Node-only image module.
  const allowed =
    entry === "bun"
      ? forbidden.filter((specifier) => !specifier.startsWith("unstorage/drivers/") && !specifier.startsWith("node:"))
      : forbidden;
  assert(allowed.length === 0, `dist/images/${entry}.mjs reaches Node-only modules: ${allowed.join(", ")}`);
}
assert(bareImports(resolve(dist, "node.mjs")).includes("ipx"), "The Node entry should use ipx");
assert(!bareImports(resolve(dist, "bun.mjs")).includes("ipx"), "The Bun entry should use Bun.Image, not ipx");

const resolved = (conditions) =>
  execFileSync(
    process.execPath,
    [
      ...conditions.flatMap((condition) => ["--conditions", condition]),
      "--input-type=module",
      "-e",
      'process.stdout.write(import.meta.resolve("@chiballc/utils/images"))',
    ],
    { cwd: root, encoding: "utf8" },
  );
assert(resolved([]).endsWith("/dist/images/node.mjs"), "Node should resolve the node entry");
assert(resolved(["workerd"]).endsWith("/dist/images/cloudflare.mjs"), "workerd should resolve the cloudflare entry");
assert(resolved(["bun"]).endsWith("/dist/images/bun.mjs"), "bun should resolve the bun entry");

const exportsMap = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).exports["./images"];
assert(
  JSON.stringify(Object.keys(exportsMap)) === JSON.stringify(["workerd", "bun", "node", "default"]),
  "The ./images conditions must be ordered workerd, bun, node, default",
);
assert(exportsMap.default.default === "./dist/images/core.mjs", "Unknown targets should resolve the adapter-free core");

console.log("images entries validated");

/** Bare and relative imports of an entry, following its relative chunks. */
function bareImports(file, seen = new Set()) {
  if (seen.has(file)) return [];
  seen.add(file);
  const source = readFileSync(file, "utf8");
  const specifiers = [
    ...source.matchAll(
      /(?:^|[\s;])(?:import|export)\s*(?:[^'"]*?\sfrom\s*)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/gm,
    ),
  ].map((match) => match[1] ?? match[2]);
  return specifiers.flatMap((specifier) =>
    specifier.startsWith(".") ? bareImports(resolve(dirname(file), specifier), seen) : [specifier],
  );
}

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}
