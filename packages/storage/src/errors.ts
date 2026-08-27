export class StorageError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = 'STORAGE_ERROR', statusCode = 500) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

export class ObjectNotFoundError extends StorageError {
  constructor(key: string) {
    super(`Storage object '${key}' was not found.`, 'OBJECT_NOT_FOUND', 404);
    this.name = 'ObjectNotFoundError';
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class InvalidStorageKeyError extends StorageError {
  constructor(key: string, reason?: string) {
    super(
      `Invalid storage key '${key}'${reason ? `: ${reason}` : '.'}`,
      'INVALID_STORAGE_KEY',
      400,
    );
    this.name = 'InvalidStorageKeyError';
    Object.setPrototypeOf(this, InvalidStorageKeyError.prototype);
  }
}

export class StorageConfigError extends StorageError {
  constructor(message: string) {
    super(message, 'STORAGE_CONFIG_ERROR', 500);
    this.name = 'StorageConfigError';
    Object.setPrototypeOf(this, StorageConfigError.prototype);
  }
}
