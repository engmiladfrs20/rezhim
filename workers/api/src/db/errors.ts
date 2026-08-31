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

export class FoodNotFoundError extends Error {
  constructor(message: string = 'Food item not found') {
    super(message);
    this.name = 'FoodNotFoundError';
  }
}

export class FoodConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FoodConflictError';
  }
}

export class FoodValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FoodValidationError';
  }
}

export class DiaryEntryNotFoundError extends Error {
  constructor(message: string = 'Food diary entry not found') {
    super(message);
    this.name = 'DiaryEntryNotFoundError';
  }
}

export class PantryItemNotFoundError extends Error {
  constructor() {
    super('Pantry item not found.');
    this.name = 'PantryItemNotFoundError';
  }
}

export class ShoppingListItemNotFoundError extends Error {
  constructor() {
    super('Shopping list item not found.');
    this.name = 'ShoppingListItemNotFoundError';
  }
}

export class InventoryValidationError extends Error {
  public readonly field: string | undefined;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'InventoryValidationError';
    this.field = field;
  }
}

export class InvalidCursorError extends Error {
  constructor(message: string = 'Invalid or malformed pagination cursor') {
    super(message);
    this.name = 'InvalidCursorError';
  }
}
