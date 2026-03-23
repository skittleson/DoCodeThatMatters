---
title: "I tried to do OAuth token exchange with Authentik. Here is the security tradeoff nobody mentions."
keywords:
  - oauth
  - token exchange
  - keycloak
  - authentik
  - RFC 8693
  - OIDC
  - SSO
  - identity
date: 2026-03-23
description: Authentik does not support RFC 8693 token exchange. The workaround works, but it shifts a security assumption most people never notice. Here is what I found and how it compares to Keycloak.
image: /images/oauth-token-exchange-network.jpg
alt: City lights connected across a global network like services passing identity tokens between each other
draft: false
---

I was building a service that needed to call another internal API on behalf of a logged-in user. Standard microservice problem. I had Authentik running already so I went looking for [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693) token exchange support. It is not there for Authentik. Instead is [JWT authentication](https://docs.goauthentik.io/add-secure-apps/providers/oauth2/machine_to_machine/#jwt-authentication) which is a legitimate M2M pattern but has a trust assumption baked in that is easy to miss until something goes wrong.

I built a [demo repo](https://github.com/skittleson/IdentityExchangeAppsDemo) that runs both approaches side by side - Keycloak with native [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693), and Authentik with the JWT federation workaround - so you can see exactly where they diverge.

## The Use Case

```
User logs into App A
  └─ App A wants to show: how many todos does this user have in App B?
       └─ App A calls App B /api/todos/count -- server to server
            └─ App B needs to know: who is this request for?
```

App A cannot just forward the user's token. It has `aud: app-a`. App B will reject it. You cannot mint a new token yourself - that defeats the whole point of a trusted identity provider.

You need the IdP to issue a new token for App B, carrying the original user's `sub`.

## Option A - Authentik (JWT Authentication)

Authentik does not implement [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693). What it does offer is [JWT authentication](https://docs.goauthentik.io/add-secure-apps/providers/oauth2/machine_to_machine/#jwt-authentication) ([RFC 7523](https://datatracker.ietf.org/doc/html/rfc7523) client assertion), which lets one service prove it is who it says it is using a signed JWT as the `client_assertion`.

App A posts to the token endpoint using `client_credentials` with the user's access token as the assertion ([app-a/server.js#L212-L217](https://github.com/skittleson/IdentityExchangeAppsDemo/blob/main/app-a/server.js#L212-L217)):

```js
const params = new URLSearchParams({
  grant_type: 'client_credentials',
  client_id: APP_B_CLIENT_ID,
  client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
  client_assertion: accessToken,
  scope: 'openid profile email on_behalf_of_sub',
});
```

Authentik verifies App A's token comes from a trusted federated provider, then issues a new token with `aud: app-b`.

**The problem:** the issued token's `sub` is not the user. It is a service account - something like `ak-App-A-Provider-client_credentials`. Authentik has no mechanism in this grant path to forward the original user's identity into the token.

So App A passes the user identity separately when calling App B ([app-a/server.js#L209-L217](https://github.com/skittleson/IdentityExchangeAppsDemo/blob/main/app-a/server.js#L209-L217)):

```js
const countRes = await fetch(`${APP_B_INTERNAL_URL}/api/todos/count`, {
  headers: {
    'Authorization': `Bearer ${exchangedToken}`,
    'X-User-Sub': req.user.sub,  // user identity sent out-of-band
  },
});
```

App B trusts `X-User-Sub` because the bearer token proves the caller is App A's server. **That trust is implicit, not cryptographic.** A bug or compromise in App A could cause App B to return another user's data. The user identity is not bound to the token - it is just a header anyone with App A's credentials could fabricate.

**The concrete risk:** if App A is ever compromised (a dependency vulnerability, a leaked secret, a misconfigured env var) an attacker can call App B as any user in the system. The IdP has no knowledge of who the request is "for." App A decides that, and App B trusts it. With the Keycloak path, the IdP is the one asserting the user's identity in the token. App A cannot forge that claim even if it is fully compromised.

<details>
<summary>See it running with Authentik</summary>

<img src="https://raw.githubusercontent.com/skittleson/IdentityExchangeAppsDemo/main/demo/demo-authentik.gif" alt="Authentik demo: login, SSO into App B, todo count appears in App A with orange workaround badge" loading="lazy" />

</details>

## Option B - Keycloak (RFC 8693)

Keycloak has supported [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693) token exchange natively since version 12. The grant type is `urn:ietf:params:oauth:grant-type:token-exchange`.

App A posts the user's access token as the `subject_token` and asks for a new one scoped to App B ([app-a/server.js#L168-L185](https://github.com/skittleson/IdentityExchangeAppsDemo/blob/main/app-a/server.js#L168-L185)):

```js
const params = new URLSearchParams({
  grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET,
  subject_token: accessToken,
  subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
  audience: APP_B_CLIENT_ID,
  requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
});
```

Keycloak validates the `subject_token`, checks the exchange policy, and issues a new token with:

- `aud: app-b`
- `sub: <original user sub>` (**the real user, not a service account**)
- `azp: app-a` - records who performed the exchange

With the user's `sub` already in the token, App A calls App B with no extra header ([app-a/server.js#L188-L196](https://github.com/skittleson/IdentityExchangeAppsDemo/blob/main/app-a/server.js#L188-L196)):

```js
const countRes = await fetch(`${APP_B_INTERNAL_URL}/api/todos/count`, {
  headers: { 'Authorization': `Bearer ${exchangedToken}` },
  // no X-User-Sub needed -- sub is in the token itself
});
```

App B validates the token's audience and reads `sub` directly from it. No extra header. No implicit trust. The user identity is cryptographically bound.

<details>
<summary>See it running with Keycloak</summary>

<img src="https://raw.githubusercontent.com/skittleson/IdentityExchangeAppsDemo/main/demo/demo-keycloak.gif" alt="Keycloak demo: login, SSO into App B, todo count appears in App A with green RFC 8693 compliant badge" loading="lazy" />

</details>

## On the App B Side

App B enforces a strict audience check on every service-to-service call via `requireServiceAuth` ([app-b/server.js#L88-L102](https://github.com/skittleson/IdentityExchangeAppsDemo/blob/main/app-b/server.js#L88-L102)):

```js
const { payload } = await jwtVerify(token, JWKS, {
  issuer: discoveredIssuer,
  audience: process.env.CLIENT_ID,  // rejects any token not scoped to app-b
});
```

Then the `/api/todos/count` handler branches on `IDP_TYPE` to get the user identity from the right place ([app-b/server.js#L162-L175](https://github.com/skittleson/IdentityExchangeAppsDemo/blob/main/app-b/server.js#L162-L175)):

```js
if (IDP_TYPE === 'keycloak') {
  onBehalfOf = req.user.sub;         // sub is in the validated token
} else {
  onBehalfOf = req.headers['x-user-sub'];  // trusted only because aud check passed
}
```

This is where the security models visibly diverge. Keycloak: identity comes from the token. Authentik: identity comes from a header App A set.

## The Key Difference

| IdP       | Method                        | RFC 8693 | `sub` in token  |
|-----------|-------------------------------|----------|-----------------|
| Authentik | [JWT Authentication](https://docs.goauthentik.io/add-secure-apps/providers/oauth2/machine_to_machine/#jwt-authentication) ([RFC 7523](https://datatracker.ietf.org/doc/html/rfc7523))     | No       | Service account |
| Keycloak  | Native token exchange ([RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693))         | Yes      | Original user   |

With Authentik, you are trusting App A to tell the truth about who the user is. With Keycloak, the IdP is the one asserting it and App B can verify that independently.

## Running It

Clone the repo, copy the env file, pick a stack:

```sh
git clone https://github.com/skittleson/IdentityExchangeAppsDemo
cd IdentityExchangeAppsDemo
cp .env.example .env

# Keycloak (RFC 8693)
docker compose -f docker-compose.keycloak.yml up -d
```

Add these to `/etc/hosts` first (both stacks use port 9000):

```
127.0.0.1 authentik
127.0.0.1 keycloak
```

Wait ~30 seconds for Keycloak to initialize. Then:

- App A: http://localhost:3993 (login here)
- App B: http://localhost:3994 (add todos)
- Keycloak admin: http://keycloak:9090

Credentials: `demo` / `changeme` for app login, `admin` / `changeme` for Keycloak.

Log in to App A, open App B in a new tab (SSO kicks in automatically), add a few todos, go back to App A. The todo count shows up. The **Token Exchange Info** card on App A shows which method was used and whether it is RFC compliant.

## Takeaways

- **Keycloak just works for RFC 8693.** The setup script ([`setup-keycloak.js`](https://github.com/skittleson/IdentityExchangeAppsDemo/blob/main/setup-keycloak.js)) automates the token exchange permission policy so you can see the full flow without manual admin steps.
- **Authentik's [JWT authentication](https://docs.goauthentik.io/add-secure-apps/providers/oauth2/machine_to_machine/#jwt-authentication) is a legitimate M2M pattern.** But when the goal is passing a user's identity downstream, the `sub` in the issued token is a service account, not the user. That gap is what forces the `X-User-Sub` header and shifts the trust to App A.
- **The `azp` claim matters.** In the Keycloak response, `azp: app-a` records which service performed the exchange. App B can use that to enforce policies about which services are allowed to act on behalf of users.
- **`aud` validation is not optional.** Both options enforce strict audience checking on App B. Skip it and any token from the same IdP gets through, which defeats the whole point.

## References

- [RFC 8693 - OAuth 2.0 Token Exchange](https://datatracker.ietf.org/doc/html/rfc8693)
- [RFC 7523 - JWT Profile for Client Authentication](https://datatracker.ietf.org/doc/html/rfc7523)
- [Keycloak Token Exchange docs](https://www.keycloak.org/docs/latest/securing_apps/#_token-exchange)
- [Authentik JWT Authentication docs](https://docs.goauthentik.io/add-secure-apps/providers/oauth2/machine_to_machine/#jwt-authentication)
- [Demo repo - skittleson/IdentityExchangeAppsDemo](https://github.com/skittleson/IdentityExchangeAppsDemo)

<!--
HN SUBMISSION -- copy/paste when posting

TITLE:
I tried to do OAuth token exchange with Authentik. Here is the security tradeoff nobody mentions.

SHOW HN COMMENT BODY:
I was wiring up two OIDC apps to share a user's identity server to server and discovered that Authentik (which I was already running) does not implement RFC 8693 token exchange at all. The workaround it offers (JWT federation + an X-User-Sub header) works, but it shifts trust to the calling service: a compromised App A can claim to be any user when calling App B. With Keycloak's native RFC 8693 support, the IdP asserts the user's identity in the token itself, so App A cannot forge that even if it is fully compromised. I built a Docker demo that runs both side by side so you can see exactly where the security models diverge. Curious if others have hit this and what they ended up choosing.
-->
