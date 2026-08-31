export class NutritionDomainError extends Error {
  public code: string;

  constructor(message: string, code = 'NUTRITION_DOMAIN_ERROR') {
    super(message);
    this.name = 'NutritionDomainError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NutritionValidationError extends NutritionDomainError {
  public readonly field?: string | undefined;

  constructor(message: string, field?: string) {
    super(message, 'NUTRITION_VALIDATION_ERROR');
    this.name = 'NutritionValidationError';
    this.field = field;
  }
}

export class UnsupportedPopulationError extends NutritionValidationError {
  constructor(message: string, field = 'age') {
    super(message, field);
    this.name = 'UnsupportedPopulationError';
    this.code = 'UNSUPPORTED_POPULATION';
  }
}

export class NutritionProvenanceError extends NutritionValidationError {
  constructor(message: string, field = 'provenance') {
    super(message, field);
    this.name = 'NutritionProvenanceError';
    this.code = 'PROVENANCE_REQUIRED';
  }
}

export class FormulaPrerequisiteError extends NutritionValidationError {
  constructor(message: string, field = 'bodyFatPercentage') {
    super(message, field);
    this.name = 'FormulaPrerequisiteError';
  }
}

export class InvalidPortionError extends NutritionValidationError {
  constructor(message: string, field = 'portion') {
    super(message, field);
    this.name = 'InvalidPortionError';
  }
}
