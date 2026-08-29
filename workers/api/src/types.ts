import type { CloudflareEnv } from '@nutriai/types';
import type { UserRecord, AuthSessionRecord } from './db/models';

export type AppEnv = {
  Bindings: CloudflareEnv;
  Variables: {
    requestId: string;
    user: UserRecord;
    session: AuthSessionRecord;
    tokenContext: 'cookie' | 'bearer';
  };
};
