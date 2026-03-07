/**
 * Validation types
 */

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  variableName: string;
  message: string;
  type: 'missing_required' | 'invalid_type' | 'pattern_mismatch' | 'enum_violation';
}
