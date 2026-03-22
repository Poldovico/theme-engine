/**
 * RenderService - Generates CSS from themes
 */

import type { ThemeService } from './ThemeService.js';

export class RenderService {
  constructor(private themeService: ThemeService) { }

  /**
   * Generate CSS stylesheet from a theme
   * Converts theme variables to CSS custom properties
   */
  async generateCSS(themeId: string): Promise<string | null> {
    const theme = await this.themeService.getTheme(themeId);

    if (!theme) {
      return null;
    }

    // Generate CSS custom properties
    const cssLines: string[] = [
      `/* Theme: ${theme.name} */`,
      `/* Generated: ${new Date().toISOString()} */`,
      ':root {',
    ];

    // Sort variable names for consistent output
    const sortedVarNames = Object.keys(theme.variables).sort();

    for (const varName of sortedVarNames) {
      const variable = theme.variables[varName];

      if (!variable) {
        continue;
      }

      // Add comment with description if available from schema
      if (variable.description) {
        cssLines.push(`  /* ${variable.description} */`);
      }

      cssLines.push(`  ${varName}: ${variable.value};`);
    }

    cssLines.push('}');

    return cssLines.join('\n');
  }
}
