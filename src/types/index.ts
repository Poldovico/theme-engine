/**
 * Type definitions for the whitelabel theming engine
 * 
 * Organized by concern:
 * - storage: Data structures persisted in Valkey
 * - api: Data structures exposed via REST API (often merged storage + schema)
 * - validation: Validation-related types
 */

// Storage models
export type {
  StoredVariable,
  StoredTheme,
  SchemaVariable,
  StoredSchema,
} from './storage.js';

// API models
export type {
  ApiVariable,
  ApiTheme,
  ApiSchema,
  ThemeSummary,
  SchemaSummary,
  CreateThemeRequest,
  UpdateThemeRequest,
  VariableUpdate,
  CreateSchemaRequest,
  UpdateSchemaRequest,
} from './api.js';

// Validation types
export type {
  ValidationResult,
  ValidationError,
} from './validation.js';
