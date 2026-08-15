import { getOidcIssuer } from '../../common/utils/keys.utils';

/** Target stacks the config-prompt can tailor its wiring instructions to. */
export const PROMPT_STACKS = [
  'nextjs', 'express', 'python',
  'react', 'vue', 'angular',
  'react-native', 'flutter', 'ios', 'android',
] as const;
export type PromptStack = (typeof PROMPT_STACKS)[number];
export const isPromptStack = (s: unknown): s is PromptStack =>
  typeof s === 'string' && (PROMPT_STACKS as readonly string[]).includes(s);

/** The env var the relying party should store its secret under. */
export const SECRET_ENV = 'OIDC_CLIENT_SECRET';

interface ClientLike {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  tokenEndpointAuthMethod?: string;
}

const stackHint = (stack: PromptStack): string => {
  switch (stack) {
    case 'nextjs':
      return [
        'Target stack: **Next.js (App Router)**.',
        '- Use a server-side OIDC client (e.g. `openid-client`) or NextAuth with a generic OIDC provider.',
        '- Generate the PKCE `code_verifier`/`code_challenge` server-side; keep the verifier in an httpOnly cookie or server session.',
        '- Put the callback handler at the redirect URI route; exchange the code in a Route Handler (never client-side).',
      ].join('\n');
    case 'express':
      return [
        'Target stack: **Express (Node.js)**.',
        '- Use `openid-client` to discover config and drive the flow.',
        '- Store the PKCE verifier + `state` in the server session between `/login` and the callback.',
        '- Exchange the code in the callback route; validate the ID token against the JWKS from discovery.',
      ].join('\n');
    case 'python':
      return [
        'Target stack: **Python**.',
        '- Use `authlib` (Flask/FastAPI) or `requests` + manual PKCE.',
        '- Keep the PKCE verifier + `state` in the server session; exchange the code server-side.',
        '- Verify the ID token signature using the JWKS endpoint from discovery.',
      ].join('\n');
    case 'react':
      return [
        'Target stack: **React single-page application**.',
        '- Use an Authorization Code + PKCE browser OIDC library such as `oidc-client-ts`.',
        '- Keep tokens in memory where possible; do not ship or reference a client secret.',
        '- Handle the callback in a dedicated route and restore the pre-login route after validating `state`.',
      ].join('\n');
    case 'vue':
      return [
        'Target stack: **Vue single-page application**.',
        '- Use an Authorization Code + PKCE browser OIDC client integrated with the router.',
        '- Keep tokens in memory where possible; do not ship or reference a client secret.',
        '- Handle the callback before entering protected routes and validate `state`.',
      ].join('\n');
    case 'angular':
      return [
        'Target stack: **Angular single-page application**.',
        '- Use a maintained OIDC library configured for Authorization Code + PKCE.',
        '- Add the callback route to the router and protect private routes with a guard.',
        '- Keep tokens out of persistent storage where practical; never configure a client secret.',
      ].join('\n');
    case 'react-native':
      return [
        'Target stack: **React Native**.',
        '- Use the system browser through `react-native-app-auth` or Expo AuthSession; do not use an embedded WebView.',
        '- Configure the registered custom-scheme or universal-link callback in the native project.',
        '- Use Authorization Code + PKCE and secure OS storage for sensitive token material; no client secret.',
      ].join('\n');
    case 'flutter':
      return [
        'Target stack: **Flutter**.',
        '- Use `flutter_appauth` with the system browser, Authorization Code flow, and PKCE.',
        '- Register the callback scheme on Android and iOS and exactly match the redirect URI.',
        '- Store sensitive token material with platform secure storage; no client secret.',
      ].join('\n');
    case 'ios':
      return [
        'Target stack: **native iOS / Swift**.',
        '- Use `ASWebAuthenticationSession` through AppAuth-iOS; never use an embedded WebView.',
        '- Register the callback URL scheme or universal link in the app target.',
        '- Use Authorization Code + PKCE and Keychain for sensitive token material; no client secret.',
      ].join('\n');
    case 'android':
      return [
        'Target stack: **native Android / Kotlin**.',
        '- Use AppAuth for Android with a Custom Tab; never use an embedded WebView.',
        '- Register the callback intent filter and exactly match the redirect URI.',
        '- Use Authorization Code + PKCE and encrypted platform storage; no client secret.',
      ].join('\n');
  }
};

/**
 * Build a copy-paste prompt for an LLM coding agent to wire a relying party up to
 * this `id` OIDC provider. Confidential clients receive a placeholder rather than
 * embedding their real secret; public clients receive explicitly secret-free guidance.
 */
export const buildClientConfigPrompt = (
  client: ClientLike,
  opts: { stack?: PromptStack; scopes?: string } = {},
): string => {
  const stack = opts.stack && isPromptStack(opts.stack) ? opts.stack : 'nextjs';
  const scopes = opts.scopes ?? 'openid profile email';
  const issuer = getOidcIssuer();
  const discovery = `${issuer}/.well-known/openid-configuration`;
  const primaryRedirect = client.redirectUris[0] ?? 'http://localhost:3000/api/auth/callback';
  const publicClient = client.tokenEndpointAuthMethod === 'none';
  const credentialFact = publicClient
    ? '- **Client authentication:** public client (`none`) — there is no client secret.'
    : `- **client_secret:** store as the env var \`${SECRET_ENV}\` — use the placeholder \`{{CLIENT_SECRET}}\`; never hard-code the real value.`;
  const tokenExchange = publicClient
    ? '3. Exchange the code with the same PKCE `code_verifier` and `client_id`. Do not send or invent a client secret.'
    : `3. Exchange the code at the token endpoint with HTTP Basic auth (\`client_id\`:\`${SECRET_ENV}\`) or POST body credentials.`;
  const secretStorage = publicClient
    ? '6. Do not add a client secret to source, environment variables, or build configuration. This client is intentionally public.'
    : `6. Read \`${SECRET_ENV}\` from the environment; add it to \`.env.example\` (empty) and document it. Do not commit the real secret.`;
  const failureCases = publicClient
    ? 'Bad-PKCE and redirect-uri-mismatch cases fail closed.'
    : 'Wrong-secret, bad-PKCE, and redirect-uri-mismatch cases fail closed.';

  return `You are integrating this application with our internal **OpenID Connect provider ("id")** as a relying party. Configure standard **Authorization Code flow with PKCE (S256)** and verify it end-to-end.

## Provider facts
- **Issuer:** ${issuer}
- **Discovery:** ${discovery}
- **Authorization endpoint:** ${issuer}/oauth/authorize
- **Token endpoint:** ${issuer}/oauth/token
- **Userinfo endpoint:** ${issuer}/oauth/userinfo
- **JWKS:** ${issuer}/oauth/jwks
- **ID token signing alg:** RS256 (verify against JWKS)

## This client ("${client.clientName}")
- **client_id:** \`${client.clientId}\`
${credentialFact}
- **Registered redirect URIs:** ${client.redirectUris.map((u) => `\`${u}\``).join(', ')}
- **Primary redirect URI:** \`${primaryRedirect}\`
- **Scopes:** \`${scopes}\`

## Requirements
1. Prefer auto-configuration via the discovery document above rather than hard-coding endpoints.
2. Use Authorization Code + **PKCE S256**. Send \`state\` and a \`nonce\`; validate both on return.
${tokenExchange}
4. Validate the returned **id_token**: signature against JWKS, \`iss\` == issuer, \`aud\` == client_id, \`exp\` not passed, and \`nonce\` matches.
5. Call userinfo with the access token (\`Authorization: Bearer …\`) only if you need profile/email claims beyond the id_token.
${secretStorage}

## Stack guidance
${stackHint(stack)}

## Done when
- A user can click "Sign in", get redirected to ${issuer}/oauth/authorize, authenticate, and land back at the redirect URI signed in.
- The id_token signature + claims validate. ${failureCases}`;
};
