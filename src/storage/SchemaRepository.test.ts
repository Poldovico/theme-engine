/**
 * Test suite for SchemaRepository
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { SchemaRepository } from './SchemaRepository.js';
import type { StoredSchema } from '../types/storage.js';

describe('SchemaRepository', () => {
  let repository: SchemaRepository;
  let mockClient: any;

  beforeEach(() => {
    // Create mock Valkey client
    mockClient = {
      set: mock.fn(async () => 'OK'),
      get: mock.fn(async () => null),
      del: mock.fn(async () => 0),
      exists: mock.fn(async () => 0),
      scan: mock.fn(async () => ['0', []]),
    };

    repository = new SchemaRepository(mockClient);
  });

  describe('saveSchema', () => {
    it('should save schema as JSON string', async () => {
      const schema: StoredSchema = {
        id: 'schema-1',
        name: 'Color Theme Schema',
        version: '1.0.0',
        variables: {
          '--primary-color': {
            description: 'Main brand color',
            allowedTypes: ['color', 'string'],
            defaultType: 'color',
            defaultValue: '#3498db',
            validation: {
              pattern: '^#[0-9a-f]{6}$',
            },
          },
          '--font-size': {
            description: 'Base font size',
            allowedTypes: ['dimension'],
            defaultType: 'dimension',
            defaultValue: '16px',
          },
        },
      };

      await repository.saveSchema(schema);

      // Verify set was called with correct key and value
      assert.strictEqual(mockClient.set.mock.calls.length, 1);
      const [key, value] = mockClient.set.mock.calls[0].arguments;
      assert.strictEqual(key, 'schema:schema-1');

      // Verify JSON serialization
      const parsed = JSON.parse(value);
      assert.strictEqual(parsed.id, 'schema-1');
      assert.strictEqual(parsed.name, 'Color Theme Schema');
      assert.strictEqual(parsed.version, '1.0.0');
      assert.strictEqual(Object.keys(parsed.variables).length, 2);
      assert.strictEqual(parsed.variables['--primary-color'].description, 'Main brand color');
    });

    it('should save schema without optional fields', async () => {
      const schema: StoredSchema = {
        id: 'schema-2',
        name: 'Simple Schema',
        variables: {
          '--color': {
            description: 'A color',
            allowedTypes: ['color'],
          },
        },
      };

      await repository.saveSchema(schema);

      const [, value] = mockClient.set.mock.calls[0].arguments;
      const parsed = JSON.parse(value);
      assert.strictEqual(parsed.version, undefined);
      assert.strictEqual(parsed.variables['--color'].defaultValue, undefined);
    });
  });

  describe('getSchema', () => {
    it('should retrieve and parse schema correctly', async () => {
      const schemaData = {
        id: 'schema-1',
        name: 'Test Schema',
        variables: {
          '--primary-color': {
            description: 'Primary color',
            allowedTypes: ['color'],
            defaultValue: '#000000',
          },
        },
      };

      mockClient.get.mock.mockImplementationOnce(
        async () => JSON.stringify(schemaData)
      );

      const schema = await repository.getSchema('schema-1');

      assert.ok(schema);
      assert.strictEqual(schema.id, 'schema-1');
      assert.strictEqual(schema.name, 'Test Schema');
      assert.strictEqual(Object.keys(schema.variables).length, 1);

      const primaryColor = schema.variables['--primary-color'];
      assert.ok(primaryColor);
      assert.strictEqual(primaryColor.description, 'Primary color');

      // Verify correct key was used
      const [key] = mockClient.get.mock.calls[0].arguments;
      assert.strictEqual(key, 'schema:schema-1');
    });

    it('should return null for non-existent schema', async () => {
      mockClient.get.mock.mockImplementationOnce(async () => null);

      const schema = await repository.getSchema('non-existent');

      assert.strictEqual(schema, null);
    });

    it('should handle Buffer response from Valkey', async () => {
      const schemaData = {
        id: 'schema-1',
        name: 'Test Schema',
        variables: {},
      };

      const buffer = Buffer.from(JSON.stringify(schemaData));
      mockClient.get.mock.mockImplementationOnce(async () => buffer);

      const schema = await repository.getSchema('schema-1');

      assert.ok(schema);
      assert.strictEqual(schema.id, 'schema-1');
    });
  });

  describe('deleteSchema', () => {
    it('should delete schema', async () => {
      mockClient.del.mock.mockImplementationOnce(async () => 1);

      const result = await repository.deleteSchema('schema-1');

      assert.strictEqual(result, true);
      const [keys] = mockClient.del.mock.calls[0].arguments;
      assert.deepStrictEqual(keys, ['schema:schema-1']);
    });

    it('should return false if schema does not exist', async () => {
      mockClient.del.mock.mockImplementationOnce(async () => 0);

      const result = await repository.deleteSchema('non-existent');

      assert.strictEqual(result, false);
    });
  });

  describe('exists', () => {
    it('should return true if schema exists', async () => {
      mockClient.exists.mock.mockImplementationOnce(async () => 1);

      const result = await repository.exists('schema-1');

      assert.strictEqual(result, true);
      const [keys] = mockClient.exists.mock.calls[0].arguments;
      assert.deepStrictEqual(keys, ['schema:schema-1']);
    });

    it('should return false if schema does not exist', async () => {
      mockClient.exists.mock.mockImplementationOnce(async () => 0);

      const result = await repository.exists('non-existent');

      assert.strictEqual(result, false);
    });
  });

  describe('listSchemaIds', () => {
    it('should list all schema IDs using SCAN', async () => {
      // Mock SCAN to return results in two batches
      let callCount = 0;
      mockClient.scan.mock.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return ['5', ['schema:schema-1', 'schema:schema-2']];
        } else {
          return ['0', ['schema:schema-3']];
        }
      });

      const ids = await repository.listSchemaIds();

      assert.strictEqual(ids.length, 3);
      assert.deepStrictEqual(ids, ['schema-1', 'schema-2', 'schema-3']);
    });

    it('should handle empty result', async () => {
      mockClient.scan.mock.mockImplementation(async () => ['0', []]);

      const ids = await repository.listSchemaIds();

      assert.strictEqual(ids.length, 0);
    });

    it('should handle Buffer keys from SCAN', async () => {
      const buffer1 = Buffer.from('schema:schema-1');
      const buffer2 = Buffer.from('schema:schema-2');

      mockClient.scan.mock.mockImplementation(async () => ['0', [buffer1, buffer2]]);

      const ids = await repository.listSchemaIds();

      assert.strictEqual(ids.length, 2);
      assert.deepStrictEqual(ids, ['schema-1', 'schema-2']);
    });
  });

  describe('updateSchema', () => {
    it('should update entire schema', async () => {
      const schema: StoredSchema = {
        id: 'schema-1',
        name: 'Updated Schema',
        variables: {
          '--new-var': {
            description: 'New variable',
            allowedTypes: ['string'],
          },
        },
      };

      await repository.updateSchema(schema);

      assert.strictEqual(mockClient.set.mock.calls.length, 1);
      const [key, value] = mockClient.set.mock.calls[0].arguments;
      assert.strictEqual(key, 'schema:schema-1');

      const parsed = JSON.parse(value);
      assert.strictEqual(parsed.name, 'Updated Schema');
      assert.ok(parsed.variables['--new-var']);
    });

    it('should overwrite previous schema data', async () => {
      const schema: StoredSchema = {
        id: 'schema-1',
        name: 'New Data',
        variables: {},
      };

      await repository.updateSchema(schema);

      const [, value] = mockClient.set.mock.calls[0].arguments;
      const parsed = JSON.parse(value);
      // Should not contain old data, only new data
      assert.strictEqual(Object.keys(parsed.variables).length, 0);
    });
  });
});
