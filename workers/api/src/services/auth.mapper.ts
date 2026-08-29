import type { PublicUser } from '@nutriai/types';
import type { UserRecord } from '../db/models';

export function toPublicUser(record: UserRecord): PublicUser {
  return {
    id: record.id,
    email: record.email,
    display_name: record.display_name,
    role: record.role,
    status: record.status,
    locale: record.locale,
    email_verified_at: record.email_verified_at,
    last_login_at: record.last_login_at,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}
