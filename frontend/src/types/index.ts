// Mirrors the backend auth.service PublicUser shape — keep in sync.

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'superadmin';
  isVerified: boolean;
  profilePictureUrl?: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ConsentContext {
  transaction_id: string;
  client_id: string;
  client_name: string;
  description: string;
  logo_url: string;
  scope: string;
  client_suspended: boolean;
}

// ── User dashboard (mirrors /api/me responses) ────────────────────────────────
export interface AuthorizedApp {
  clientId: string;
  clientName: string;
  logoUrl: string;
  description: string;
  scope: string;
  authorizedAt: string;
  lastUsedAt: string | null;
}

export interface SessionView {
  sid: string;
  ua?: string;
  ip?: string;
  createdAt: number;
  lastSeenAt: number;
  current: boolean;
  expiresInSeconds: number;
}

export interface ProfileData {
  id: string;
  name: string;
  email: string;
  role: User['role'];
  isVerified: boolean;
  profilePictureUrl: string;
  bio: string;
  jobTitle: string;
  company: string;
  country: string;
}

export type AdminAccessRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AdminAccessRequest {
  id: string;
  userId: string;
  justification: string;
  status: AdminAccessRequestStatus;
  decidedBy: string | null;
  decisionNote: string;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAccessQueueRequest extends Omit<AdminAccessRequest, 'userId' | 'decidedBy'> {
  requester: {
    id: string;
    name: string;
    email: string;
    role: User['role'];
    disabled: boolean;
    deleted: boolean;
  } | null;
  decidedBy: { id: string; name: string; email: string } | null;
}

// ── Admin panel (mirrors /api/admin responses) ────────────────────────────────
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: User['role'];
  isVerified: boolean;
  disabled: boolean;
  disabledReason: string;
  disabledAt: string | null;
  createdAt: string;
}

export interface AdminClient {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  description: string;
  logoUrl: string;
  suspended: boolean;
  suspendedReason: string;
  createdAt: string;
  scopes?: string[];
  grantTypes?: string[];
  responseTypes?: string[];
  tokenEndpointAuthMethod?: 'client_secret_basic' | 'client_secret_post' | 'none' | string;
  postLogoutRedirectUris?: string[];
  clientType?: string;
}

export interface ActivityEvent {
  _id: string;
  type: string;
  actorUserId?: string;
  actorRole?: string;
  clientId?: string;
  targetUserId?: string;
  ip?: string;
  ua?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface AdminMetrics {
  totalUsers: number;
  disabledUsers: number;
  activeUsers7d: number;
  logins24h: number;
  totalClients: number;
  suspendedClients: number;
}

export interface CreatedClient {
  clientId: string;
  clientSecret?: string;
  clientName: string;
  redirectUris: string[];
  configPrompt: string;
  tokenEndpointAuthMethod: string;
}

export interface AdminUserDetail {
  user: AdminUser;
  sessions: SessionView[];
  apps: AuthorizedApp[];
  activity: ActivityEvent[];
}

export interface AdminClientAuthorizedUser {
  userId: string;
  name: string;
  email: string;
  role?: string;
  profilePictureUrl?: string;
  scope: string;
  authorizedAt: string;
  lastUsedAt: string | null;
}

export interface AdminClientMetrics {
  totalAuthorizedUsers: number;
  activeUsers24h: number;
  activeUsers7d: number;
}

export interface AdminClientDetail {
  client: AdminClient;
  metrics: AdminClientMetrics;
  authorizedUsers: AdminClientAuthorizedUser[];
  activity: ActivityEvent[];
  configPrompt: string;
}
