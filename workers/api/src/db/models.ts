export interface UserRecord {
  id: string;
  email: string;
  email_normalized: string;
  password_hash: string;
  password_salt: string;
  password_algorithm: string;
  password_iterations: number;
  display_name: string;
  role: 'user' | 'admin';
  status: 'active' | 'disabled';
  locale: 'fa' | 'en';
  email_verified_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthSessionRecord {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface LoginAttemptRecord {
  ip_hash: string | null;
  email_hash: string | null;
  window_start: string;
  attempts: number;
}
