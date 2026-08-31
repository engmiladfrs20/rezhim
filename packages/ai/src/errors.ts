export class AiError extends Error {
  constructor(
    message: string,
    public readonly code: 'AI_UNAVAILABLE' | 'AI_PROVIDER_ERROR',
  ) {
    super(message);
    this.name = 'AiError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AiUnavailableError extends AiError {
  constructor(message = 'AI provider is not configured.') {
    super(message, 'AI_UNAVAILABLE');
    this.name = 'AiUnavailableError';
  }
}

export class AiProviderError extends AiError {
  constructor(message = 'AI provider request failed.') {
    super(message, 'AI_PROVIDER_ERROR');
    this.name = 'AiProviderError';
  }
}
