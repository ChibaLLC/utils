import type { ImagesTarget } from "./types";

const EDGE_PRESET = /(^|[-_])(edge|deno|netlify-edge|vercel-edge)([-_]|$)|^deno/;

/**
 * Maps a Nitro preset to the image adapter its build should bundle: Cloudflare presets get the Images binding, Bun gets
 * `Bun.Image`, Node-family presets get `ipx`. Edge runtimes with no adapter are refused rather than bundling sharp.
 */
export function resolveImagesTarget(preset: string | undefined): ImagesTarget {
  const normalized = (preset ?? "").trim().toLowerCase().replace(/_/g, "-");
  if (normalized.startsWith("cloudflare")) return "cloudflare";
  if (normalized === "bun") return "bun";
  if (EDGE_PRESET.test(normalized)) {
    throw new Error(`No image adapter exists for the "${preset}" preset; set the target explicitly`);
  }
  return "node";
}

/** The import path of the target entry a build should alias. */
export function imagesEntry(target: ImagesTarget): `@chiballc/utils/images/${ImagesTarget}` {
  return `@chiballc/utils/images/${target}`;
}
