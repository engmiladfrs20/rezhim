export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'DB_ERROR',
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ReadinessError extends DatabaseError {
  constructor(message: string) {
    super(message, 'DB_NOT_READY');
    this.name = 'ReadinessError';
  }
}
