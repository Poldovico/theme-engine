import { closeClient } from './storage/ValKeyClient.js';
import { createApp } from './app.js';

const start = async () => {
  try {
    const fastify = await createApp({ logger: true });

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
    console.error(err);
    await closeClient();
    process.exit(1);
  }
};

start();