/**
 * Render routes plugin
 * Handles CSS generation from themes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { RenderService } from '../services/RenderService.js';

interface RenderRoutesOptions {
  renderService: RenderService;
}

export default async function renderRoutes(
  fastify: FastifyInstance,
  options: RenderRoutesOptions
) {
  const { renderService } = options;

  /**
   * GET /render/:themeId.css
   * Generate CSS stylesheet from a theme
   */
  fastify.get<{ Params: { themeId: string } }>(
    '/render/:themeId.css',
    {
      schema: {
        tags: ['render'],
        description: 'Generate CSS stylesheet from a theme',
        params: {
          type: 'object',
          required: ['themeId'],
          properties: {
            themeId: { type: 'string', description: 'Theme ID (without .css extension)' },
          },
        },
        response: {
          200: {
            type: 'string',
            description: 'CSS stylesheet',
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { themeId: string } }>,
      reply: FastifyReply
    ) => {
      // Extract theme ID (remove .css if accidentally included in route param)
      const themeId = request.params.themeId.replace(/\.css$/, '');

      const css = await renderService.generateCSS(themeId);

      if (!css) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Theme ${themeId} not found`,
        });
      }

      return reply
        .code(200)
        .header('Content-Type', 'text/css; charset=utf-8')
        .send(css);
    }
  );
}
