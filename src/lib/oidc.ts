import * as oauth from "oauth4webapi";

const DEFAULT_ISSUER = "https://portal.calieo.xyz";

// Short-lived cookie holding the pending authorization transaction (state/PKCE/return_to)
// between the /start redirect and the /callback request.
export const OIDC_TXN_COOKIE_NAME = "oidc_txn";
export const OIDC_TXN_MAX_AGE_SECONDS = 5 * 60;

function getClient(): oauth.Client {
  const clientId = process.env.CALIEO_OIDC_CLIENT_ID;
  if (!clientId) throw new Error("CALIEO_OIDC_CLIENT_ID is not configured");
  return { client_id: clientId };
}

function getClientAuth(): oauth.ClientAuth {
  const clientSecret = process.env.CALIEO_OIDC_CLIENT_SECRET;
  if (!clientSecret) throw new Error("CALIEO_OIDC_CLIENT_SECRET is not configured");
  return oauth.ClientSecretPost(clientSecret);
}

function getRedirectUri(): string {
  const redirectUri = process.env.CALIEO_OIDC_REDIRECT_URI;
  if (!redirectUri) throw new Error("CALIEO_OIDC_REDIRECT_URI is not configured");
  return redirectUri;
}

function getIssuer(): URL {
  return new URL(process.env.CALIEO_OIDC_ISSUER || DEFAULT_ISSUER);
}

// Memoized across requests within the same Worker isolate / dev process;
// re-fetched automatically on the next call if discovery ever fails.
let discoveryPromise: Promise<oauth.AuthorizationServer> | undefined;

async function discoverAuthorizationServer(): Promise<oauth.AuthorizationServer> {
  if (!discoveryPromise) {
    const issuer = getIssuer();
    discoveryPromise = oauth
      .discoveryRequest(issuer)
      .then((response) => oauth.processDiscoveryResponse(issuer, response))
      .catch((error) => {
        discoveryPromise = undefined;
        throw error;
      });
  }
  return discoveryPromise;
}

export interface AuthorizationTransaction {
  state: string;
  codeVerifier: string;
  returnTo: string;
  lang: string;
}

export interface BuildAuthorizationRequestResult {
  url: string;
  txn: AuthorizationTransaction;
}

export async function buildAuthorizationRequest(params: {
  lang: string;
  returnTo: string;
}): Promise<BuildAuthorizationRequestResult> {
  const as = await discoverAuthorizationServer();
  if (!as.authorization_endpoint) {
    throw new Error("Calieo authorization_endpoint missing from discovery document");
  }

  const client = getClient();
  const state = oauth.generateRandomState();
  const codeVerifier = oauth.generateRandomCodeVerifier();
  const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);

  const url = new URL(as.authorization_endpoint);
  url.searchParams.set("client_id", client.client_id);
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return {
    url: url.toString(),
    txn: { state, codeVerifier, returnTo: params.returnTo, lang: params.lang },
  };
}

export type CallbackFailureReason = "state_mismatch" | "pkce_failure" | "token_invalid";

export type AuthorizationCallbackResult =
  | { ok: true; email: string; name: string | null }
  | { ok: false; reason: CallbackFailureReason };

export async function handleAuthorizationCallback(
  txn: AuthorizationTransaction,
  callbackParams: URLSearchParams
): Promise<AuthorizationCallbackResult> {
  const as = await discoverAuthorizationServer();
  const client = getClient();

  let validatedParams: URLSearchParams;
  try {
    validatedParams = oauth.validateAuthResponse(as, client, callbackParams, txn.state);
  } catch {
    // Either the IdP declared an error= response or the state parameter did not match;
    // both are treated as a state/authorization validation failure here.
    return { ok: false, reason: "state_mismatch" };
  }

  let tokenResponse: oauth.TokenEndpointResponse;
  try {
    const response = await oauth.authorizationCodeGrantRequest(
      as,
      client,
      getClientAuth(),
      validatedParams,
      getRedirectUri(),
      txn.codeVerifier
    );
    tokenResponse = await oauth.processAuthorizationCodeResponse(as, client, response, {
      expectedNonce: oauth.expectNoNonce,
      requireIdToken: true,
    });
  } catch (error) {
    // `invalid_grant` is the token endpoint's standard rejection for a bad/mismatched
    // PKCE code_verifier (or an already-used/expired code); anything else is a more
    // generic token exchange/validation failure.
    if (error instanceof oauth.ResponseBodyError && error.error === "invalid_grant") {
      return { ok: false, reason: "pkce_failure" };
    }
    return { ok: false, reason: "token_invalid" };
  }

  const claims = oauth.getValidatedIdTokenClaims(tokenResponse);
  if (!claims) {
    return { ok: false, reason: "token_invalid" };
  }

  let email = typeof claims.email === "string" ? claims.email : undefined;
  let name = typeof claims.name === "string" ? claims.name : undefined;

  // Some providers omit `email`/`name` from the ID Token; fall back to the userinfo endpoint.
  if (!email) {
    try {
      const userinfoResponse = await oauth.userInfoRequest(as, client, tokenResponse.access_token);
      const userinfo = await oauth.processUserInfoResponse(as, client, claims.sub, userinfoResponse);
      email = typeof userinfo.email === "string" ? userinfo.email : undefined;
      name = name ?? (typeof userinfo.name === "string" ? userinfo.name : undefined);
    } catch {
      return { ok: false, reason: "token_invalid" };
    }
  }

  if (!email) {
    return { ok: false, reason: "token_invalid" };
  }

  return { ok: true, email, name: name ?? null };
}
