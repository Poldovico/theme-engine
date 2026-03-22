/**
 * End-to-end integration tests for Theme and Schema APIs
 * Tests the full stack: HTTP -> Routes -> Services -> Repositories -> Valkey
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import type { FastifyInstance } from 'fastify';
import { closeClient } from '../storage/ValKeyClient.js';
import { createApp } from '../app.js';

describe('API Integration Tests', () => {
  let app: FastifyInstance;
  let testSchemaId: string;
  let testThemeWithSchemaId: string;
  let testFreeformThemeId: string;

  before(async () => {
    // Use the real app initialization
    app = await createApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    // Cleanup: delete test data
    if (testSchemaId) {
      await app.inject({
        method: 'DELETE',
        url: `/schemas/${testSchemaId}`,
      });
    }
    if (testThemeWithSchemaId) {
      await app.inject({
        method: 'DELETE',
        url: `/themes/${testThemeWithSchemaId}`,
      });
    }
    if (testFreeformThemeId) {
      await app.inject({
        method: 'DELETE',
        url: `/themes/${testFreeformThemeId}`,
      });
    }

    await app.close();
    await closeClient();
  });

  describe('Schema API', () => {
    it('should create a schema with variable definitions', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/schemas',
        payload: {
          name: 'Material Design Schema',
          version: '1.0.0',
          variables: {
            '--primary-color': {
              description: 'Primary brand color',
              allowedTypes: ['color'],
              defaultType: 'color',
              defaultValue: '#6200ee',
            },
            '--secondary-color': {
              description: 'Secondary brand color',
              allowedTypes: ['color'],
              defaultType: 'color',
              defaultValue: '#03dac6',
            },
            '--font-size-base': {
              description: 'Base font size',
              allowedTypes: ['string'],
              defaultType: 'string',
              defaultValue: '16px',
            },
          },
        },
      });

      assert.strictEqual(response.statusCode, 201);
      const schema = JSON.parse(response.body);
      assert.ok(schema.id);
      assert.strictEqual(schema.name, 'Material Design Schema');
      assert.strictEqual(schema.version, '1.0.0');
      assert.strictEqual(Object.keys(schema.variables).length, 3);
      assert.strictEqual(schema.variables['--primary-color'].defaultValue, '#6200ee');

      testSchemaId = schema.id;
    });

    it('should list schemas', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/schemas',
      });

      assert.strictEqual(response.statusCode, 200);
      const schemas = JSON.parse(response.body);
      assert.ok(Array.isArray(schemas));
      assert.ok(schemas.length > 0);

      const ourSchema = schemas.find((s: any) => s.id === testSchemaId);
      assert.ok(ourSchema);
      assert.strictEqual(ourSchema.variableCount, 3);
    });

    it('should get schema by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/schemas/${testSchemaId}`,
      });

      assert.strictEqual(response.statusCode, 200);
      const schema = JSON.parse(response.body);
      assert.strictEqual(schema.id, testSchemaId);
      assert.strictEqual(schema.name, 'Material Design Schema');
    });
  });

  describe('Theme API - Freeform (no schema)', () => {
    it('should create a freeform theme without schema', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/themes',
        payload: {
          name: 'Freeform Custom Theme',
          variables: {
            '--custom-color': {
              value: '#ff5733',
              type: 'color',
            },
            '--custom-spacing': {
              value: '24px',
              type: 'string',
            },
          },
        },
      });

      assert.strictEqual(response.statusCode, 201);
      const theme = JSON.parse(response.body);
      assert.ok(theme.id);
      assert.strictEqual(theme.name, 'Freeform Custom Theme');
      assert.strictEqual(theme.schemaId, undefined);
      assert.strictEqual(Object.keys(theme.variables).length, 2);

      // Variables should not have schema metadata
      assert.strictEqual(theme.variables['--custom-color'].value, '#ff5733');
      assert.strictEqual(theme.variables['--custom-color'].description, undefined);
      assert.strictEqual(theme.variables['--custom-color'].allowedTypes, undefined);

      testFreeformThemeId = theme.id;
    });

    it('should update freeform theme variable', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/themes/${testFreeformThemeId}/variables/--custom-color`,
        payload: {
          value: '#00ff00',
          type: 'color',
        },
      });

      assert.strictEqual(response.statusCode, 200);
      const variable = JSON.parse(response.body);
      assert.strictEqual(variable.name, '--custom-color');
      assert.strictEqual(variable.value, '#00ff00');
      assert.notStrictEqual(variable.lastModified, undefined);
    });

    it('should get freeform theme with updated variable', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/themes/${testFreeformThemeId}`,
      });

      assert.strictEqual(response.statusCode, 200);
      const theme = JSON.parse(response.body);
      assert.strictEqual(theme.variables['--custom-color'].value, '#00ff00');
      assert.strictEqual(theme.variables['--custom-spacing'].value, '24px');
    });
  });

  describe('Theme API - Schema-based', () => {
    it('should create theme with schema and get default values', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/themes',
        payload: {
          name: 'Material Light Theme',
          schemaId: testSchemaId,
          variables: {
            // Override only primary color, others should get defaults
            '--primary-color': {
              value: '#1976d2',
              type: 'color',
            },
          },
        },
      });

      assert.strictEqual(response.statusCode, 201);
      const theme = JSON.parse(response.body);
      assert.ok(theme.id);
      assert.strictEqual(theme.name, 'Material Light Theme');
      assert.strictEqual(theme.schemaId, testSchemaId);

      // Should have all 3 variables (1 custom, 2 from schema defaults)
      assert.strictEqual(Object.keys(theme.variables).length, 3);

      // Custom value
      assert.strictEqual(theme.variables['--primary-color'].value, '#1976d2');

      // Schema defaults
      assert.strictEqual(theme.variables['--secondary-color'].value, '#03dac6');
      assert.strictEqual(theme.variables['--font-size-base'].value, '16px');

      testThemeWithSchemaId = theme.id;
    });

    it('should merge schema metadata with theme variables', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/themes/${testThemeWithSchemaId}`,
      });

      assert.strictEqual(response.statusCode, 200);
      const theme = JSON.parse(response.body);

      // All variables should have schema metadata
      const primaryVar = theme.variables['--primary-color'];
      assert.strictEqual(primaryVar.value, '#1976d2');
      assert.strictEqual(primaryVar.description, 'Primary brand color');
      assert.deepStrictEqual(primaryVar.allowedTypes, ['color']);
      assert.strictEqual(primaryVar.defaultType, 'color');
      assert.strictEqual(primaryVar.defaultValue, '#6200ee');

      const secondaryVar = theme.variables['--secondary-color'];
      assert.strictEqual(secondaryVar.description, 'Secondary brand color');
      assert.deepStrictEqual(secondaryVar.allowedTypes, ['color']);
    });

    it('should get single variable with schema metadata', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/themes/${testThemeWithSchemaId}/variables/--primary-color`,
      });

      assert.strictEqual(response.statusCode, 200);
      const variable = JSON.parse(response.body);
      assert.strictEqual(variable.name, '--primary-color');
      assert.strictEqual(variable.value, '#1976d2');
      assert.strictEqual(variable.description, 'Primary brand color');
      assert.deepStrictEqual(variable.allowedTypes, ['color']);
    });

    it('should update schema-based theme variable', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/themes/${testThemeWithSchemaId}/variables/--secondary-color`,
        payload: {
          value: '#ff0080',
          type: 'color',
        },
      });

      assert.strictEqual(response.statusCode, 200);
      const variable = JSON.parse(response.body);
      assert.strictEqual(variable.value, '#ff0080');
      // Should still have schema metadata
      assert.strictEqual(variable.description, 'Secondary brand color');
      assert.deepStrictEqual(variable.allowedTypes, ['color']);
    });

    it('should clone schema-based theme', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/themes/${testThemeWithSchemaId}/clone`,
        payload: {
          name: 'Material Dark Theme',
        },
      });

      assert.strictEqual(response.statusCode, 201);
      const clonedTheme = JSON.parse(response.body);
      assert.ok(clonedTheme.id);
      assert.notStrictEqual(clonedTheme.id, testThemeWithSchemaId);
      assert.strictEqual(clonedTheme.name, 'Material Dark Theme');
      assert.strictEqual(clonedTheme.schemaId, testSchemaId);

      // Should have same variables as original
      assert.strictEqual(clonedTheme.variables['--primary-color'].value, '#1976d2');
      assert.strictEqual(clonedTheme.variables['--secondary-color'].value, '#ff0080');

      // Cleanup cloned theme
      await app.inject({
        method: 'DELETE',
        url: `/themes/${clonedTheme.id}`,
      });
    });
  });

  describe('Schema deletion protection', () => {
    it('should prevent deleting schema when referenced by themes', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/schemas/${testSchemaId}`,
      });

      assert.strictEqual(response.statusCode, 409);
      const error = JSON.parse(response.body);
      assert.strictEqual(error.error, 'Conflict');
      assert.ok(error.message.includes('still referenced'));
    });

    it('should allow deleting schema after removing theme reference', async () => {
      // First delete the theme that references the schema
      const deleteThemeResponse = await app.inject({
        method: 'DELETE',
        url: `/themes/${testThemeWithSchemaId}`,
      });
      assert.strictEqual(deleteThemeResponse.statusCode, 204);

      // Now schema deletion should succeed
      const deleteSchemaResponse = await app.inject({
        method: 'DELETE',
        url: `/schemas/${testSchemaId}`,
      });
      assert.strictEqual(deleteSchemaResponse.statusCode, 204);

      // Verify schema is gone
      const getResponse = await app.inject({
        method: 'GET',
        url: `/schemas/${testSchemaId}`,
      });
      assert.strictEqual(getResponse.statusCode, 404);

      // Clear these so after() doesn't try to delete again
      testSchemaId = '';
      testThemeWithSchemaId = '';
    });
  });

  describe('Theme listing', () => {
    it('should list all themes with accurate variable counts', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/themes',
      });

      assert.strictEqual(response.statusCode, 200);
      const themes = JSON.parse(response.body);
      assert.ok(Array.isArray(themes));

      const freeformTheme = themes.find((t: any) => t.id === testFreeformThemeId);
      assert.ok(freeformTheme);
      assert.strictEqual(freeformTheme.name, 'Freeform Custom Theme');
      assert.strictEqual(freeformTheme.variableCount, 2);
      assert.strictEqual(freeformTheme.schemaId, undefined);
    });
  });
});
