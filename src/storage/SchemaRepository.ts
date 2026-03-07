/**
 * SchemaRepository - Data access layer for schemas
 * 
 * Storage pattern:
 * - Key: schema:{schemaId}
 * - Type: String (JSON value)
 * - Value: Full schema object as JSON
 */

import type { GlideClient } from '@valkey/valkey-glide';
import type { StoredSchema } from '../types/storage.js';

/**
 * Repository for schema storage operations
 */
export class SchemaRepository {
  constructor(private client: GlideClient) { }

  /**
   * Generate schema key pattern
   */
  private getSchemaKey(schemaId: string): string {
    return `schema:${schemaId}`;
  }

  /**
   * Save a schema to storage
   */
  async saveSchema(schema: StoredSchema): Promise<void> {
    const key = this.getSchemaKey(schema.id);
    await this.client.set(key, JSON.stringify(schema));
  }

  /**
   * Get a schema from storage
   * Returns null if schema doesn't exist
   */
  async getSchema(schemaId: string): Promise<StoredSchema | null> {
    const key = this.getSchemaKey(schemaId);
    const value = await this.client.get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value.toString()) as StoredSchema;
  }

  /**
   * Delete a schema
   */
  async deleteSchema(schemaId: string): Promise<boolean> {
    const key = this.getSchemaKey(schemaId);
    const deleted = await this.client.del([key]);
    return deleted > 0;
  }

  /**
   * Check if a schema exists
   */
  async exists(schemaId: string): Promise<boolean> {
    const key = this.getSchemaKey(schemaId);
    const result = await this.client.exists([key]);
    return result > 0;
  }

  /**
   * List all schema IDs
   * Uses SCAN for safe iteration over large datasets
   */
  async listSchemaIds(): Promise<string[]> {
    const pattern = 'schema:*';
    const schemaIds: string[] = [];
    let cursor = '0';

    do {
      const result = await this.client.scan(cursor, { match: pattern, count: 100 });
      cursor = result[0].toString();
      const keys = result[1];

      for (const key of keys) {
        // Extract schema ID from key (schema:id -> id)
        const id = key.toString().replace('schema:', '');
        schemaIds.push(id);
      }
    } while (cursor !== '0');

    return schemaIds;
  }

  /**
   * Update a schema
   * Overwrites the entire schema with new data
   */
  async updateSchema(schema: StoredSchema): Promise<void> {
    const key = this.getSchemaKey(schema.id);
    await this.client.set(key, JSON.stringify(schema));
  }
}
