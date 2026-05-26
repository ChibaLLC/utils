import type { Prettify, SmartString } from "@chiballc/types";
import type { KibaoAccess, KibaoCredentials, Location } from "./runtime/utils";

export type OpenBaoOptionsConfig = Omit<KibaoCredentials, "location"> & {
  location: Location;
};

export type OpenBaoOptions = Prettify<Partial<Record<SmartString<KibaoAccess>, OpenBaoOptionsConfig>>>;

export interface KibaoVars {
  [key: string]: string;
}

export interface KibaoConfig {
  kibao: {
    /** @default false */
    disabled?: boolean;
    openbao: OpenBaoOptions;
    vars?: KibaoVars;
    baoServerURL?: string;
    serverURL?: string;
  };
}
