/**
 * ThemeService - Business logic for theme operations
 * 
 * Wraps the theme repository with domain logic, including metadata merging
 * when the theme references a schema.
 */

import { generateId } from '../lib/id.js';
import type { IThemeRepository } from '../storage/IThemeRepository.js';
import type { ISchemaRepository } from '../storage/ISchemaRepository.js';
import type {
  ApiTheme,
  ApiVariable,
  ThemeSummary,
  CreateThemeRequest,
  UpdateThemeRequest,
  VariableUpdate,
} from '../types/api.js';
import type { StoredTheme, StoredVariable, StoredSchema, SchemaVariable } from '../types/storage.js';

export class ThemeService {
  constructor(
    private themeRepository: IThemeRepository,
    private schemaRepository: ISchemaRepository
  ) { }

  /**
   * Create a new theme
   * If schemaId is provided and schema exists, use its defaults for missing variables
   */
  async createTheme(request: CreateThemeRequest): Promise<ApiTheme> {
    const themeId = generateId(request.name, "theme");
    const now = new Date().toISOString();

    const variables: Record<string, StoredVariable> = {};

    // If variables are provided in request, use them
    if (request.variables) {
      for (const [name, variable] of Object.entries(request.variables)) {
        variables[name] = {
          value: variable.value,
          type: variable.type ?? 'string',
          ...(variable.custom && { custom: variable.custom }),
          lastModified: now,
        };
      }
    }

    // If schema is provided, add defaults for missing variables
    if (request.schemaId) {
      const schema = await this.schemaRepository.getSchema(request.schemaId);
      if (schema) {
        for (const [name, schemaVar] of Object.entries(schema.variables)) {
          if (!(name in variables)) {
            if (schemaVar.defaultValue && schemaVar.defaultType) {
              variables[name] = {
                value: schemaVar.defaultValue,
                type: schemaVar.defaultType,
                lastModified: now,
              };
            }
          }
        }
      }
    }

    const storedTheme: StoredTheme = {
      id: themeId,
      name: request.name,
      ...(request.schemaId && { schemaId: request.schemaId }),
      variables,
      createdAt: now,
      updatedAt: now,
    };

    await this.themeRepository.saveTheme(storedTheme);

    return this.themeToApiTheme(storedTheme);
  }

  /**
   * Get a theme by ID
   * Merges theme data with schema metadata if schema is referenced
   */
  async getTheme(themeId: string): Promise<ApiTheme | null> {
    const theme = await this.themeRepository.getTheme(themeId);
    if (!theme) {
      return null;
    }
    return this.themeToApiTheme(theme);
  }

  /**
   * Get a single variable from a theme
   * Merges StoredVariable with SchemaVariable metadata if available
   */
  async getVariable(
    themeId: string,
    variableName: string
  ): Promise<ApiVariable | null> {
    const storedVariable = await this.themeRepository.getVariable(
      themeId,
      variableName
    );
    if (!storedVariable) {
      return null;
    }

    // Get theme to access schemaId
    const theme = await this.themeRepository.getTheme(themeId);
    if (!theme) {
      return null;
    }

    // Fetch schema data if theme references a schema
    let schemaVariable: SchemaVariable | undefined;
    if (theme.schemaId) {
      const schema = await this.schemaRepository.getSchema(theme.schemaId);
      schemaVariable = schema?.variables[variableName];
    }

    return this.mergeVariable(variableName, storedVariable, schemaVariable);
  }

  /**
   * Update a theme
   */
  async updateTheme(
    themeId: string,
    request: UpdateThemeRequest
  ): Promise<ApiTheme | null> {
    const existingTheme = await this.themeRepository.getTheme(themeId);
    if (!existingTheme) {
      return null;
    }

    const now = new Date().toISOString();
    const metadataUpdates: { name?: string; schemaId?: string } = {};

    // Update metadata if provided
    if (request.name !== undefined) {
      metadataUpdates.name = request.name;
    }
    if (request.schemaId !== undefined) {
      metadataUpdates.schemaId = request.schemaId;
    }

    // Update metadata in storage
    if (Object.keys(metadataUpdates).length > 0) {
      await this.themeRepository.updateThemeMetadata(themeId, metadataUpdates);
    }

    // Update variables if provided
    if (request.variables) {
      const storedVariables: Record<string, StoredVariable> = {};
      for (const [name, variable] of Object.entries(request.variables)) {
        storedVariables[name] = {
          value: variable.value,
          type: variable.type ?? 'string',
          ...(variable.custom && { custom: variable.custom }),
          lastModified: now,
        };
      }
      await this.themeRepository.setVariables(themeId, storedVariables);
    } else if (Object.keys(metadataUpdates).length > 0) {
      // Update the updatedAt timestamp even if no variables changed
      const currentTheme = await this.themeRepository.getTheme(themeId);
      if (currentTheme) {
        currentTheme.updatedAt = now;
        await this.themeRepository.saveTheme(currentTheme);
      }
    }

    const updated = await this.themeRepository.getTheme(themeId);
    if (!updated) {
      return null;
    }

    return this.themeToApiTheme(updated);
  }

  /**
   * Set a single variable
   */
  async setVariable(
    themeId: string,
    variableName: string,
    update: VariableUpdate
  ): Promise<ApiVariable | null> {
    const now = new Date().toISOString();

    const storedVariable: StoredVariable = {
      value: update.value,
      type: update.type ?? 'string',
      ...(update.custom && { custom: update.custom }),
      lastModified: now,
    };

    // Set variable and get back the stored variable with schemaId
    const { variable: resultVariable, schemaId } =
      await this.themeRepository.setVariable(
        themeId,
        variableName,
        storedVariable
      );

    // Fetch schema data if theme references a schema
    let schemaVariable: SchemaVariable | undefined;
    if (schemaId) {
      const schema = await this.schemaRepository.getSchema(schemaId);
      schemaVariable = schema?.variables[variableName];
    }

    return this.mergeVariable(variableName, resultVariable, schemaVariable);
  }

  /**
   * Delete a variable
   */
  async deleteVariable(
    themeId: string,
    variableName: string
  ): Promise<boolean> {
    return this.themeRepository.deleteVariable(themeId, variableName);
  }

  /**
   * Delete a theme
   */
  async deleteTheme(themeId: string): Promise<boolean> {
    return this.themeRepository.deleteTheme(themeId);
  }

  /**
   * List theme summaries
   */
  async listThemes(): Promise<ThemeSummary[]> {
    const themeIds = await this.themeRepository.listThemeIds();
    const summaries: ThemeSummary[] = [];

    for (const id of themeIds) {
      const metadata = await this.themeRepository.getThemeMetadata(id);
      if (metadata) {
        const theme = await this.themeRepository.getTheme(id);
        const summary: ThemeSummary = {
          id: metadata.id,
          name: metadata.name,
          variableCount: theme ? Object.keys(theme.variables).length : 0,
          createdAt: metadata.createdAt,
          updatedAt: metadata.updatedAt,
        };
        if (metadata.schemaId) {
          summary.schemaId = metadata.schemaId;
        }
        summaries.push(summary);
      }
    }

    return summaries;
  }

  /**
   * Start a new theme from an existing one (clone)
   */
  async cloneTheme(sourceThemeId: string, newName: string): Promise<ApiTheme | null> {
    const source = await this.themeRepository.getTheme(sourceThemeId);
    if (!source) {
      return null;
    }

    const now = new Date().toISOString();
    const newTheme: StoredTheme = {
      id: generateId(newName, "theme"),
      name: newName,
      ...(source.schemaId && { schemaId: source.schemaId }),
      variables: this.deepCloneVariables(source.variables),
      createdAt: now,
      updatedAt: now,
    };

    await this.themeRepository.saveTheme(newTheme);
    return this.themeToApiTheme(newTheme);
  }

  /**
   * Merge a StoredVariable with SchemaVariable metadata to produce an ApiVariable
   * This is synchronous: schema data must be passed in, not fetched here
   */
  private mergeVariable(
    name: string,
    storedVariable: StoredVariable,
    schemaVariable?: SchemaVariable
  ): ApiVariable {
    const apiVariable: ApiVariable = {
      name,
      value: storedVariable.value,
      type: storedVariable.type,
      // optional fields from storage
      ...(storedVariable.custom && { custom: storedVariable.custom }),
      ...(storedVariable.lastModified && { lastModified: storedVariable.lastModified }),
      // optional fields from schema
      ...(schemaVariable && { description: schemaVariable.description }),
      ...(schemaVariable && { allowedTypes: schemaVariable.allowedTypes }),
      ...(schemaVariable?.defaultType && { defaultType: schemaVariable.defaultType }),
      ...(schemaVariable?.defaultValue && { defaultValue: schemaVariable.defaultValue }),
      ...(schemaVariable?.validation && { validation: schemaVariable.validation }),
    };

    return apiVariable;
  }

  /**
   * Convert a StoredTheme to ApiTheme, merging schema metadata for all variables
   * Fetches schema once and reuses it for efficiency
   */
  private async themeToApiTheme(storedTheme: StoredTheme): Promise<ApiTheme> {
    // Fetch schema once if available (extracted from theme)
    let schemaData: StoredSchema | null = null;
    if (storedTheme.schemaId) {
      schemaData = await this.schemaRepository.getSchema(storedTheme.schemaId);
    }

    const apiVariables: Record<string, ApiVariable> = {};

    // Merge each variable with schema metadata if available
    for (const [name, storedVariable] of Object.entries(
      storedTheme.variables
    )) {
      const schemaVariable = schemaData?.variables[name];
      apiVariables[name] = this.mergeVariable(
        name,
        storedVariable,
        schemaVariable
      );
    }

    const apiTheme: ApiTheme = {
      id: storedTheme.id,
      name: storedTheme.name,
      ...(storedTheme.schemaId && { schemaId: storedTheme.schemaId }),
      variables: apiVariables,
      createdAt: storedTheme.createdAt,
      updatedAt: storedTheme.updatedAt,
    };

    return apiTheme;
  }

  /**
   * Helper: Deep clone variables
   */
  private deepCloneVariables(
    variables: Record<string, StoredVariable>
  ): Record<string, StoredVariable> {
    return Object.fromEntries(
      Object.entries(variables).map(([name, variable]) => [
        name,
        {
          value: variable.value,
          type: variable.type,
          ...(variable.custom && { custom: { ...variable.custom } }),
          ...(variable.lastModified && { lastModified: variable.lastModified }),
        },
      ])
    );
  }
}
