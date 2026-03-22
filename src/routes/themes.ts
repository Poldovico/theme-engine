/**
 * Theme routes plugin
 * Handles all CRUD operations for themes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ThemeService } from '../services/ThemeService.js';
import type {
  ApiTheme,
  ThemeSummary,
  CreateThemeRequest,
  UpdateThemeRequest,
  VariableUpdate,
} from '../types/api.js';

interface ThemeRoutesOptions {
  themeService: ThemeService;
}

// JSON Schema definitions for OpenAPI
const storedVariableSchema = {
  type: 'object',
  required: ['value', 'type'],
  properties: {
    value: { type: 'string' },
    type: { type: 'string' },
    custom: { type: 'object' },
  },
};

const apiVariableSchema = {
  type: 'object',
  required: ['name', 'value', 'type'],
  properties: {
    name: { type: 'string' },
    value: { type: 'string' },
    type: { type: 'string' },
    custom: { type: 'object' },
    lastModified: { type: 'string' },
    description: { type: 'string' },
    allowedTypes: { type: 'array', items: { type: 'string' } },
    defaultType: { type: 'string' },
    defaultValue: { type: 'string' },
    validation: {
      type: 'object',
      properties: {
        pattern: { type: 'string' },
        enum: { type: 'array', items: { type: 'string' } },
      },
    },
  },
};

const apiThemeSchema = {
  type: 'object',
  required: ['id', 'name', 'variables', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    schemaId: { type: 'string' },
    variables: {
      type: 'object',
      additionalProperties: apiVariableSchema,
    },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
};

const themeSummarySchema = {
  type: 'object',
  required: ['id', 'name', 'variableCount', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    schemaId: { type: 'string' },
    variableCount: { type: 'integer' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
};

const createThemeRequestSchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string' },
    schemaId: { type: 'string' },
    variables: {
      type: 'object',
      additionalProperties: storedVariableSchema,
    },
  },
};

const updateThemeRequestSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    schemaId: { type: 'string' },
    variables: {
      type: 'object',
      additionalProperties: storedVariableSchema,
    },
  },
};

const variableUpdateSchema = {
  type: 'object',
  required: ['value'],
  properties: {
    value: { type: 'string' },
    type: { type: 'string' },
    custom: { type: 'object' },
  },
};

const cloneThemeRequestSchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', description: 'Name for the cloned theme' },
  },
};

const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
  },
};

export default async function themeRoutes(
  fastify: FastifyInstance,
  options: ThemeRoutesOptions
) {
  const { themeService } = options;

  /**
   * GET /themes
   * List all themes (summaries)
   */
  fastify.get('/themes', {
    schema: {
      tags: ['themes'],
      description: 'List all themes',
      response: {
        200: {
          type: 'array',
          items: themeSummarySchema,
        },
      },
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const summaries: ThemeSummary[] = await themeService.listThemes();
    return reply.send(summaries);
  });

  /**
   * POST /themes
   * Create a new theme
   */
  fastify.post<{ Body: CreateThemeRequest }>('/themes', {
    schema: {
      tags: ['themes'],
      description: 'Create a new theme',
      body: createThemeRequestSchema,
      response: {
        201: apiThemeSchema,
      },
    },
  }, async (request: FastifyRequest<{ Body: CreateThemeRequest }>, reply: FastifyReply) => {
    const theme: ApiTheme = await themeService.createTheme(request.body);
    return reply.code(201).send(theme);
  });

  /**
   * GET /themes/:id
   * Get a theme by ID
   */
  fastify.get<{ Params: { id: string } }>('/themes/:id', {
    schema: {
      tags: ['themes'],
      description: 'Get a theme by ID',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Theme ID' },
        },
      },
      response: {
        200: apiThemeSchema,
        404: errorSchema,
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const theme = await themeService.getTheme(request.params.id);

    if (!theme) {
      return reply.code(404).send({
        error: 'Not Found',
        message: `Theme ${request.params.id} not found`,
      });
    }

    return reply.send(theme);
  });

  /**
   * PUT /themes/:id
   * Update a theme
   */
  fastify.put<{ Params: { id: string }; Body: UpdateThemeRequest }>('/themes/:id', {
    schema: {
      tags: ['themes'],
      description: 'Update a theme',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Theme ID' },
        },
      },
      body: updateThemeRequestSchema,
      response: {
        200: apiThemeSchema,
        404: errorSchema,
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateThemeRequest }>,
    reply: FastifyReply
  ) => {
    const theme = await themeService.updateTheme(request.params.id, request.body);

    if (!theme) {
      return reply.code(404).send({
        error: 'Not Found',
        message: `Theme ${request.params.id} not found`,
      });
    }

    return reply.send(theme);
  });

  /**
   * DELETE /themes/:id
   * Delete a theme
   */
  fastify.delete<{ Params: { id: string } }>('/themes/:id', {
    schema: {
      tags: ['themes'],
      description: 'Delete a theme',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Theme ID' },
        },
      },
      response: {
        204: {
          type: 'null',
          description: 'Theme deleted successfully',
        },
        404: errorSchema,
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const deleted = await themeService.deleteTheme(request.params.id);

    if (!deleted) {
      return reply.code(404).send({
        error: 'Not Found',
        message: `Theme ${request.params.id} not found`,
      });
    }

    return reply.code(204).send();
  });

  /**
   * GET /themes/:id/variables/:name
   * Get a single variable from a theme
   */
  fastify.get<{ Params: { id: string; name: string } }>(
    '/themes/:id/variables/:name',
    {
      schema: {
        tags: ['themes'],
        description: 'Get a single variable from a theme',
        params: {
          type: 'object',
          required: ['id', 'name'],
          properties: {
            id: { type: 'string', description: 'Theme ID' },
            name: { type: 'string', description: 'Variable name' },
          },
        },
        response: {
          200: apiVariableSchema,
          404: errorSchema,
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string; name: string } }>,
      reply: FastifyReply
    ) => {
      const variable = await themeService.getVariable(
        request.params.id,
        request.params.name
      );

      if (!variable) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Variable ${request.params.name} not found in theme ${request.params.id}`,
        });
      }

      return reply.send(variable);
    }
  );

  /**
   * PUT /themes/:id/variables/:name
   * Set a single variable in a theme
   */
  fastify.put<{ Params: { id: string; name: string }; Body: VariableUpdate }>(
    '/themes/:id/variables/:name',
    {
      schema: {
        tags: ['themes'],
        description: 'Set a single variable in a theme',
        params: {
          type: 'object',
          required: ['id', 'name'],
          properties: {
            id: { type: 'string', description: 'Theme ID' },
            name: { type: 'string', description: 'Variable name' },
          },
        },
        body: variableUpdateSchema,
        response: {
          200: apiVariableSchema,
          404: errorSchema,
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string; name: string }; Body: VariableUpdate }>,
      reply: FastifyReply
    ) => {
      const variable = await themeService.setVariable(
        request.params.id,
        request.params.name,
        request.body
      );

      if (!variable) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Theme ${request.params.id} not found`,
        });
      }

      return reply.send(variable);
    }
  );

  /**
   * DELETE /themes/:id/variables/:name
   * Delete a variable from a theme
   */
  fastify.delete<{ Params: { id: string; name: string } }>(
    '/themes/:id/variables/:name',
    {
      schema: {
        tags: ['themes'],
        description: 'Delete a variable from a theme',
        params: {
          type: 'object',
          required: ['id', 'name'],
          properties: {
            id: { type: 'string', description: 'Theme ID' },
            name: { type: 'string', description: 'Variable name' },
          },
        },
        response: {
          204: {
            type: 'null',
            description: 'Variable deleted successfully',
          },
          404: errorSchema,
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string; name: string } }>,
      reply: FastifyReply
    ) => {
      const deleted = await themeService.deleteVariable(
        request.params.id,
        request.params.name
      );

      if (!deleted) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Variable ${request.params.name} not found in theme ${request.params.id}`,
        });
      }

      return reply.code(204).send();
    }
  );

  /**
   * POST /themes/:id/clone
   * Clone a theme with a new name
   */
  fastify.post<{ Params: { id: string }; Body: { name: string } }>(
    '/themes/:id/clone',
    {
      schema: {
        tags: ['themes'],
        description: 'Clone a theme with a new name',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Source theme ID' },
          },
        },
        body: cloneThemeRequestSchema,
        response: {
          201: apiThemeSchema,
          404: errorSchema,
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { name: string } }>,
      reply: FastifyReply
    ) => {
      const clonedTheme = await themeService.cloneTheme(
        request.params.id,
        request.body.name
      );

      if (!clonedTheme) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Theme ${request.params.id} not found`,
        });
      }

      return reply.code(201).send(clonedTheme);
    }
  );
}
