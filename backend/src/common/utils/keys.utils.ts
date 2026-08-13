import { Config } from '../config/config';

/**
 * Issuer identity.
 *
 * This file used to also own the signing key: one PEM, one `kid` read straight from
 * config, and a JWKS document built once at boot. That design cannot rotate — the
 * advertised `kid` is a deployment constant, so replacing the key either keeps a `kid`
 * that no longer identifies it or invalidates every token already in flight.
 *
 * The keyring now lives in `modules/oauth/signing-key.service.ts`, where it can be a
 * Mongo-backed collection with thumbprint identifiers, encrypted private keys, and a
 * retirement overlap window. What is left here is the one genuinely
 * configuration-shaped value.
 */

/** Issuer without a trailing slash. Baked into every token this server signs. */
export const getOidcIssuer = (): string => Config.oidc.issuer;
