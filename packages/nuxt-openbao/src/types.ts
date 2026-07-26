import type { Prettify, SmartString } from "@chiballc/types";
import type { KibaoAccess, KibaoCredentials } from "./runtime/utils";

export type OpenBaoOptions = Prettify<Partial<Record<SmartString<KibaoAccess>, KibaoCredentials>>>;

export interface KibaoVars {
  [key: string]: string;
}

export interface KibaoTestConfig {
  vars: Partial<Record<KibaoAccess, KibaoVars>>;
}

export interface KibaoConfig {
  kibao: {
    /** @default false */
    disabled?: boolean;
    /** @default false */
    serverOnly?: boolean;
    openbao: OpenBaoOptions;
    vars?: KibaoVars;
    test?: KibaoTestConfig;
    server?: {
      bao?: string,
      /** The server URL */
      base?: string
    }
  };
}
