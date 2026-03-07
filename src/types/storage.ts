/**
 * Storage models - data structures persisted in Valkey
 */

/**
 * Variable stored in a theme (Valkey hash field value)
 */
export interface StoredVariable {
  value: string;
  type: string; // actual type of current value (color, dimension, font, etc.)
  custom?: Record<string, unknown>; // arbitrary JSON for downstream app use
  lastModified?: string; // ISO 8601 timestamp
}

/**
 * Theme storage model (Valkey hash)
 * Key pattern: theme:{themeId}
 * Each field is a variable name, value is JSON-serialized StoredVariable
 */
export interface StoredTheme {
  id: string;
  name: string;
  schemaId?: string;
  variables: Record<string, StoredVariable>;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

/**
 * Schema variable definition
 */
export interface SchemaVariable {
  description: string;
  allowedTypes: string[]; // list of valid types this variable can hold
  defaultType?: string;
  defaultValue?: string;
  required?: boolean;
  validation?: {
    pattern?: string; // regex pattern
    enum?: string[]; // array of valid values
  };
  custom?: Record<string, unknown>; // expected custom metadata structure
}

/**
 * Schema storage model (Valkey key-value)
 * Key pattern: schema:{schemaId}
 * Value is JSON-serialized Schema
 */
export interface StoredSchema {
  id: string;
  name: string;
  version?: string;
  variables: Record<string, SchemaVariable>;
}
