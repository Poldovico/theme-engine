/**
 * Test suite for ValKeyClient
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { GlideClient } from '@valkey/valkey-glide';
import {
  initializeClient,
  getClient,
  closeClient,
  healthCheck,
} from './ValKeyClient.js';

// Mock GlideClient
const mockPing = mock.fn(async () => 'PONG');
const mockClose = mock.fn(async () => { });

const mockGlideClient = {
  ping: mockPing,
  close: mockClose,
};

// Mock the createClient static method
mock.method(GlideClient, 'createClient', async () => mockGlideClient);

describe('ValKeyClient', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockPing.mock.resetCalls();
    mockClose.mock.resetCalls();
  });

  afterEach(async () => {
    // Clean up client after each test
    await closeClient();
  });

  describe('initializeClient', () => {
    it('should create and return a client instance', async () => {
      const client = await initializeClient();
      assert.ok(client, 'Client should be initialized');
      assert.strictEqual(client, mockGlideClient, 'Should return the mocked client');
    });

    it('should return the same singleton instance on subsequent calls', async () => {
      const client1 = await initializeClient();
      const client2 = await initializeClient();
      assert.strictEqual(client1, client2, 'Should return the same instance');
    });

    it('should use environment variables for connection', async () => {
      process.env.VALKEY_HOST = 'custom-host';
      process.env.VALKEY_PORT = '7000';

      await closeClient(); // Reset client
      await initializeClient();

      // Verify createClient was called with custom config
      const calls = (GlideClient.createClient as any).mock.calls;
      const lastCall = calls[calls.length - 1];
      assert.strictEqual(lastCall.arguments[0].addresses[0].host, 'custom-host');
      assert.strictEqual(lastCall.arguments[0].addresses[0].port, 7000);

      // Clean up
      delete process.env.VALKEY_HOST;
      delete process.env.VALKEY_PORT;
    });

    it('should use default values when environment variables are not set', async () => {
      delete process.env.VALKEY_HOST;
      delete process.env.VALKEY_PORT;

      await closeClient(); // Reset client
      await initializeClient();

      const calls = (GlideClient.createClient as any).mock.calls;
      const lastCall = calls[calls.length - 1];
      assert.strictEqual(lastCall.arguments[0].addresses[0].host, 'valkey');
      assert.strictEqual(lastCall.arguments[0].addresses[0].port, 6379);
    });
  });

  describe('getClient', () => {
    it('should return null when client is not initialized', async () => {
      const client = getClient();
      assert.strictEqual(client, null, 'Should return null when not initialized');
    });

    it('should return the client instance when initialized', async () => {
      await initializeClient();
      const client = getClient();
      assert.ok(client, 'Should return the client instance');
      assert.strictEqual(client, mockGlideClient, 'Should return the mocked client');
    });
  });

  describe('closeClient', () => {
    it('should close the client and set it to null', async () => {
      await initializeClient();
      assert.ok(getClient(), 'Client should be initialized');

      await closeClient();
      assert.strictEqual(getClient(), null, 'Client should be null after closing');
      assert.strictEqual(mockClose.mock.calls.length, 1, 'close() should be called once');
    });

    it('should handle calling close when client is not initialized', async () => {
      await closeClient();
      assert.strictEqual(mockClose.mock.calls.length, 0, 'close() should not be called');
    });

    it('should handle errors during close gracefully', async () => {
      mockClose.mock.mockImplementationOnce(async () => {
        throw new Error('Close failed');
      });

      await initializeClient();
      await closeClient(); // Should not throw
      assert.strictEqual(getClient(), null, 'Client should be null even after error');
    });
  });

  describe('healthCheck', () => {
    it('should return false when client is not initialized', async () => {
      const healthy = await healthCheck();
      assert.strictEqual(healthy, false, 'Should return false when not initialized');
    });

    it('should return true when ping succeeds', async () => {
      await initializeClient();
      const healthy = await healthCheck();
      assert.strictEqual(healthy, true, 'Should return true when ping succeeds');
      assert.strictEqual(mockPing.mock.calls.length, 1, 'ping() should be called once');
    });

    it('should return false when ping fails', async () => {
      mockPing.mock.mockImplementationOnce(async () => {
        throw new Error('Ping failed');
      });

      await initializeClient();
      const healthy = await healthCheck();
      assert.strictEqual(healthy, false, 'Should return false when ping fails');
    });
  });

  describe('concurrent initialization', () => {
    it('should handle concurrent initialization attempts', async () => {
      await closeClient(); // Reset

      // Start multiple initialization attempts simultaneously
      const promises = [
        initializeClient(),
        initializeClient(),
        initializeClient(),
      ];

      const clients = await Promise.all(promises);

      // All should return the same instance
      assert.strictEqual(clients[0], clients[1], 'First two clients should be the same');
      assert.strictEqual(clients[1], clients[2], 'Last two clients should be the same');

      // Verify all are the mock client
      assert.strictEqual(clients[0], mockGlideClient, 'Should return mocked client');
    });
  });
});
