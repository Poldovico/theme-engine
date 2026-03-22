/**
 * Test suite for ThemeRepository
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { ThemeRepository } from './ThemeRepository.js';
import type { StoredTheme, StoredVariable } from '../types/storage.js';

describe('ThemeRepository', () => {
  let repository: ThemeRepository;
  let mockClient: any;

  beforeEach(() => {
    // Create mock Valkey client
    mockClient = {
      hset: mock.fn(async () => 1),
      hget: mock.fn(async () => null),
      hgetall: mock.fn(async () => ({})),
      hdel: mock.fn(async () => 0),
      del: mock.fn(async () => 0),
      exists: mock.fn(async () => 0),
      scan: mock.fn(async () => ['0', []]),
    };

    repository = new ThemeRepository(mockClient);
  });

  describe('saveTheme', () => {
    it('should save theme with metadata and variables', async () => {
      const theme: StoredTheme = {
        id: 'theme-1',
        name: 'Test Theme',
        schemaId: 'schema-1',
        variables: {
          '--primary-color': {
            value: '#3498db',
            type: 'color',
            custom: { category: 'branding' },
            lastModified: '2026-03-07T10:00:00Z',
          },
          '--font-size': {
            value: '16px',
            type: 'dimension',
          },
        },
        createdAt: '2026-03-07T10:00:00Z',
        updatedAt: '2026-03-07T10:00:00Z',
      };

      await repository.saveTheme(theme);

      // Verify hset was called with correct key
      assert.strictEqual(mockClient.hset.mock.calls.length, 1);
      const [key, fields] = mockClient.hset.mock.calls[0].arguments;
      assert.strictEqual(key, 'theme:theme-1');

      // Verify metadata field
      assert.ok(fields.__meta__);
      const metadata = JSON.parse(fields.__meta__);
      assert.strictEqual(metadata.id, 'theme-1');
      assert.strictEqual(metadata.name, 'Test Theme');
      assert.strictEqual(metadata.schemaId, 'schema-1');

      // Verify variable fields
      assert.ok(fields['--primary-color']);
      const primaryColor = JSON.parse(fields['--primary-color']);
      assert.strictEqual(primaryColor.value, '#3498db');
      assert.strictEqual(primaryColor.type, 'color');

      assert.ok(fields['--font-size']);
      const fontSize = JSON.parse(fields['--font-size']);
      assert.strictEqual(fontSize.value, '16px');
    });

    it('should handle theme without schemaId', async () => {
      const theme: StoredTheme = {
        id: 'theme-2',
        name: 'Standalone Theme',
        variables: {},
        createdAt: '2026-03-07T10:00:00Z',
        updatedAt: '2026-03-07T10:00:00Z',
      };

      await repository.saveTheme(theme);

      const [, fields] = mockClient.hset.mock.calls[0].arguments;
      const metadata = JSON.parse(fields.__meta__);
      assert.strictEqual(metadata.schemaId, undefined);
    });
  });

  describe('getTheme', () => {
    it('should retrieve and parse theme correctly', async () => {
      const mockData = {
        __meta__: JSON.stringify({
          id: 'theme-1',
          name: 'Test Theme',
          schemaId: 'schema-1',
          createdAt: '2026-03-07T10:00:00Z',
          updatedAt: '2026-03-07T10:00:00Z',
        }),
        '--primary-color': JSON.stringify({
          value: '#3498db',
          type: 'color',
          lastModified: '2026-03-07T10:00:00Z',
        }),
        '--font-size': JSON.stringify({
          value: '16px',
          type: 'dimension',
        }),
      };

      mockClient.hgetall.mock.mockImplementationOnce(async () => mockData);

      const theme = await repository.getTheme('theme-1');

      assert.ok(theme);
      assert.strictEqual(theme.id, 'theme-1');
      assert.strictEqual(theme.name, 'Test Theme');
      assert.strictEqual(theme.schemaId, 'schema-1');
      assert.strictEqual(Object.keys(theme.variables).length, 2);
      assert.strictEqual(theme.variables['--primary-color']?.value, '#3498db');
      assert.strictEqual(theme.variables['--font-size']?.value, '16px');
    });

    it('should return null for non-existent theme', async () => {
      mockClient.hgetall.mock.mockImplementationOnce(async () => ({}));

      const theme = await repository.getTheme('non-existent');

      assert.strictEqual(theme, null);
    });

    it('should throw error if metadata field is missing', async () => {
      mockClient.hgetall.mock.mockImplementationOnce(async () => ({
        '--primary-color': JSON.stringify({ value: '#fff', type: 'color' }),
      }));

      await assert.rejects(
        async () => repository.getTheme('theme-1'),
        /missing metadata field/
      );
    });
  });

  describe('getVariable', () => {
    it('should retrieve a single variable', async () => {
      const variableData = {
        value: '#3498db',
        type: 'color',
        custom: { category: 'branding' },
        lastModified: '2026-03-07T10:00:00Z',
      };

      mockClient.hget.mock.mockImplementationOnce(
        async () => JSON.stringify(variableData)
      );

      const variable = await repository.getVariable('theme-1', '--primary-color');

      assert.ok(variable);
      assert.strictEqual(variable.value, '#3498db');
      assert.strictEqual(variable.type, 'color');
      assert.deepStrictEqual(variable.custom, { category: 'branding' });

      // Verify correct key and field
      const [key, field] = mockClient.hget.mock.calls[0].arguments;
      assert.strictEqual(key, 'theme:theme-1');
      assert.strictEqual(field, '--primary-color');
    });

    it('should return null for non-existent variable', async () => {
      mockClient.hget.mock.mockImplementationOnce(async () => null);

      const variable = await repository.getVariable('theme-1', '--non-existent');

      assert.strictEqual(variable, null);
    });
  });

  describe('setVariable', () => {
    it('should set a variable and update theme metadata', async () => {
      const variable: StoredVariable = {
        value: '#e74c3c',
        type: 'color',
        custom: { category: 'error' },
        lastModified: '2026-03-07T11:00:00Z',
      };

      const existingMeta = {
        id: 'theme-1',
        name: 'Test Theme',
        createdAt: '2026-03-07T10:00:00Z',
        updatedAt: '2026-03-07T10:00:00Z',
      };

      mockClient.hget.mock.mockImplementationOnce(
        async () => JSON.stringify(existingMeta)
      );

      await repository.setVariable('theme-1', '--error-color', variable);

      // Verify hset was called
      assert.strictEqual(mockClient.hset.mock.calls.length, 1);
      const [key, fields] = mockClient.hset.mock.calls[0].arguments;

      assert.strictEqual(key, 'theme:theme-1');
      assert.ok(fields['--error-color']);

      const savedVar = JSON.parse(fields['--error-color']);
      assert.strictEqual(savedVar.value, '#e74c3c');

      // Verify updatedAt was updated
      assert.ok(fields.__meta__);
      const updatedMeta = JSON.parse(fields.__meta__);
      assert.notStrictEqual(updatedMeta.updatedAt, existingMeta.updatedAt);
    });
  });

  describe('setVariables', () => {
    it('should set multiple variables atomically', async () => {
      const variables = {
        '--primary-color': {
          value: '#3498db',
          type: 'color',
        },
        '--secondary-color': {
          value: '#2ecc71',
          type: 'color',
        },
      };

      const existingMeta = {
        id: 'theme-1',
        name: 'Test Theme',
        createdAt: '2026-03-07T10:00:00Z',
        updatedAt: '2026-03-07T10:00:00Z',
      };

      mockClient.hget.mock.mockImplementationOnce(
        async () => JSON.stringify(existingMeta)
      );

      await repository.setVariables('theme-1', variables);

      const [key, fields] = mockClient.hset.mock.calls[0].arguments;
      assert.strictEqual(key, 'theme:theme-1');

      // Verify both variables were set
      assert.ok(fields['--primary-color']);
      assert.ok(fields['--secondary-color']);

      const primary = JSON.parse(fields['--primary-color']);
      const secondary = JSON.parse(fields['--secondary-color']);
      assert.strictEqual(primary.value, '#3498db');
      assert.strictEqual(secondary.value, '#2ecc71');

      // Verify metadata was updated
      assert.ok(fields.__meta__);
    });
  });

  describe('deleteVariable', () => {
    it('should delete a variable and update metadata', async () => {
      const existingMeta = {
        id: 'theme-1',
        name: 'Test Theme',
        createdAt: '2026-03-07T10:00:00Z',
        updatedAt: '2026-03-07T10:00:00Z',
      };

      mockClient.hdel.mock.mockImplementationOnce(async () => 1);
      mockClient.hget.mock.mockImplementationOnce(
        async () => JSON.stringify(existingMeta)
      );

      const result = await repository.deleteVariable('theme-1', '--old-var');

      assert.strictEqual(result, true);

      // Verify hdel was called
      const [delKey, delFields] = mockClient.hdel.mock.calls[0].arguments;
      assert.strictEqual(delKey, 'theme:theme-1');
      assert.deepStrictEqual(delFields, ['--old-var']);

      // Verify metadata was updated
      assert.strictEqual(mockClient.hset.mock.calls.length, 1);
    });

    it('should return false if variable does not exist', async () => {
      mockClient.hdel.mock.mockImplementationOnce(async () => 0);

      const result = await repository.deleteVariable('theme-1', '--non-existent');

      assert.strictEqual(result, false);
      // Should not update metadata
      assert.strictEqual(mockClient.hset.mock.calls.length, 0);
    });
  });

  describe('deleteTheme', () => {
    it('should delete entire theme', async () => {
      mockClient.del.mock.mockImplementationOnce(async () => 1);

      const result = await repository.deleteTheme('theme-1');

      assert.strictEqual(result, true);
      const [keys] = mockClient.del.mock.calls[0].arguments;
      assert.deepStrictEqual(keys, ['theme:theme-1']);
    });

    it('should return false if theme does not exist', async () => {
      mockClient.del.mock.mockImplementationOnce(async () => 0);

      const result = await repository.deleteTheme('non-existent');

      assert.strictEqual(result, false);
    });
  });

  describe('exists', () => {
    it('should return true if theme exists', async () => {
      mockClient.exists.mock.mockImplementationOnce(async () => 1);

      const result = await repository.exists('theme-1');

      assert.strictEqual(result, true);
      const [keys] = mockClient.exists.mock.calls[0].arguments;
      assert.deepStrictEqual(keys, ['theme:theme-1']);
    });

    it('should return false if theme does not exist', async () => {
      mockClient.exists.mock.mockImplementationOnce(async () => 0);

      const result = await repository.exists('non-existent');

      assert.strictEqual(result, false);
    });
  });

  describe('listThemeIds', () => {
    it('should list all theme IDs using SCAN', async () => {
      // Mock SCAN to return results in two batches
      let callCount = 0;
      mockClient.scan.mock.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return ['5', ['theme:theme-1', 'theme:theme-2']];
        } else {
          return ['0', ['theme:theme-3']];
        }
      });

      const ids = await repository.listThemeIds();

      assert.strictEqual(ids.length, 3);
      assert.deepStrictEqual(ids, ['theme-1', 'theme-2', 'theme-3']);
    });

    it('should handle empty result', async () => {
      mockClient.scan.mock.mockImplementation(async () => ['0', []]);

      const ids = await repository.listThemeIds();

      assert.strictEqual(ids.length, 0);
    });
  });

  describe('getThemeMetadata', () => {
    it('should retrieve only metadata', async () => {
      const metadata = {
        id: 'theme-1',
        name: 'Test Theme',
        schemaId: 'schema-1',
        createdAt: '2026-03-07T10:00:00Z',
        updatedAt: '2026-03-07T10:00:00Z',
      };

      mockClient.hget.mock.mockImplementationOnce(
        async () => JSON.stringify(metadata)
      );

      const result = await repository.getThemeMetadata('theme-1');

      assert.ok(result);
      assert.strictEqual(result.id, 'theme-1');
      assert.strictEqual(result.name, 'Test Theme');
      assert.strictEqual(result.schemaId, 'schema-1');

      const [key, field] = mockClient.hget.mock.calls[0].arguments;
      assert.strictEqual(key, 'theme:theme-1');
      assert.strictEqual(field, '__meta__');
    });

    it('should return null for non-existent theme', async () => {
      mockClient.hget.mock.mockImplementationOnce(async () => null);

      const result = await repository.getThemeMetadata('non-existent');

      assert.strictEqual(result, null);
    });
  });

  describe('updateThemeMetadata', () => {
    it('should update name and schemaId', async () => {
      const existingMeta = {
        id: 'theme-1',
        name: 'Old Name',
        schemaId: 'schema-1',
        createdAt: '2026-03-07T10:00:00Z',
        updatedAt: '2026-03-07T10:00:00Z',
      };

      mockClient.hget.mock.mockImplementationOnce(
        async () => JSON.stringify(existingMeta)
      );

      await repository.updateThemeMetadata('theme-1', {
        name: 'New Name',
        schemaId: 'schema-2',
      });

      const [key, fields] = mockClient.hset.mock.calls[0].arguments;
      assert.strictEqual(key, 'theme:theme-1');

      const updatedMeta = JSON.parse(fields.__meta__);
      assert.strictEqual(updatedMeta.name, 'New Name');
      assert.strictEqual(updatedMeta.schemaId, 'schema-2');
      assert.notStrictEqual(updatedMeta.updatedAt, existingMeta.updatedAt);
    });

    it('should update only specified fields', async () => {
      const existingMeta = {
        id: 'theme-1',
        name: 'Old Name',
        schemaId: 'schema-1',
        createdAt: '2026-03-07T10:00:00Z',
        updatedAt: '2026-03-07T10:00:00Z',
      };

      mockClient.hget.mock.mockImplementationOnce(
        async () => JSON.stringify(existingMeta)
      );

      await repository.updateThemeMetadata('theme-1', {
        name: 'New Name',
      });

      const [, fields] = mockClient.hset.mock.calls[0].arguments;
      const updatedMeta = JSON.parse(fields.__meta__);
      assert.strictEqual(updatedMeta.name, 'New Name');
      assert.strictEqual(updatedMeta.schemaId, 'schema-1'); // unchanged
    });

    it('should throw error if theme does not exist', async () => {
      mockClient.hget.mock.mockImplementationOnce(async () => null);

      await assert.rejects(
        async () => repository.updateThemeMetadata('non-existent', { name: 'New' }),
        /not found/
      );
    });
  });

  describe('listThemeIdsBySchemaId', () => {
    it('should return empty array when no themes reference the schema', async () => {
      mockClient.scan.mock.mockImplementation(async () => ['0', []]);

      const ids = await repository.listThemeIdsBySchemaId('schema-1');

      assert.strictEqual(ids.length, 0);
      assert.deepStrictEqual(ids, []);
    });

    it('should find themes that reference the schema', async () => {
      // Mock SCAN to return theme keys
      mockClient.scan.mock.mockImplementation(async () => [
        '0',
        ['theme:theme-1', 'theme:theme-2', 'theme:theme-3'],
      ]);

      // Mock metadata retrieval
      mockClient.hget.mock.mockImplementation(async (key: string) => {
        if (key === 'theme:theme-1') {
          return JSON.stringify({
            id: 'theme-1',
            name: 'Theme 1',
            schemaId: 'schema-1',
            createdAt: '2026-03-07T10:00:00Z',
            updatedAt: '2026-03-07T10:00:00Z',
          });
        } else if (key === 'theme:theme-2') {
          return JSON.stringify({
            id: 'theme-2',
            name: 'Theme 2',
            schemaId: 'schema-2', // different schema
            createdAt: '2026-03-07T10:00:00Z',
            updatedAt: '2026-03-07T10:00:00Z',
          });
        } else if (key === 'theme:theme-3') {
          return JSON.stringify({
            id: 'theme-3',
            name: 'Theme 3',
            schemaId: 'schema-1', // same schema
            createdAt: '2026-03-07T10:00:00Z',
            updatedAt: '2026-03-07T10:00:00Z',
          });
        }
        return null;
      });

      const ids = await repository.listThemeIdsBySchemaId('schema-1');

      assert.strictEqual(ids.length, 2);
      assert.deepStrictEqual(ids, ['theme-1', 'theme-3']);
    });

    it('should handle themes without schemaId', async () => {
      // Mock SCAN to return theme keys
      mockClient.scan.mock.mockImplementation(async () => [
        '0',
        ['theme:theme-1', 'theme:theme-2'],
      ]);

      // Mock metadata retrieval - one with schema, one without
      mockClient.hget.mock.mockImplementation(async (key: string) => {
        if (key === 'theme:theme-1') {
          return JSON.stringify({
            id: 'theme-1',
            name: 'Theme 1',
            schemaId: 'schema-1',
            createdAt: '2026-03-07T10:00:00Z',
            updatedAt: '2026-03-07T10:00:00Z',
          });
        } else if (key === 'theme:theme-2') {
          return JSON.stringify({
            id: 'theme-2',
            name: 'Theme 2',
            // no schemaId
            createdAt: '2026-03-07T10:00:00Z',
            updatedAt: '2026-03-07T10:00:00Z',
          });
        }
        return null;
      });

      const ids = await repository.listThemeIdsBySchemaId('schema-1');

      assert.strictEqual(ids.length, 1);
      assert.deepStrictEqual(ids, ['theme-1']);
    });

    it('should handle multiple SCAN batches', async () => {
      // Mock SCAN to return results in two batches
      let callCount = 0;
      mockClient.scan.mock.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return ['5', ['theme:theme-1', 'theme:theme-2']];
        } else {
          return ['0', ['theme:theme-3']];
        }
      });

      // Mock metadata retrieval - all reference schema-1
      mockClient.hget.mock.mockImplementation(async (key: string) => {
        const themeId = key.replace('theme:', '');
        return JSON.stringify({
          id: themeId,
          name: `Theme ${themeId}`,
          schemaId: 'schema-1',
          createdAt: '2026-03-07T10:00:00Z',
          updatedAt: '2026-03-07T10:00:00Z',
        });
      });

      const ids = await repository.listThemeIdsBySchemaId('schema-1');

      assert.strictEqual(ids.length, 3);
      assert.deepStrictEqual(ids, ['theme-1', 'theme-2', 'theme-3']);
    });
  });
});
