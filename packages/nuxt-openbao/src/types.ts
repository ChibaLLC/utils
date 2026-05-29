import type { Prettify, SmartString } from "@chiballc/types";
import type { KibaoAccess, KibaoCredentials } from "./runtime/utils";

export type OpenBaoOptions = Prettify<Partial<Record<SmartString<KibaoAccess>, KibaoCredentials>>>;

export interface KibaoVars {
  [key: string]: string;
}

export interface KibaoConfig {
  kibao: {
    /** @default false */
    disabled?: boolean;
    openbao: OpenBaoOptions;
    vars?: KibaoVars;
    server?: {
      bao?: string,
      /** The server URL */
      base?: string
    }
  };
}
