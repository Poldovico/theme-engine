/**
 * API models - data structures exposed via REST API
 * These often merge storage data with schema metadata
 */

import type { SchemaVariable, StoredSchema, StoredVariable } from './storage.js';

/**
 * Variable in API response (merged theme + schema data)
 */
export interface ApiVariable {
  name: string;
  value: string;
  type: string; // actual type from storage
  allowedTypes?: string[]; // from schema (if theme has schema)
  description?: string; // from schema (if theme has schema)
  defaultType?: string; // from schema (if theme has schema)
  custom?: Record<string, unknown>; // from storage
  lastModified?: string;
  defaultValue?: string; // from schema
  validation?: {
    pattern?: string;
    enum?: string[];
  }; // from schema
}

/**
 * Theme in API response (with merged schema metadata)
 */
export interface ApiTheme {
  id: string;
  name: string;
  schemaId?: string;
  variables: Record<string, ApiVariable>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Schema in API response (same as storage)
 */
export interface ApiSchema extends StoredSchema { }

/**
 * Theme summary for list endpoints
 */
export interface ThemeSummary {
  id: string;
  name: string;
  schemaId?: string;
  variableCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Schema summary for list endpoints
 */
export interface SchemaSummary {
  id: string;
  name: string;
  version?: string;
  variableCount: number;
}

// ============================================================================
// Request Bodies
// ============================================================================

/**
 * Create theme request body
 */
export interface CreateThemeRequest {
  name: string;
  schemaId?: string;
  variables?: Record<string, Omit<StoredVariable, 'lastModified'>>;
}

/**
 * Update theme request body
 */
export interface UpdateThemeRequest {
  name?: string;
  schemaId?: string;
  variables?: Record<string, Omit<StoredVariable, 'lastModified'>>;
}

/**
 * Variable update (for PUT /themes/:id/variables/:name and PATCH)
 */
export interface VariableUpdate {
  value: string;
  type?: string;
  custom?: Record<string, unknown>;
}

/**
 * Create schema request body
 */
export interface CreateSchemaRequest {
  name: string;
  version?: string;
  variables: Record<string, SchemaVariable>;
}

/**
 * Update schema request body
 */
export interface UpdateSchemaRequest {
  name?: string;
  version?: string;
  variables?: Record<string, SchemaVariable>;
}
