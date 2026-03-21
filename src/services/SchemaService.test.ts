/**
 * Test suite for SchemaService
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { SchemaService } from './SchemaService.js';
import type { ISchemaRepository } from '../storage/ISchemaRepository.js';
import type { StoredSchema } from '../types/storage.js';
import type { CreateSchemaRequest, UpdateSchemaRequest } from '../types/api.js';

describe('SchemaService', () => {
  let service: SchemaService;
  let mockRepo: ISchemaRepository;

  beforeEach(() => {
    // Create mock repository
    mockRepo = {
      saveSchema: mock.fn(async () => { }),
      getSchema: mock.fn(async () => null),
      deleteSchema: mock.fn(async () => false),
      exists: mock.fn(async () => false),
      listSchemaIds: mock.fn(async () => []),
      updateSchema: mock.fn(async () => { }),
    };

    service = new SchemaService(mockRepo);
  });

  describe('createSchema', () => {
    it('should create schema with name-based ID', async () => {
      const request: CreateSchemaRequest = {
        name: 'Test Schema',
        variables: {
          '--color': {
            description: 'Primary color',
            allowedTypes: ['color'],
            defaultType: 'color',
            defaultValue: '#000',
          },
        },
      };

      const result = await service.createSchema(request);

      assert.strictEqual(result.name, 'Test Schema');
      assert.ok(result.id.startsWith('test-schema-'));
      assert.strictEqual(Object.keys(result.variables).length, 1);
      assert.strictEqual(result.variables['--color']?.description, 'Primary color');
      assert.deepStrictEqual(result.variables['--color']?.allowedTypes, ['color']);
      assert.strictEqual((mockRepo.saveSchema as any).mock.calls.length, 1);
    });

    it('should create schema with version', async () => {
      const request: CreateSchemaRequest = {
        name: 'Versioned Schema',
        version: '1.0.0',
        variables: {},
      };

      const result = await service.createSchema(request);

      assert.strictEqual(result.name, 'Versioned Schema');
      assert.strictEqual(result.version, '1.0.0');
    });

    it('should create schema without version', async () => {
      const request: CreateSchemaRequest = {
        name: 'Simple Schema',
        variables: {},
      };

      const result = await service.createSchema(request);

      assert.strictEqual(result.name, 'Simple Schema');
      assert.strictEqual(result.version, undefined);
    });

    it('should generate fallback ID for empty name', async () => {
      const request: CreateSchemaRequest = {
        name: '',
        variables: {},
      };

      const result = await service.createSchema(request);

      assert.ok(result.id.startsWith('schema-'));
      assert.strictEqual(result.name, '');
    });

    it('should handle special characters in name', async () => {
      const request: CreateSchemaRequest = {
        name: 'My Schema @ 2026!',
        variables: {},
      };

      const result = await service.createSchema(request);

      // Should be slugified: removes non-alphanumeric except dashes
      assert.ok(result.id.startsWith('my-schema'));
      assert.ok(!result.id.includes('@'));
      assert.ok(!result.id.includes('!'));
      assert.ok(!result.id.includes(' '));
    });

    it('should save schema with complex variables', async () => {
      const request: CreateSchemaRequest = {
        name: 'Complex Schema',
        variables: {
          '--primary-color': {
            description: 'The primary brand color',
            allowedTypes: ['color', 'gradient'],
            defaultType: 'color',
            defaultValue: '#3498db',
            required: true,
            validation: {
              pattern: '^#[0-9a-fA-F]{6}$',
            },
          },
          '--font-size': {
            description: 'Base font size',
            allowedTypes: ['dimension'],
            defaultType: 'dimension',
            defaultValue: '16px',
            validation: {
              enum: ['12px', '14px', '16px', '18px'],
            },
          },
        },
      };

      const result = await service.createSchema(request);

      assert.strictEqual(Object.keys(result.variables).length, 2);
      assert.strictEqual(result.variables['--primary-color']?.required, true);
      assert.strictEqual(result.variables['--primary-color']?.validation?.pattern, '^#[0-9a-fA-F]{6}$');
      assert.deepStrictEqual(result.variables['--font-size']?.validation?.enum, ['12px', '14px', '16px', '18px']);
    });
  });

  describe('getSchema', () => {
    it('should retrieve schema', async () => {
      const storedSchema: StoredSchema = {
        id: 'schema-1',
        name: 'Test Schema',
        version: '1.0.0',
        variables: {
          '--color': {
            description: 'Color',
            allowedTypes: ['color'],
          },
        },
      };

      (mockRepo.getSchema as any).mock.mockImplementationOnce(async () => storedSchema);

      const result = await service.getSchema('schema-1');

      assert.ok(result);
      assert.strictEqual(result.id, 'schema-1');
      assert.strictEqual(result.name, 'Test Schema');
      assert.strictEqual(result.version, '1.0.0');
      assert.strictEqual(Object.keys(result.variables).length, 1);
    });

    it('should return null for non-existent schema', async () => {
      (mockRepo.getSchema as any).mock.mockImplementationOnce(async () => null);

      const result = await service.getSchema('non-existent');

      assert.strictEqual(result, null);
    });
  });

  describe('updateSchema', () => {
    it('should update schema name', async () => {
      const existing: StoredSchema = {
        id: 'schema-1',
        name: 'Old Name',
        variables: {},
      };

      (mockRepo.getSchema as any).mock.mockImplementationOnce(async () => existing);

      const request: UpdateSchemaRequest = {
        name: 'New Name',
      };

      const result = await service.updateSchema('schema-1', request);

      assert.ok(result);
      assert.strictEqual(result.name, 'New Name');
      assert.strictEqual(result.id, 'schema-1');
      assert.strictEqual((mockRepo.updateSchema as any).mock.calls.length, 1);
    });

    it('should update schema version', async () => {
      const existing: StoredSchema = {
        id: 'schema-1',
        name: 'Test Schema',
        version: '1.0.0',
        variables: {},
      };

      (mockRepo.getSchema as any).mock.mockImplementationOnce(async () => existing);

      const request: UpdateSchemaRequest = {
        version: '2.0.0',
      };

      const result = await service.updateSchema('schema-1', request);

      assert.ok(result);
      assert.strictEqual(result.version, '2.0.0');
    });

    it('should update schema variables', async () => {
      const existing: StoredSchema = {
        id: 'schema-1',
        name: 'Test Schema',
        variables: {
          '--old': {
            description: 'Old var',
            allowedTypes: ['string'],
          },
        },
      };

      (mockRepo.getSchema as any).mock.mockImplementationOnce(async () => existing);

      const request: UpdateSchemaRequest = {
        variables: {
          '--new': {
            description: 'New var',
            allowedTypes: ['color'],
          },
        },
      };

      const result = await service.updateSchema('schema-1', request);

      assert.ok(result);
      assert.strictEqual(Object.keys(result.variables).length, 1);
      assert.strictEqual(result.variables['--new']?.description, 'New var');
      assert.strictEqual(result.variables['--old'], undefined);
    });

    it('should update multiple fields at once', async () => {
      const existing: StoredSchema = {
        id: 'schema-1',
        name: 'Old',
        version: '1.0.0',
        variables: {},
      };

      (mockRepo.getSchema as any).mock.mockImplementationOnce(async () => existing);

      const request: UpdateSchemaRequest = {
        name: 'New',
        version: '2.0.0',
        variables: {
          '--var': {
            description: 'A variable',
            allowedTypes: ['string'],
          },
        },
      };

      const result = await service.updateSchema('schema-1', request);

      assert.ok(result);
      assert.strictEqual(result.name, 'New');
      assert.strictEqual(result.version, '2.0.0');
      assert.strictEqual(Object.keys(result.variables).length, 1);
    });

    it('should return null for non-existent schema', async () => {
      (mockRepo.getSchema as any).mock.mockImplementationOnce(async () => null);

      const request: UpdateSchemaRequest = {
        name: 'New Name',
      };

      const result = await service.updateSchema('non-existent', request);

      assert.strictEqual(result, null);
      assert.strictEqual((mockRepo.updateSchema as any).mock.calls.length, 0);
    });

    it('should preserve existing fields when not updated', async () => {
      const existing: StoredSchema = {
        id: 'schema-1',
        name: 'Original Name',
        version: '1.0.0',
        variables: {
          '--color': {
            description: 'Color',
            allowedTypes: ['color'],
          },
        },
      };

      (mockRepo.getSchema as any).mock.mockImplementationOnce(async () => existing);

      const request: UpdateSchemaRequest = {
        version: '1.1.0',
      };

      const result = await service.updateSchema('schema-1', request);

      assert.ok(result);
      assert.strictEqual(result.name, 'Original Name');
      assert.strictEqual(result.version, '1.1.0');
      assert.strictEqual(Object.keys(result.variables).length, 1);
    });
  });

  describe('deleteSchema', () => {
    it('should delete schema', async () => {
      (mockRepo.deleteSchema as any).mock.mockImplementationOnce(async () => true);

      const result = await service.deleteSchema('schema-1');

      assert.strictEqual(result, true);
      assert.strictEqual((mockRepo.deleteSchema as any).mock.calls.length, 1);
    });

    it('should return false if schema does not exist', async () => {
      (mockRepo.deleteSchema as any).mock.mockImplementationOnce(async () => false);

      const result = await service.deleteSchema('non-existent');

      assert.strictEqual(result, false);
    });
  });

  describe('listSchemas', () => {
    it('should list schema summaries', async () => {
      const getSchemaFn = mockRepo.getSchema as any;

      (mockRepo.listSchemaIds as any).mock.mockImplementationOnce(async () => ['schema-1', 'schema-2']);

      let callCount = 0;
      getSchemaFn.mock.mockImplementation(async () => {
        if (callCount === 0) {
          callCount++;
          return {
            id: 'schema-1',
            name: 'Schema One',
            version: '1.0.0',
            variables: {
              '--a': { description: 'A', allowedTypes: ['string'] },
              '--b': { description: 'B', allowedTypes: ['color'] },
            },
          };
        } else {
          return {
            id: 'schema-2',
            name: 'Schema Two',
            variables: {},
          };
        }
      });

      const result = await service.listSchemas();

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0]?.id, 'schema-1');
      assert.strictEqual(result[0]?.name, 'Schema One');
      assert.strictEqual(result[0]?.version, '1.0.0');
      assert.strictEqual(result[0]?.variableCount, 2);
      assert.strictEqual(result[1]?.id, 'schema-2');
      assert.strictEqual(result[1]?.name, 'Schema Two');
      assert.strictEqual(result[1]?.version, undefined);
      assert.strictEqual(result[1]?.variableCount, 0);
    });

    it('should handle empty list', async () => {
      (mockRepo.listSchemaIds as any).mock.mockImplementationOnce(async () => []);

      const result = await service.listSchemas();

      assert.strictEqual(result.length, 0);
    });

    it('should skip null schemas', async () => {
      const getSchemaFn = mockRepo.getSchema as any;

      (mockRepo.listSchemaIds as any).mock.mockImplementationOnce(async () => ['schema-1', 'schema-2']);

      let callCount = 0;
      getSchemaFn.mock.mockImplementation(async () => {
        if (callCount === 0) {
          callCount++;
          return {
            id: 'schema-1',
            name: 'Schema One',
            variables: {},
          };
        }
        return null;
      });

      const result = await service.listSchemas();

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0]?.id, 'schema-1');
    });
  });
});
