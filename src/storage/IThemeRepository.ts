/**
 * IThemeRepository - Data access contract for themes
 * 
 * Defines the interface that any theme storage implementation must fulfill.
 * Allows transparent swapping of storage backends (Valkey, MongoDB, PostgreSQL, etc.)
 */

import type { StoredTheme, StoredVariable } from '../types/storage.js';

export interface IThemeRepository {
  /**
   * Save a complete theme to storage
   */
  saveTheme(theme: StoredTheme): Promise<void>;

  /**
   * Get a complete theme from storage
   * Returns null if theme doesn't exist
   */
  getTheme(themeId: string): Promise<StoredTheme | null>;

  /**
   * Get a single variable from a theme
   * Returns null if theme or variable doesn't exist
   */
  getVariable(themeId: string, variableName: string): Promise<StoredVariable | null>;

  /**
   * Set a single variable in a theme
   * 
   * Creates the variable if it doesn't exist, updates if it does.
   * 
   * **Design Note:** Returns both the stored variable and the theme's schemaId to avoid redundant
   * theme fetches in the service layer. While this creates a tighter coupling between storage
   * and business logic, the performance benefit justifies the tradeoff at the repository level.
   * The service layer can use this metadata to merge schema defaults without refetching the entire theme.
   */
  setVariable(
    themeId: string,
    variableName: string,
    variable: StoredVariable
  ): Promise<{ variable: StoredVariable; schemaId?: string }>;

  /**
   * Set multiple variables in a theme at once
   * Updates all variables atomically
   */
  setVariables(
    themeId: string,
    variables: Record<string, StoredVariable>
  ): Promise<void>;

  /**
   * Delete a variable from a theme
   * Returns true if variable was deleted, false if it didn't exist
   */
  deleteVariable(themeId: string, variableName: string): Promise<boolean>;

  /**
   * Delete an entire theme
   * Returns true if theme was deleted, false if it didn't exist
   */
  deleteTheme(themeId: string): Promise<boolean>;

  /**
   * Check if a theme exists
   */
  exists(themeId: string): Promise<boolean>;

  /**
   * List all theme IDs
   */
  listThemeIds(): Promise<string[]>;

  /**
   * Get theme metadata only (without variables)
   * Returns null if theme doesn't exist
   */
  getThemeMetadata(
    themeId: string
  ): Promise<{ id: string; name: string; schemaId?: string; createdAt: string; updatedAt: string } | null>;

  /**
   * Update theme metadata (name, schemaId)
   * Does not affect variables
   */
  updateThemeMetadata(
    themeId: string,
    updates: { name?: string; schemaId?: string }
  ): Promise<void>;
}
