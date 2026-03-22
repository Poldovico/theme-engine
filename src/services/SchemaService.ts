/**
 * SchemaService - Business logic for schema operations
 * 
 * Wraps the schema repository with domain logic.
 * Mostly delegates to repository with minimal business logic.
 */

import { randomUUID } from 'node:crypto';
import { slugify } from '../lib/slug.js';
import type { ISchemaRepository } from '../storage/ISchemaRepository.js';
import type { IThemeRepository } from '../storage/IThemeRepository.js';
import type {
  ApiSchema,
  SchemaSummary,
  CreateSchemaRequest,
  UpdateSchemaRequest,
} from '../types/api.js';
import type { StoredSchema } from '../types/storage.js';

export class SchemaService {
  constructor(
    private schemaRepository: ISchemaRepository,
    private themeRepository: IThemeRepository
  ) { }

  /**
   * Create a new schema
   */
  async createSchema(request: CreateSchemaRequest): Promise<ApiSchema> {
    const schemaId = this.generateId(request.name);

    const schema: StoredSchema = {
      id: schemaId,
      name: request.name,
      ...(request.version && { version: request.version }), // weird pattern to avoid having an empty version field if not provided
      variables: request.variables,
    };

    await this.schemaRepository.saveSchema(schema);
    return schema;
  }

  /**
   * Get a schema by ID
   */
  async getSchema(schemaId: string): Promise<ApiSchema | null> {
    return this.schemaRepository.getSchema(schemaId);
  }

  /**
   * Update a schema
   */
  async updateSchema(
    schemaId: string,
    request: UpdateSchemaRequest
  ): Promise<ApiSchema | null> {
    const existing = await this.schemaRepository.getSchema(schemaId);
    if (!existing) {
      return null;
    }

    const updated: StoredSchema = {
      id: existing.id,
      name: request.name ?? existing.name,
      ...(request.version && { version: request.version }),
      variables: request.variables ?? existing.variables,
    };

    await this.schemaRepository.updateSchema(updated);
    return updated;
  }

  /**
   * Delete a schema
   * Throws an error if the schema is still referenced by any themes
   */
  async deleteSchema(schemaId: string): Promise<boolean> {
    // Check if any themes reference this schema
    const referencingThemes = await this.themeRepository.listThemeIdsBySchemaId(schemaId);

    if (referencingThemes.length > 0) {
      throw new Error(
        `Cannot delete schema ${schemaId}: still referenced by ${referencingThemes.length} theme(s): ${referencingThemes.join(', ')}`
      );
    }

    return this.schemaRepository.deleteSchema(schemaId);
  }

  /**
   * List schema summaries
   */
  async listSchemas(): Promise<SchemaSummary[]> {
    const schemaIds = await this.schemaRepository.listSchemaIds();
    const summaries: SchemaSummary[] = [];

    for (const id of schemaIds) {
      const schema = await this.schemaRepository.getSchema(id);
      if (schema) {
        const summary: SchemaSummary = {
          id: schema.id,
          name: schema.name,
          variableCount: Object.keys(schema.variables).length,
        };
        if (schema.version) {
          summary.version = schema.version;
        }
        summaries.push(summary);
      }
    }

    return summaries;
  }

  /**
   * Helper: Generate a descriptive ID from schema name
   * Pattern: "name-uuid" or "schema-uuid" if no name provided
   */
  private generateId(name?: string): string {
    const uuid = randomUUID();
    const slug = slugify(name);
    return slug ? `${slug}-${uuid}` : `schema-${uuid}`;
  }
}
