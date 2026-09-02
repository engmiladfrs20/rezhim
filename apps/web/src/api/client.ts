export const API_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV
    ? 'http://localhost:8787'
    : 'https://nutriai-api-production.rezhimvip.workers.dev');

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T = unknown>(
  path: string,
  options: { method?: ApiMethod; body?: unknown } = {},
): Promise<T> {
  const requestInit: RequestInit = {
    method: options.method ?? 'GET',
    credentials: 'include',
  };
  if (options.body !== undefined) {
    requestInit.headers = { 'Content-Type': 'application/json' };
    requestInit.body = JSON.stringify(options.body);
  }
  const response = await fetch(`${API_URL}${path}`, requestInit);

  const raw = await response.text();
  let payload: unknown = null;
  if (raw) {
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      payload = raw;
    }
  }

  if (!response.ok) {
    const payloadRecord = isRecord(payload) ? payload : undefined;
    const error = isRecord(payloadRecord?.error) ? payloadRecord.error : undefined;
    const message =
      typeof error?.message === 'string'
        ? error.message
        : `API request failed (${response.status})`;
    const code = typeof error?.code === 'string' ? error.code : undefined;
    throw new ApiClientError(message, response.status, code);
  }

  if (isRecord(payload) && 'data' in payload) return payload.data as T;
  return payload as T;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function formatJson(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
