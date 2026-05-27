import type { OneOf, Prettify, SmartString } from "@chiballc/types";
import { joinURL } from "ufo";
import { $fetch } from "ofetch";
import { consola } from "consola";

import { entries } from "@chiballc/utils";
import type { OpenBaoOptions } from "../types";
import { crawlVarsFromEnv, getEnvSereverURL, reconsileConfig, setEnv } from "./env";

const console = consola.withTag("kibao-utils");

export type KibaoAccess = "public" | "private";
export type Location = OneOf<
  [
    {
      app: string;
      environment: Environments;
    },
    { path: string },
  ]
>;
export type SecretFrom = {
  location: Location;
  baseURL: string;
};
export type KibaoCredentials = Prettify<OneOf<[KibaoRoleCredentials, KibaoTokenCredentials]> & SecretFrom>;
export interface KibaoRoleCredentials {
  bao: {
    role: {
      id: string;
    };
    secret: {
      id: string;
    };
  };
  /** @default 'root' */
  namespace?: string;
}
export type Environments = SmartString<"staging" | "development" | "production">;
export interface KibaoTokenCredentials {
  /** A token must begin with an attestation, then the token as a string */
  token: SmartString<`${typeof PUBLIC_TOKEN_ATTESTATION}${string}` | `${typeof PRIVATE_TOKEN_ATTESTATION}${string}`>;
  /** @default 'root' */
  namespace?: string;
}

type OpenBaoKV2Response = {
  data: {
    data: Record<string, string>;
    metadata?: unknown;
  };
};
export async function getSecrets(credentials: KibaoCredentials, access: SmartString<KibaoAccess> = "public") {
  const { headers } = await getKibaoHeaders(credentials);

  let cache: Record<string, string> | undefined = undefined;
  const vars = () => {
    if (cache) {
      return cache;
    }

    cache = crawlVarsFromEnv();
    return cache;
  };
  const app = (function () {
    return credentials.location.app || vars()[`NUXT_KIBAO_OPENBAO_${access.toUpperCase()}_LOCATION_APP`];
  })();

  const environment = (function () {
    return (
      credentials.location.environment || vars()[`NUXT_KIBAO_OPENBAO_${access.toUpperCase()}_LOCATION_ENVIRONMENT`]
    );
  })();

  const lit_path = (function () {
    return credentials.location.path || vars()[`NUXT_KIBAO_OPENBAO_${access.toUpperCase()}_LOCATION_PATH`];
  })();

  const path = lit_path ? lit_path : app && environment ? joinURL("v1", app, "data", environment, access) : null;

  if (!path) {
    throw new TypeError("getSecrets Unexpected arguments for getting bao variables", {
      cause: credentials,
    });
  }

  const response = await $fetch<OpenBaoKV2Response>(joinURL(credentials.baseURL, path), {
    headers,
  });

  return {
    vars: response.data.data,
    access,
  };
}

export interface KibaoLoginResponse {
  auth: { client_token: string };
}

export const KIBAO_DEFAULT_NAMESPACE = "root";
export async function getKibaoToken<T extends KibaoLoginResponse>(
  credentials: KibaoRoleCredentials & Pick<SecretFrom, "baseURL">,
) {
  const namespace = credentials.namespace || KIBAO_DEFAULT_NAMESPACE;
  const response = await $fetch<T>(joinURL(credentials.baseURL, "v1/auth/approle/login"), {
    body: {
      role_id: credentials.bao.role.id,
      secret_id: credentials.bao.secret.id,
    },
    headers: {
      "X-Vault-Namespace": namespace,
    },
    method: "POST",
  });

  return {
    token: response.auth.client_token,
    namespace,
  };
}

function clearAttestation(token: KibaoTokenCredentials["token"]) {
  if (token.startsWith(PUBLIC_TOKEN_ATTESTATION)) {
    return {
      type: "public" as const,
      token: token.slice(PUBLIC_TOKEN_ATTESTATION.length),
    };
  } else if (token.startsWith(PRIVATE_TOKEN_ATTESTATION)) {
    return {
      type: "private" as const,
      token: token.slice(PRIVATE_TOKEN_ATTESTATION.length),
    };
  } else {
    console.warn(
      "The token needs an attestation to determine whether the variables are exposed on the frontend or not. i.e. start with yes_this_ok_to_be_public_{token} or is_private_access_{token} it's currently set to private by default, but it's recommended to add the attestation for better security and clarity.",
    );
    return {
      type: "private" as const,
      token,
    };
  }
}

export const PUBLIC_TOKEN_ATTESTATION = "yes_this_ok_to_be_public_";
export const PRIVATE_TOKEN_ATTESTATION = "is_private_access_";
export async function getKibaoHeaders(credentials: KibaoCredentials) {
  const headers = new Headers();
  if (credentials.bao?.role?.id && credentials.bao?.secret?.id) {
    // eslint-disable-next-line no-var
    var { token, namespace } = await getKibaoToken(credentials);
  } else if (credentials.token) {
    // eslint-disable-next-line no-var
    var { token } = clearAttestation(credentials.token);
    // eslint-disable-next-line no-var
    var namespace = credentials.namespace || KIBAO_DEFAULT_NAMESPACE;
  } else {
    throw new TypeError(
      "It's expected your credentials have either (NUXT_KIBAO_OPENBAO_PRIVATE_BAO_ROLE_ID and NUXT_KIBAO_OPENBAO_PRIVATE_BAO_SECRET_ID) or a token",
      { cause: credentials },
    );
  }

  headers.set("X-Vault-Namespace", namespace);
  headers.set("X-Vault-Token", token);
  return { headers };
}

export async function autoEnv(access: SmartString<KibaoAccess> = "public") {
  const baoConfig = reconsileConfig(null, null);
  if (!baoConfig.baoServerURL) {
    throw new Error("Could not find openbao serverurl", {
      cause: baoConfig,
    });
  }

  const baoVars = await getSecrets(
    {
      baseURL: baoConfig.baoServerURL,
      location: baoConfig.openbao[access]?.location as Location,
      bao: baoConfig.openbao[access]?.bao as any,
      namespace: baoConfig.openbao[access]?.namespace,
      token: baoConfig.openbao[access]?.token as any,
    },
    access,
  );

  setEnv(baoVars);

  return baoVars;
}

export async function getAllVars(openbao: OpenBaoOptions) {
  const _vars: Partial<Record<keyof OpenBaoOptions, Record<string, string>>> = {};
  for (const [access, config] of entries(openbao)) {
    if (!config) {
      continue;
    }

    config.baseURL = getEnvSereverURL() || config.baseURL;
    if (!config.baseURL) {
      console.fatal("We could not determine the location of you openbao instance");
      continue;
    }

    const { vars } = await getSecrets(config, access);

    _vars[access] = vars;
  }

  return _vars;
}
