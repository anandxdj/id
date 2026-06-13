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
