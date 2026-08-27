import { ObjectKeySchema } from '@nutriai/schemas';
import { InvalidStorageKeyError } from './errors';

interface SchemaIssue {
  message: string;
  path?: (string | number)[];
}

export function normalizeAndValidateKey(rawKey: string): string {
  if (!rawKey || typeof rawKey !== 'string') {
    throw new InvalidStorageKeyError(String(rawKey), 'Key must be a non-empty string');
  }

  const trimmed = rawKey.trim().replace(/^\/+/, '');
  const parseResult = ObjectKeySchema.safeParse(trimmed);

  if (!parseResult.success) {
    const errorObj = parseResult.error as unknown as {
      issues?: SchemaIssue[];
      errors?: SchemaIssue[];
      message: string;
    };
    const issues = errorObj.issues ?? errorObj.errors ?? [];
    const errorMsg = issues[0]?.message ?? errorObj.message ?? 'Failed key schema validation';
    throw new InvalidStorageKeyError(rawKey, errorMsg);
  }

  return trimmed;
}

export async function convertBodyToUint8Array(
  data: Uint8Array | ArrayBuffer | Blob | ReadableStream | ArrayBufferView,
): Promise<Uint8Array> {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    const buffer = await data.arrayBuffer();
    return new Uint8Array(buffer);
  }
  if (
    data &&
    typeof data === 'object' &&
    typeof (data as { getReader?: unknown }).getReader === 'function'
  ) {
    const reader = (data as ReadableStream<Uint8Array>).getReader();
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        totalLength += value.byteLength;
      }
    }

    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return merged;
  }

  if (
    data &&
    typeof data === 'object' &&
    'length' in data &&
    typeof (data as { length: number }).length === 'number'
  ) {
    return new Uint8Array(data as unknown as ArrayLike<number>);
  }

  throw new Error('Unsupported storage data format');
}
