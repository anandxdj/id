import { getOidcIssuer } from '../../common/utils/keys.utils';

/** Target stacks the config-prompt can tailor its wiring instructions to. */
export const PROMPT_STACKS = ['nextjs', 'express', 'python'] as const;
export type PromptStack = (typeof PROMPT_STACKS)[number];
export const isPromptStack = (s: unknown): s is PromptStack =>
  typeof s === 'string' && (PROMPT_STACKS as readonly string[]).includes(s);

/** The env var the relying party should store its secret under. */
export const SECRET_ENV = 'OIDC_CLIENT_SECRET';

interface ClientLike {
  clientId: string;
  clientName: string;
  redirectUris: string[];
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
  }
};

/**
 * Build a copy-paste prompt for an LLM coding agent to wire a relying party up to
 * this `id` OIDC provider. The real client secret is NEVER embedded — the prompt
 * carries a `{{CLIENT_SECRET}}` placeholder and instructs storing the secret in an
 * env var, which the operator pastes separately from the one-time reveal.
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
- **client_secret:** store as the env var \`${SECRET_ENV}\` — use the placeholder \`{{CLIENT_SECRET}}\` in code/config; never hard-code the real value.
- **Registered redirect URIs:** ${client.redirectUris.map((u) => `\`${u}\``).join(', ')}
- **Primary redirect URI:** \`${primaryRedirect}\`
- **Scopes:** \`${scopes}\`

## Requirements
1. Prefer auto-configuration via the discovery document above rather than hard-coding endpoints.
2. Use Authorization Code + **PKCE S256**. Send \`state\` and a \`nonce\`; validate both on return.
3. Exchange the code at the token endpoint with HTTP Basic auth (\`client_id\`:\`${SECRET_ENV}\`) or POST body credentials.
4. Validate the returned **id_token**: signature against JWKS, \`iss\` == issuer, \`aud\` == client_id, \`exp\` not passed, and \`nonce\` matches.
5. Call userinfo with the access token (\`Authorization: Bearer …\`) only if you need profile/email claims beyond the id_token.
6. Read \`${SECRET_ENV}\` from the environment; add it to \`.env.example\` (empty) and document it. Do not commit the real secret.

## Stack guidance
${stackHint(stack)}

## Done when
- A user can click "Sign in", get redirected to ${issuer}/oauth/authorize, authenticate, and land back at the redirect URI signed in.
- The id_token signature + claims validate. Wrong-secret, bad-PKCE, and redirect-uri-mismatch cases fail closed.`;
};
