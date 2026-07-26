import type { KibaoConfig, KibaoTestConfig } from "../types";

const warning = [
  "!!! KIBAO TEST FIXTURE ACTIVE !!!",
  "OpenBao loading is bypassed: no remote credentials or variables will be requested.",
  "Reason: NUXT_TEST=true and kibao.test.vars is configured.",
  "Injected values are synthetic and must never be used by a deployed application.",
].join(" ");

export function getTestVars(config: Partial<KibaoConfig["kibao"]>): KibaoTestConfig["vars"] | undefined {
  if (!config.test) {
    return undefined;
  }

  assertTestFixtureAllowed(config.test, false);
  return config.test.vars;
}

export function assertTestFixtureAllowed(test: KibaoTestConfig | undefined, showWarning = true) {
  if (!test) {
    return;
  }

  if (process.env.NUXT_TEST !== "true") {
    throw new Error(
      "KIBAO TEST FIXTURE REJECTED: kibao.test is configured, but NUXT_TEST is not true. " +
        "Remove the fixture or run it only through the test harness.",
    );
  }

  if (Object.keys(test.vars).length === 0) {
    throw new Error("KIBAO TEST FIXTURE REJECTED: kibao.test.vars must provide at least one access fixture.");
  }

  if (showWarning) {
    console.warn(warning);
  }
}
