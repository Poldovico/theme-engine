/**
 * ThemeRepository - Data access layer for themes
 * 
 * Storage pattern:
 * - Key: theme:{themeId}
 * - Type: Redis hash
 * - Fields:
 *   - __meta__ : JSON object with {id, name, schemaId, createdAt, updatedAt}
 *   - --variable-name : JSON object with {value, type, custom, lastModified}
 */

import type { GlideClient } from '@valkey/valkey-glide';
import type { StoredTheme, StoredVariable } from '../types/storage.js';

const META_FIELD = '__meta__';

/**
 * Theme metadata stored in the __meta__ field
 */
interface ThemeMetadata {
  id: string;
  name: string;
  schemaId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Repository for theme storage operations
 */
export class ThemeRepository {
  constructor(private client: GlideClient) { }

  /**
   * Generate theme key pattern
   */
  private getThemeKey(themeId: string): string {
    return `theme:${themeId}`;
  }

  /**
   * Save a complete theme to storage
   */
  async saveTheme(theme: StoredTheme): Promise<void> {
    const key = this.getThemeKey(theme.id);
    const fields: Record<string, string> = {};

    // Save metadata
    const metadata: ThemeMetadata = {
      id: theme.id,
      name: theme.name,
      ...(theme.schemaId !== undefined && { schemaId: theme.schemaId }),
      createdAt: theme.createdAt,
      updatedAt: theme.updatedAt,
    };
    fields[META_FIELD] = JSON.stringify(metadata);

    // Save each variable
    for (const [varName, varData] of Object.entries(theme.variables)) {
      fields[varName] = JSON.stringify(varData);
    }

    // Use HSET with multiple fields
    await this.client.hset(key, fields);
  }

  /**
   * Get a complete theme from storage
   * Returns null if theme doesn't exist
   */
  async getTheme(themeId: string): Promise<StoredTheme | null> {
    const key = this.getThemeKey(themeId);
    const data = await this.client.hgetall(key);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    // Extract metadata
    const dataRecord = data as Record<string, any>;
    const metaJson = dataRecord[META_FIELD];
    if (!metaJson) {
      throw new Error(`Theme ${themeId} is missing metadata field`);
    }

    const metadata = JSON.parse(metaJson.toString()) as ThemeMetadata;

    // Extract variables
    const variables: Record<string, StoredVariable> = {};
    for (const [field, value] of Object.entries(data)) {
      if (field !== META_FIELD) {
        variables[field] = JSON.parse(value.toString()) as StoredVariable;
      }
    }

    return {
      id: metadata.id,
      name: metadata.name,
      ...(metadata.schemaId !== undefined && { schemaId: metadata.schemaId }),
      variables,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
    };
  }

  /**
   * Get a single variable from a theme
   * Returns null if theme or variable doesn't exist
   */
  async getVariable(
    themeId: string,
    variableName: string
  ): Promise<StoredVariable | null> {
    const key = this.getThemeKey(themeId);
    const value = await this.client.hget(key, variableName);

    if (!value) {
      return null;
    }

    return JSON.parse(value.toString()) as StoredVariable;
  }

  /**
   * Set a single variable in a theme
   * Creates the variable if it doesn't exist, updates if it does
   * Also updates the theme's updatedAt timestamp
   */
  async setVariable(
    themeId: string,
    variableName: string,
    variable: StoredVariable
  ): Promise<void> {
    const key = this.getThemeKey(themeId);

    // Update variable and metadata in a single operation
    const fields: Record<string, string> = {
      [variableName]: JSON.stringify(variable),
    };

    // Update the theme's updatedAt timestamp
    const metaJson = await this.client.hget(key, META_FIELD);
    if (metaJson) {
      const metadata = JSON.parse(metaJson.toString()) as ThemeMetadata;
      metadata.updatedAt = new Date().toISOString();
      fields[META_FIELD] = JSON.stringify(metadata);
    }

    await this.client.hset(key, fields);
  }

  /**
   * Set multiple variables in a theme at once
   * Updates all variables and the theme's updatedAt timestamp atomically
   */
  async setVariables(
    themeId: string,
    variables: Record<string, StoredVariable>
  ): Promise<void> {
    const key = this.getThemeKey(themeId);
    const fields: Record<string, string> = {};

    // Serialize all variables
    for (const [varName, varData] of Object.entries(variables)) {
      fields[varName] = JSON.stringify(varData);
    }

    // Update the theme's updatedAt timestamp
    const metaJson = await this.client.hget(key, META_FIELD);
    if (metaJson) {
      const metadata = JSON.parse(metaJson.toString()) as ThemeMetadata;
      metadata.updatedAt = new Date().toISOString();
      fields[META_FIELD] = JSON.stringify(metadata);
    }

    await this.client.hset(key, fields);
  }

  /**
   * Delete a variable from a theme
   * Also updates the theme's updatedAt timestamp
   */
  async deleteVariable(themeId: string, variableName: string): Promise<boolean> {
    const key = this.getThemeKey(themeId);

    // Delete the variable
    const deleted = await this.client.hdel(key, [variableName]);

    // Update the theme's updatedAt timestamp if variable was deleted
    if (deleted > 0) {
      const metaJson = await this.client.hget(key, META_FIELD);
      if (metaJson) {
        const metadata = JSON.parse(metaJson.toString()) as ThemeMetadata;
        metadata.updatedAt = new Date().toISOString();
        await this.client.hset(key, { [META_FIELD]: JSON.stringify(metadata) });
      }
    }

    return deleted > 0;
  }

  /**
   * Delete an entire theme
   */
  async deleteTheme(themeId: string): Promise<boolean> {
    const key = this.getThemeKey(themeId);
    const deleted = await this.client.del([key]);
    return deleted > 0;
  }

  /**
   * Check if a theme exists
   */
  async exists(themeId: string): Promise<boolean> {
    const key = this.getThemeKey(themeId);
    const result = await this.client.exists([key]);
    return result > 0;
  }

  /**
   * List all theme IDs
   * Uses SCAN for safe iteration over large datasets
   */
  async listThemeIds(): Promise<string[]> {
    const pattern = 'theme:*';
    const themeIds: string[] = [];
    let cursor = '0';

    do {
      const result = await this.client.scan(cursor, { match: pattern, count: 100 });
      cursor = result[0].toString();
      const keys = result[1];

      for (const key of keys) {
        // Extract theme ID from key (theme:id -> id)
        const id = key.toString().replace('theme:', '');
        themeIds.push(id);
      }
    } while (cursor !== '0');

    return themeIds;
  }

  /**
   * Get theme metadata only (without variables)
   * Useful for list operations
   */
  async getThemeMetadata(themeId: string): Promise<ThemeMetadata | null> {
    const key = this.getThemeKey(themeId);
    const metaJson = await this.client.hget(key, META_FIELD);

    if (!metaJson) {
      return null;
    }

    return JSON.parse(metaJson.toString()) as ThemeMetadata;
  }

  /**
   * Update theme metadata (name, schemaId)
   * Does not affect variables
   */
  async updateThemeMetadata(
    themeId: string,
    updates: { name?: string; schemaId?: string }
  ): Promise<void> {
    const key = this.getThemeKey(themeId);
    const metaJson = await this.client.hget(key, META_FIELD);

    if (!metaJson) {
      throw new Error(`Theme ${themeId} not found`);
    }

    const metadata = JSON.parse(metaJson.toString()) as ThemeMetadata;

    if (updates.name !== undefined) {
      metadata.name = updates.name;
    }
    if (updates.schemaId !== undefined) {
      metadata.schemaId = updates.schemaId;
    }
    metadata.updatedAt = new Date().toISOString();

    await this.client.hset(key, { [META_FIELD]: JSON.stringify(metadata) });
  }
}
