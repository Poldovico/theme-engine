/**
 * Valkey client initialization and connection management
 *
 * This module initializes a singleton Valkey GLIDE client with proper
 * error handling and lifecycle management. Valkey GLIDE handles connection
 * pooling and reconnection automatically.
 */

import { GlideClient } from '@valkey/valkey-glide';
import type { GlideClient as GlideClientType } from '@valkey/valkey-glide';

let client: GlideClientType | null = null;
let connecting = false;
let disconnecting = false;

/**
 * Initialize the Valkey client
 * Connects to Valkey at the configured address
 * Returns the same singleton instance on subsequent calls
 */
export async function initializeClient(): Promise<GlideClientType> {
  if (client) {
    return client;
  }

  if (connecting) {
    // Wait for ongoing connection attempt
    let retries = 100;
    while (connecting && retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      retries--;
    }
    if (client) {
      return client;
    }
    throw new Error('Failed to initialize Valkey client');
  }

  connecting = true;

  try {
    const host = process.env.VALKEY_HOST || 'valkey';
    const port = parseInt(process.env.VALKEY_PORT || '6379', 10);

    client = await GlideClient.createClient({
      addresses: [{ host, port }],
      requestTimeout: 10000, // 10 second timeout for requests
      clientName: 'whitelabel-theming-engine',
    });

    console.log(`✓ Connected to Valkey at ${host}:${port}`);
    return client;
  } catch (error) {
    client = null;
    throw new Error(
      `Failed to initialize Valkey client: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    connecting = false;
  }
}

/**
 * Get the existing Valkey client
 * Returns the singleton instance or null if not yet initialized
 */
export function getClient(): GlideClientType | null {
  return client;
}

/**
 * Close the Valkey client connection
 * Safe to call even if client is not initialized
 */
export async function closeClient(): Promise<void> {
  if (disconnecting) {
    return;
  }

  if (!client) {
    return;
  }

  disconnecting = true;

  try {
    await client.close();
    console.log('✓ Valkey client closed');
  } catch (error) {
    console.error('Error closing Valkey client:', error);
  } finally {
    client = null;
    disconnecting = false;
  }
}

/**
 * Health check - verify connection to Valkey
 */
export async function healthCheck(): Promise<boolean> {
  if (!client) {
    return false;
  }

  try {
    await client.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Register graceful shutdown handlers
 * Call this on app startup to ensure clean shutdown
 */
export function registerShutdownHandlers(): void {
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, closing connections...`);
    await closeClient();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
