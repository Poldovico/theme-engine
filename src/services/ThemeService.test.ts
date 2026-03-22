/**
 * Test suite for ThemeService
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { ThemeService } from './ThemeService.js';
import type { IThemeRepository } from '../storage/IThemeRepository.js';
import type { ISchemaRepository } from '../storage/ISchemaRepository.js';
import type { StoredTheme, StoredVariable, StoredSchema } from '../types/storage.js';
import type { CreateThemeRequest, UpdateThemeRequest, VariableUpdate } from '../types/api.js';

describe('ThemeService', () => {
  let service: ThemeService;
  let mockThemeRepo: IThemeRepository;
  let mockSchemaRepo: ISchemaRepository;

  beforeEach(() => {
    // Create mock repositories
    mockThemeRepo = {
      saveTheme: mock.fn(async () => { }),
      getTheme: mock.fn(async () => null),
      getVariable: mock.fn(async () => null),
      setVariable: mock.fn(async () => ({
        variable: { value: '', type: 'string' },
      })),
      setVariables: mock.fn(async () => { }),
      deleteVariable: mock.fn(async () => false),
      deleteTheme: mock.fn(async () => false),
      exists: mock.fn(async () => false),
      listThemeIds: mock.fn(async () => []),
      listThemeIdsBySchemaId: mock.fn(async () => []),
      getThemeMetadata: mock.fn(async () => null),
      updateThemeMetadata: mock.fn(async () => { }),
    };

    mockSchemaRepo = {
      saveSchema: mock.fn(async () => { }),
      getSchema: mock.fn(async () => null),
      deleteSchema: mock.fn(async () => false),
      exists: mock.fn(async () => false),
      listSchemaIds: mock.fn(async () => []),
      updateSchema: mock.fn(async () => { }),
    };

    service = new ThemeService(mockThemeRepo, mockSchemaRepo);
  });

  describe('createTheme', () => {
    it('should create theme with provided variables', async () => {
      const request: CreateThemeRequest = {
        name: 'Test Theme',
        variables: {
          '--color': { value: '#fff', type: 'color' },
        },
      };

      const result = await service.createTheme(request);

      assert.strictEqual(result.name, 'Test Theme');
      assert.ok(result.id.startsWith('test-theme-'));
      assert.strictEqual(Object.keys(result.variables).length, 1);
      assert.strictEqual(result.variables['--color']?.value, '#fff');
      assert.strictEqual(result.variables['--color']?.type, 'color');
      assert.ok(result.createdAt);
      assert.ok(result.updatedAt);

      // Verify saveTheme was called
      assert.strictEqual((mockThemeRepo.saveTheme as any).mock.calls.length, 1);
    });

    it('should create theme without variables', async () => {
      const request: CreateThemeRequest = {
        name: 'Empty Theme',
      };

      const result = await service.createTheme(request);

      assert.strictEqual(result.name, 'Empty Theme');
      assert.strictEqual(Object.keys(result.variables).length, 0);
    });

    it('should create theme with schema defaults', async () => {
      const schema: StoredSchema = {
        id: 'schema-1',
        name: 'Test Schema',
        variables: {
          '--primary': {
            description: 'Primary color',
            allowedTypes: ['color'],
            defaultType: 'color',
            defaultValue: '#000',
          },
          '--secondary': {
            description: 'Secondary color',
            allowedTypes: ['color'],
            defaultType: 'color',
            defaultValue: '#fff',
          },
        },
      };

      (mockSchemaRepo.getSchema as any).mock.mockImplementationOnce(async () => schema);

      const request: CreateThemeRequest = {
        name: 'Themed',
        schemaId: 'schema-1',
        variables: {
          '--primary': { value: '#f00', type: 'color' },
        },
      };

      const result = await service.createTheme(request);

      // Should have provided variable + schema default
      assert.strictEqual(Object.keys(result.variables).length, 2);
      assert.strictEqual(result.variables['--primary']?.value, '#f00');
      assert.strictEqual(result.variables['--secondary']?.value, '#fff');
    });

    it('should merge schema metadata when schemaId is provided', async () => {
      const schema: StoredSchema = {
        id: 'schema-1',
        name: 'Test Schema',
        variables: {
          '--color': {
            description: 'A color',
            allowedTypes: ['color'],
            defaultType: 'color',
          },
        },
      };

      // Mock getSchema twice: once for defaults and once for merging
      (mockSchemaRepo.getSchema as any).mock.mockImplementation(async () => schema);

      const request: CreateThemeRequest = {
        name: 'Test',
        schemaId: 'schema-1',
        variables: {
          '--color': { value: '#abc', type: 'color' },
        },
      };

      const result = await service.createTheme(request);

      // Variable should have schema metadata merged
      assert.strictEqual(result.variables['--color']?.description, 'A color');
      assert.deepStrictEqual(result.variables['--color']?.allowedTypes, ['color']);
    });

    it('should handle schemaId without existing schema gracefully', async () => {
      (mockSchemaRepo.getSchema as any).mock.mockImplementationOnce(async () => null);

      const request: CreateThemeRequest = {
        name: 'Test',
        schemaId: 'non-existent',
      };

      const result = await service.createTheme(request);

      assert.strictEqual(result.name, 'Test');
      assert.strictEqual(Object.keys(result.variables).length, 0);
    });
  });

  describe('getTheme', () => {
    it('should retrieve theme and merge schema metadata', async () => {
      const storedTheme: StoredTheme = {
        id: 'theme-1',
        name: 'Test Theme',
        schemaId: 'schema-1',
        variables: {
          '--color': {
            value: '#fff',
            type: 'color',
            lastModified: '2026-03-07T10:00:00Z',
          },
        },
        createdAt: '2026-03-07T10:00:00Z',
        updatedAt: '2026-03-07T10:00:00Z',
      };

      const schema: StoredSchema = {
        id: 'schema-1',
        name: 'Test Schema',
        variables: {
          '--color': {
            description: 'Primary color',
            allowedTypes: ['color'],
            defaultType: 'color',
          },
        },
      };

      (mockThemeRepo.getTheme as any).mock.mockImplementationOnce(async () => storedTheme);
      (mockSchemaRepo.getSchema as any).mock.mockImplementationOnce(async () => schema);

      const result = await service.getTheme('theme-1');

      assert.ok(result);
      assert.strictEqual(result.name, 'Test Theme');
      assert.strictEqual(result.variables['--color']?.value, '#fff');
      assert.strictEqual(result.variables['--color']?.description, 'Primary color');
      assert.deepStrictEqual(result.variables['--color']?.allowedTypes, ['color']);
    });

    it('should return null for non-existent theme', async () => {
      (mockThemeRepo.getTheme as any).mock.mockImplementationOnce(async () => null);

      const result = await service.getTheme('non-existent');

      assert.strictEqual(result, null);
    });

    it('should work without schema', async () => {
      const storedTheme: StoredTheme = {
        id: 'theme-1',
        name: 'Test Theme',
        variables: {
          '--color': {
            value: '#fff',
            type: 'color',
          },
        },
        createdAt: '2026-03-07T10:00:00Z',
        updatedAt: '2026-03-07T10:00:00Z',
      };

      (mockThemeRepo.getTheme as any).mock.mockImplementationOnce(async () => storedTheme);

      const result = await service.getTheme('theme-1');

      assert.ok(result);
      assert.strictEqual(result.variables['--color']?.value, '#fff');
      assert.strictEqual(result.variables['--color']?.description, undefined);
    });
  });

  describe('getVariable', () => {
    it('should retrieve variable with schema metadata', async () => {
      const storedVariable: StoredVariable = {
        value: '#fff',
        type: 'color',
        lastModified: '2026-03-07T10:00:00Z',
      };

      const storedTheme: StoredTheme = {
        id: 'theme-1',
        name: 'Test',
        schemaId: 'schema-1',
        variables: { '--color': storedVariable },
        createdAt: '2026-03-07T10:00:00Z',
        updatedAt: '2026-03-07T10:00:00Z',
      };

      const schema: StoredSchema = {
        id: 'schema-1',
        name: 'Test Schema',
        variables: {
          '--color': {
            description: 'Primary color',
            allowedTypes: ['color'],
          },
        },
      };

      (mockThemeRepo.getVariable as any).mock.mockImplementationOnce(async () => storedVariable);
      (mockThemeRepo.getTheme as any).mock.mockImplementationOnce(async () => storedTheme);
      (mockSchemaRepo.getSchema as any).mock.mockImplementationOnce(async () => schema);

      const result = await service.getVariable('theme-1', '--color');

      assert.ok(result);
      assert.strictEqual(result.value, '#fff');
      assert.strictEqual(result.description, 'Primary color');
      assert.deepStrictEqual(result.allowedTypes, ['color']);
    });

    it('should return null for non-existent variable', async () => {
      (mockThemeRepo.getVariable as any).mock.mockImplementationOnce(async () => null);

      const result = await service.getVariable('theme-1', '--missing');

      assert.strictEqual(result, null);
    });

    it('should return null if theme does not exist', async () => {
      (mockThemeRepo.getVariable as any).mock.mockImplementationOnce(async () => ({ value: '#fff', type: 'color' }));
      (mockThemeRepo.getTheme as any).mock.mockImplementationOnce(async () => null);

      const result = await service.getVariable('theme-1', '--color');

      assert.strictEqual(result, null);
    });
  });

  describe('updateTheme', () => {
    it('should update theme metadata', async () => {
      const existingTheme: StoredTheme = {
        id: 'theme-1',
        name: 'Old Name',
        variables: {},
        createdAt: '2026-03-07T10:00:00Z',
        updatedAt: '2026-03-07T10:00:00Z',
      };

      const updatedTheme: StoredTheme = {
        ...existingTheme,
        name: 'New Name',
        schemaId: 'schema-1',
      };

      const getThemeFn = mockThemeRepo.getTheme as any;
      let callCount = 0;
      getThemeFn.mock.mockImplementation(async () => {
        if (callCount === 0) {
          callCount++;
          return existingTheme;
        }
        return updatedTheme;
      });

      const request: UpdateThemeRequest = {
        name: 'New Name',
        schemaId: 'schema-1',
      };

      const result = await service.updateTheme('theme-1', request);

      assert.ok(result);
      assert.strictEqual(result.name, 'New Name');
      assert.strictEqual((mockThemeRepo.updateThemeMetadata as any).mock.calls.length, 1);
    });

    it('should update theme variables', async () => {
      const existingTheme: StoredTheme = {
        id: 'theme-1',
        name: 'Test',
        variables: { '--old': { value: '#000', type: 'color' } },
        createdAt: '2026-03-07T10:00:00Z',
        updatedAt: '2026-03-07T10:00:00Z',
      };

      const getThemeFn = mockThemeRepo.getTheme as any;
      let callCount = 0;
      getThemeFn.mock.mockImplementation(async () => {
        if (callCount === 0) {
          callCount++;
          return existingTheme;
        }
        return {
          ...existingTheme,
          variables: { '--new': { value: '#fff', type: 'color' } },
        };
      });

      const request: UpdateThemeRequest = {
        variables: {
          '--new': { value: '#fff', type: 'color' },
        },
      };

      const result = await service.updateTheme('theme-1', request);

      assert.ok(result);
      assert.strictEqual((mockThemeRepo.setVariables as any).mock.calls.length, 1);
    });

    it('should return null for non-existent theme', async () => {
      (mockThemeRepo.getTheme as any).mock.mockImplementationOnce(async () => null);

      const result = await service.updateTheme('non-existent', { name: 'New' });

      assert.strictEqual(result, null);
    });
  });

  describe('setVariable', () => {
    it('should set variable and merge with schema', async () => {
      const schema: StoredSchema = {
        id: 'schema-1',
        name: 'Test Schema',
        variables: {
          '--color': {
            description: 'Color var',
            allowedTypes: ['color'],
          },
        },
      };

      (mockThemeRepo.setVariable as any).mock.mockImplementationOnce(async () => ({
        variable: { value: '#fff', type: 'color', lastModified: '2026-03-07T10:00:00Z' },
        schemaId: 'schema-1',
      }));
      (mockSchemaRepo.getSchema as any).mock.mockImplementationOnce(async () => schema);

      const update: VariableUpdate = {
        value: '#fff',
        type: 'color',
      };

      const result = await service.setVariable('theme-1', '--color', update);

      assert.ok(result);
      assert.strictEqual(result.value, '#fff');
      assert.strictEqual(result.description, 'Color var');
      assert.strictEqual((mockThemeRepo.setVariable as any).mock.calls.length, 1);
    });

    it('should default type to string if not provided', async () => {
      const theme: StoredTheme = {
        id: 'theme-1',
        name: 'Test',
        variables: {},
        createdAt: '2026-03-07T10:00:00Z',
        updatedAt: '2026-03-07T10:00:00Z',
      };

      (mockThemeRepo.getTheme as any).mock.mockImplementationOnce(async () => theme);

      const update: VariableUpdate = {
        value: 'some value',
      };

      await service.setVariable('theme-1', '--var', update);

      const [, , storedVar] = (mockThemeRepo.setVariable as any).mock.calls[0].arguments;
      assert.strictEqual(storedVar.type, 'string');
    });
  });

  describe('deleteVariable', () => {
    it('should delete variable', async () => {
      (mockThemeRepo.deleteVariable as any).mock.mockImplementationOnce(async () => true);

      const result = await service.deleteVariable('theme-1', '--color');

      assert.strictEqual(result, true);
      assert.strictEqual((mockThemeRepo.deleteVariable as any).mock.calls.length, 1);
    });

    it('should return false if variable does not exist', async () => {
      (mockThemeRepo.deleteVariable as any).mock.mockImplementationOnce(async () => false);

      const result = await service.deleteVariable('theme-1', '--missing');

      assert.strictEqual(result, false);
    });
  });

  describe('deleteTheme', () => {
    it('should delete theme', async () => {
      (mockThemeRepo.deleteTheme as any).mock.mockImplementationOnce(async () => true);

      const result = await service.deleteTheme('theme-1');

      assert.strictEqual(result, true);
      assert.strictEqual((mockThemeRepo.deleteTheme as any).mock.calls.length, 1);
    });

    it('should return false if theme does not exist', async () => {
      (mockThemeRepo.deleteTheme as any).mock.mockImplementationOnce(async () => false);

      const result = await service.deleteTheme('non-existent');

      assert.strictEqual(result, false);
    });
  });

  describe('listThemes', () => {
    it('should list theme summaries', async () => {
      const getMetadataFn = mockThemeRepo.getThemeMetadata as any;
      const getThemeFn = mockThemeRepo.getTheme as any;

      (mockThemeRepo.listThemeIds as any).mock.mockImplementationOnce(async () => ['theme-1', 'theme-2']);

      let metadataCallCount = 0;
      getMetadataFn.mock.mockImplementation(async () => {
        if (metadataCallCount === 0) {
          metadataCallCount++;
          return {
            id: 'theme-1',
            name: 'Theme 1',
            schemaId: 'schema-1',
            createdAt: '2026-03-07T10:00:00Z',
            updatedAt: '2026-03-07T10:00:00Z',
          };
        }
        return {
          id: 'theme-2',
          name: 'Theme 2',
          createdAt: '2026-03-07T11:00:00Z',
          updatedAt: '2026-03-07T11:00:00Z',
        };
      });

      let themeCallCount = 0;
      getThemeFn.mock.mockImplementation(async () => {
        if (themeCallCount === 0) {
          themeCallCount++;
          return {
            id: 'theme-1',
            name: 'Theme 1',
            variables: { '--a': { value: '1', type: 'string' }, '--b': { value: '2', type: 'string' } },
            createdAt: '2026-03-07T10:00:00Z',
            updatedAt: '2026-03-07T10:00:00Z',
          };
        }
        return {
          id: 'theme-2',
          name: 'Theme 2',
          variables: {},
          createdAt: '2026-03-07T11:00:00Z',
          updatedAt: '2026-03-07T11:00:00Z',
        };
      });

      const result = await service.listThemes();

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0]?.id, 'theme-1');
      assert.strictEqual(result[0]?.name, 'Theme 1');
      assert.strictEqual(result[0]?.schemaId, 'schema-1');
      assert.strictEqual(result[0]?.variableCount, 2);
      assert.strictEqual(result[1]?.id, 'theme-2');
      assert.strictEqual(result[1]?.variableCount, 0);
    });

    it('should handle empty list', async () => {
      (mockThemeRepo.listThemeIds as any).mock.mockImplementationOnce(async () => []);

      const result = await service.listThemes();

      assert.strictEqual(result.length, 0);
    });
  });

  describe('cloneTheme', () => {
    it('should clone theme with new name', async () => {
      const sourceTheme: StoredTheme = {
        id: 'theme-1',
        name: 'Original',
        schemaId: 'schema-1',
        variables: {
          '--color': { value: '#fff', type: 'color', custom: { meta: 'data' } },
        },
        createdAt: '2026-03-07T10:00:00Z',
        updatedAt: '2026-03-07T10:00:00Z',
      };

      (mockThemeRepo.getTheme as any).mock.mockImplementationOnce(async () => sourceTheme);

      const result = await service.cloneTheme('theme-1', 'Cloned Theme');

      assert.ok(result);
      assert.strictEqual(result.name, 'Cloned Theme');
      assert.ok(result.id.startsWith('cloned-theme-'));
      assert.notStrictEqual(result.id, 'theme-1');
      assert.strictEqual(result.variables['--color']?.value, '#fff');
      assert.strictEqual((mockThemeRepo.saveTheme as any).mock.calls.length, 1);
    });

    it('should return null for non-existent source theme', async () => {
      (mockThemeRepo.getTheme as any).mock.mockImplementationOnce(async () => null);

      const result = await service.cloneTheme('non-existent', 'Clone');

      assert.strictEqual(result, null);
    });
  });
});
