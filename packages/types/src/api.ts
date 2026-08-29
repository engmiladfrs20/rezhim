export type HealthStatus = 'ok' | 'degraded' | 'error';

export interface HealthCheckResponse {
  status: HealthStatus;
  service: string;
  version: string;
  timestamp: string;
}

export interface ReadinessCheckResponse {
  status: HealthStatus;
  service: string;
  database: 'connected' | 'disconnected';
  timestamp: string;
}

export interface SystemMetadata {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

export interface ApiResponse<T> {
  success: true;
  data: T;
  requestId?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code:
      | string
      | 'INITIALIZATION_FAILED'
      | 'MISSING_BINDING'
      | 'NOT_READY'
      | 'INTERNAL_ERROR'
      | 'VALIDATION_ERROR'
      | 'EMAIL_ALREADY_EXISTS'
      | 'INVALID_CREDENTIALS'
      | 'AUTHENTICATION_REQUIRED'
      | 'SESSION_EXPIRED'
      | 'ACCOUNT_DISABLED'
      | 'RATE_LIMITED'
      | 'FORBIDDEN'
      | 'USER_NOT_FOUND';
    message: string;
    details?: unknown;
  };
  requestId?: string;
}
