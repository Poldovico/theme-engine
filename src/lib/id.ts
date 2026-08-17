import { randomUUID } from 'node:crypto';
import { slugify } from '../lib/slug.js';

/**
 * Helper: Generate a unique theme ID
 * Pattern: "name-uuid" or "theme-uuid" if no name provided
 */
export function generateId(name: string | undefined, base: string = "item"): string {
  const uuid = process.env["ACCEPT_EXACT_IDS"] ? "" : randomUUID();
  const prefix = name ?? base;
  const slug = slugify(`${prefix} ${uuid}`);
  return slug;
}