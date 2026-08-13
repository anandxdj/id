import mongoose from 'mongoose';
import type { Document, Model } from 'mongoose';
import {
  CLIENT_DEFAULTS,
  COLLECTIONS,
  SUPPORTED_GRANT_TYPES,
  SUPPORTED_RESPONSE_TYPES,
  SUPPORTED_TOKEN_ENDPOINT_AUTH_METHODS,
  TOKEN_ENDPOINT_AUTH_METHODS,
} from '../../common/constants/index.constants';

/**
 * A registered relying party.
 *
 * Everything below `logoUrl` is M4 protocol metadata. Without it a client is a name and
 * a list of redirect URIs, which has two consequences: there is no per-client policy to
 * enforce (so any registered client can ask for any scope this server supports), and
 * confidential-client authentication is the only mode there is — locking out SPAs and
 * native apps despite PKCE being mandatory here, which is precisely the case public
 * clients exist for.
 *
 * `redirectUris`, `allowedOrigins` and `postLogoutRedirectUris` stay embedded arrays
 * rather than separate collections (plan §4.3): that single decision is what keeps
 * every OAuth write a single-document operation with no transaction anywhere.
 */
export interface IOAuthClient extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: string;
  /** Absent for public clients, which authenticate with `none` + mandatory PKCE. */
  clientSecretHash?: string;
  clientName: string;
  redirectUris: string[];
  description: string;
  logoUrl: string;

  // ── Protocol metadata (M4) ─────────────────────────────────────────────────
  /**
   * Scope allowlist. A request naming a scope outside it is **rejected** with
   * `invalid_scope`, not quietly trimmed: silently narrowing leaves the client
   * believing it holds a permission it does not, and the failure then surfaces
   * somewhere far away from its cause.
   */
  scopes: string[];
  grantTypes: string[];
  responseTypes: string[];
  /** How this client proves its identity at /token. `none` marks it public. */
  tokenEndpointAuthMethod: string;
  /** Exact-match allowlist for RP-initiated logout. No wildcards, ever. */
  postLogoutRedirectUris: string[];

  suspended: boolean;
  suspendedReason?: string;
  suspendedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const oauthClientSchema = new mongoose.Schema<IOAuthClient>(
  {
    clientId: { type: String, required: true, unique: true, index: true },
    /**
     * Conditionally required: a public client has no secret to store, and demanding a
     * hash for one would mean generating a credential that must never be used.
     */
    clientSecretHash: {
      type: String,
      select: false,
      required(this: IOAuthClient) {
        return this.tokenEndpointAuthMethod !== TOKEN_ENDPOINT_AUTH_METHODS.NONE;
      },
    },
    clientName: { type: String, required: true, trim: true, maxlength: 120 },
    redirectUris: {
      type: [String],
      required: true,
      validate: [(v: string[]) => Array.isArray(v) && v.length > 0, 'At least one redirect URI'],
    },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    logoUrl: { type: String, trim: true, maxlength: 2048, default: '' },

    scopes: { type: [String], default: () => [...CLIENT_DEFAULTS.SCOPES] },
    grantTypes: {
      type: [String],
      enum: SUPPORTED_GRANT_TYPES,
      default: () => [...CLIENT_DEFAULTS.GRANT_TYPES],
    },
    responseTypes: {
      type: [String],
      enum: SUPPORTED_RESPONSE_TYPES,
      default: () => [...CLIENT_DEFAULTS.RESPONSE_TYPES],
    },
    tokenEndpointAuthMethod: {
      type: String,
      enum: SUPPORTED_TOKEN_ENDPOINT_AUTH_METHODS,
      default: CLIENT_DEFAULTS.TOKEN_ENDPOINT_AUTH_METHOD,
    },
    postLogoutRedirectUris: { type: [String], default: [] },

    suspended: { type: Boolean, default: false, index: true },
    suspendedReason: { type: String, maxlength: 500 },
    suspendedAt: { type: Date },
  },
  { timestamps: true },
);

export const OAuthClient: Model<IOAuthClient> =
  (mongoose.models[COLLECTIONS.OAUTH_CLIENT] as Model<IOAuthClient>) ||
  mongoose.model<IOAuthClient>(COLLECTIONS.OAUTH_CLIENT, oauthClientSchema);

export default OAuthClient;
