import type { Request, Response } from 'express';
import { getJwksDocument, getOidcIssuer } from '../../common/utils/keys.utils';

export const getOpenIdConfiguration = (_req: Request, res: Response) => {
  const iss = getOidcIssuer();
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({
    issuer: iss,
    authorization_endpoint: `${iss}/oauth/authorize`,
    token_endpoint: `${iss}/oauth/token`,
    userinfo_endpoint: `${iss}/oauth/userinfo`,
    jwks_uri: `${iss}/oauth/jwks`,
    scopes_supported: ['openid', 'profile', 'email'],
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'nonce', 'email', 'email_verified', 'name'],
  });
};

export const getJwks = (_req: Request, res: Response) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(getJwksDocument());
};
