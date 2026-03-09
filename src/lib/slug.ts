/**
 * Slug generation utilities
 */

/**
 * Convert a string to a URL-friendly slug
 * - Converts to lowercase
 * - Replaces spaces with dashes
 * - Removes non-alphanumeric characters (except dashes)
 * - Trims whitespace
 */
export function slugify(text?: string): string {
  if (!text || !text.trim()) {
    return '';
  }

  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}
