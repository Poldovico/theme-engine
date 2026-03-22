/**
 * Application factory - creates and configures the Fastify instance
 * Used by both the server and integration tests
 */

import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { initializeClient } from './storage/ValKeyClient.js';
import { ThemeRepository } from './storage/ThemeRepository.js';
import { SchemaRepository } from './storage/SchemaRepository.js';
import { ThemeService } from './services/ThemeService.js';
import { SchemaService } from './services/SchemaService.js';
import { RenderService } from './services/RenderService.js';
import schemaRoutes from './routes/schemas.js';
import themeRoutes from './routes/themes.js';
import renderRoutes from './routes/render.js';

export interface AppOptions {
  logger?: boolean;
}

export async function createApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: options.logger ?? true,
  });

  // Register Swagger for OpenAPI documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Whitelabel API',
        description: 'API for managing themes and schemas for whitelabel applications',
        version: '0.1.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
      ],
      tags: [
        { name: 'schemas', description: 'Schema management endpoints' },
        { name: 'themes', description: 'Theme management endpoints' },
        { name: 'render', description: 'CSS rendering endpoints' },
        { name: 'health', description: 'Health check endpoints' },
      ],
    },
  });

  // Register Swagger UI
  await fastify.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  fastify.get('/health', {
    schema: {
      tags: ['health'],
      description: 'Health check endpoint',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
      },
    },
  }, async () => {
    return { status: 'ok' };
  });

  // Initialize Valkey client
  const valkeyClient = await initializeClient();
  fastify.log.info('Connected to Valkey');

  // Initialize repositories
  const themeRepository = new ThemeRepository(valkeyClient);
  const schemaRepository = new SchemaRepository(valkeyClient);

  // Initialize services
  const themeService = new ThemeService(themeRepository, schemaRepository);
  const schemaService = new SchemaService(schemaRepository, themeRepository);
  const renderService = new RenderService(themeService);

  // Register route plugins
  await fastify.register(schemaRoutes, { schemaService });
  await fastify.register(themeRoutes, { themeService });
  await fastify.register(renderRoutes, { renderService });

  return fastify;
}
