/**
 * ISchemaRepository - Data access contract for schemas
 * 
 * Defines the interface that any schema storage implementation must fulfill.
 * Allows transparent swapping of storage backends (Valkey, MongoDB, PostgreSQL, etc.)
 */

import type { StoredSchema } from '../types/storage.js';

export interface ISchemaRepository {
  /**
   * Save a schema to storage
   */
  saveSchema(schema: StoredSchema): Promise<void>;

  /**
   * Get a schema from storage
   * Returns null if schema doesn't exist
   */
  getSchema(schemaId: string): Promise<StoredSchema | null>;

  /**
   * Delete a schema
   * Returns true if schema was deleted, false if it didn't exist
   */
  deleteSchema(schemaId: string): Promise<boolean>;

  /**
   * Check if a schema exists
   */
  exists(schemaId: string): Promise<boolean>;

  /**
   * List all schema IDs
   */
  listSchemaIds(): Promise<string[]>;

  /**
   * Update a schema
   * Overwrites the entire schema with new data
   */
  updateSchema(schema: StoredSchema): Promise<void>;
}
