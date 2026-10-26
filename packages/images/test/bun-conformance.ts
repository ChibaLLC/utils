/**
 * Runs the shared conformance cases under Bun: the Bun.Image adapter the `bun` export condition selects, and the ipx
 * adapter to prove it also works under Bun. `pnpm test:images:bun` (requires Bun 1.4 or later).
 */
import { createBunImageTransformer } from "../src/adapters/bun";
import { createIpxImageTransformer } from "../src/adapters/ipx";
import { conformanceCases } from "./conformance";
import { createFixtures } from "./fixtures";

const fixtures = await createFixtures();
const adapters = {
  "bun (Bun.Image)": conformanceCases((limits) => createBunImageTransformer(limits ? { limits } : {}), fixtures),
  "ipx under bun": conformanceCases((limits) => createIpxImageTransformer(limits ? { limits } : {}), fixtures),
};

let failures = 0;
for (const [adapter, cases] of Object.entries(adapters)) {
  for (const entry of cases) {
    try {
      await entry.run();
      console.log(`ok   ${adapter} > ${entry.name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${adapter} > ${entry.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
const { version } = (globalThis as unknown as { Bun: { version: string } }).Bun;
console.log(`${failures === 0 ? "passed" : "failed"} under Bun ${version}`);
process.exit(failures === 0 ? 0 : 1);
