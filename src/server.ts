import Fastify from "fastify";
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { initializeClient, closeClient } from './storage/ValKeyClient.js';
import { ThemeRepository } from './storage/ThemeRepository.js';
import { SchemaRepository } from './storage/SchemaRepository.js';
import { ThemeService } from './services/ThemeService.js';
import { SchemaService } from './services/SchemaService.js';
import schemaRoutes from './routes/schemas.js';
import themeRoutes from './routes/themes.js';

const fastify = Fastify({
  logger: true
});

const start = async () => {
  try {
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

    fastify.get("/health", {
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
      return { status: "ok" };
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

    // Register route plugins
    await fastify.register(schemaRoutes, { schemaService });
    await fastify.register(themeRoutes, { themeService });

    // Graceful shutdown
    const shutdown = async () => {
      fastify.log.info('Shutting down...');
      await fastify.close();
      await closeClient();
      fastify.log.info('Shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    await fastify.listen({ port: 3000, host: "0.0.0.0" });
    console.log("Server running on http://localhost:3000");
  } catch (err) {
    fastify.log.error(err);
    await closeClient();
    process.exit(1);
  }
};

start();