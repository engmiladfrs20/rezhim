export interface PublicUser {
  id: string;
  email: string;
  display_name: string;
  role: 'user' | 'admin';
  status: 'active' | 'disabled';
  locale: 'fa' | 'en';
  email_verified_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}
