/**
 * Schema routes plugin
 * Handles all CRUD operations for schemas
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { SchemaService } from '../services/SchemaService.js';
import type {
  ApiSchema,
  SchemaSummary,
  CreateSchemaRequest,
  UpdateSchemaRequest,
} from '../types/api.js';

interface SchemaRoutesOptions {
  schemaService: SchemaService;
}

// JSON Schema definitions for OpenAPI
const schemaVariableSchema = {
  type: 'object',
  properties: {
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

const apiSchemaSchema = {
  type: 'object',
  required: ['id', 'name', 'variables'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    version: { type: 'string' },
    variables: {
      type: 'object',
      additionalProperties: schemaVariableSchema,
    },
  },
};

const schemaSummarySchema = {
  type: 'object',
  required: ['id', 'name', 'variableCount'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    version: { type: 'string' },
    variableCount: { type: 'integer' },
  },
};

const createSchemaRequestSchema = {
  type: 'object',
  required: ['name', 'variables'],
  properties: {
    name: { type: 'string' },
    version: { type: 'string' },
    variables: {
      type: 'object',
      additionalProperties: schemaVariableSchema,
    },
  },
};

const updateSchemaRequestSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    version: { type: 'string' },
    variables: {
      type: 'object',
      additionalProperties: schemaVariableSchema,
    },
  },
};

const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
  },
};

export default async function schemaRoutes(
  fastify: FastifyInstance,
  options: SchemaRoutesOptions
) {
  const { schemaService } = options;

  /**
   * GET /schemas
   * List all schemas (summaries)
   */
  fastify.get('/schemas', {
    schema: {
      tags: ['schemas'],
      description: 'List all schemas',
      response: {
        200: {
          type: 'array',
          items: schemaSummarySchema,
        },
      },
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const summaries: SchemaSummary[] = await schemaService.listSchemas();
    return reply.send(summaries);
  });

  /**
   * POST /schemas
   * Create a new schema
   */
  fastify.post<{ Body: CreateSchemaRequest }>('/schemas', {
    schema: {
      tags: ['schemas'],
      description: 'Create a new schema',
      body: createSchemaRequestSchema,
      response: {
        201: apiSchemaSchema,
      },
    },
  }, async (request: FastifyRequest<{ Body: CreateSchemaRequest }>, reply: FastifyReply) => {
    const schema: ApiSchema = await schemaService.createSchema(request.body);
    return reply.code(201).send(schema);
  });

  /**
   * GET /schemas/:id
   * Get a schema by ID
   */
  fastify.get<{ Params: { id: string } }>('/schemas/:id', {
    schema: {
      tags: ['schemas'],
      description: 'Get a schema by ID',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Schema ID' },
        },
      },
      response: {
        200: apiSchemaSchema,
        404: errorSchema,
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const schema = await schemaService.getSchema(request.params.id);

    if (!schema) {
      return reply.code(404).send({
        error: 'Not Found',
        message: `Schema ${request.params.id} not found`,
      });
    }

    return reply.send(schema);
  });

  /**
   * PUT /schemas/:id
   * Update a schema
   */
  fastify.put<{ Params: { id: string }; Body: UpdateSchemaRequest }>('/schemas/:id', {
    schema: {
      tags: ['schemas'],
      description: 'Update a schema',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Schema ID' },
        },
      },
      body: updateSchemaRequestSchema,
      response: {
        200: apiSchemaSchema,
        404: errorSchema,
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateSchemaRequest }>,
    reply: FastifyReply
  ) => {
    const schema = await schemaService.updateSchema(request.params.id, request.body);

    if (!schema) {
      return reply.code(404).send({
        error: 'Not Found',
        message: `Schema ${request.params.id} not found`,
      });
    }

    return reply.send(schema);
  });

  /**
   * DELETE /schemas/:id
   * Delete a schema
   */
  fastify.delete<{ Params: { id: string } }>('/schemas/:id', {
    schema: {
      tags: ['schemas'],
      description: 'Delete a schema',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Schema ID' },
        },
      },
      response: {
        204: {
          type: 'null',
          description: 'Schema deleted successfully',
        },
        404: errorSchema,
        409: {
          ...errorSchema,
          description: 'Schema is still referenced by themes',
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const deleted = await schemaService.deleteSchema(request.params.id);

      if (!deleted) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Schema ${request.params.id} not found`,
        });
      }

      return reply.code(204).send();
    } catch (error) {
      // Handle referential integrity errors (schema still in use)
      if (error instanceof Error && error.message.includes('still referenced')) {
        return reply.code(409).send({
          error: 'Conflict',
          message: error.message,
        });
      }
      throw error;
    }
  });
}
