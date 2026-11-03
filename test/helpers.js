// @ts-check
// Shared test helpers — boots demo server + classic bridge for integration tests

import { startDemoServer } from './demo-server.js';
import { loadClassicEngine, resetClassicEngineCache } from '../src/protocol/classic-loader.js';
import { ClassicBridge } from '../src/protocol/classic-bridge.js';
import { createLogger } from '../src/logging/logger.js';

/** @typedef {import('./demo-server.js').DemoServer} DemoServer */
/** @typedef {import('./demo-server.js').DemoServerOptions} DemoServerOptions */

/**
 * @typedef {Object} TestContext
 * @property {DemoServer} demo
 * @property {ClassicBridge} bridge
 * @property {import('../src/logging/logger.js').Logger} logger
 */

/** @type {TestContext | null} */
let ctx = null;

/** @param {DemoServerOptions} [options] */
export async function startIntegrationDemoServer(options = {}) {
  const backend = process.env.S7PROXY_TEST_BACKEND ?? 'compat';
  if (backend !== 'compat' && backend !== 'native') throw new Error('S7PROXY_TEST_BACKEND must be compat or native');
  return startDemoServer({ backend, ...options, silent: true });
}

/**
 * Set up the demo PLC server and classic bridge. Reuses a single instance
 * across all tests in the same vitest worker.
 * @param {import('./demo-server.js').DemoServerOptions} [options]
 * @returns {Promise<TestContext>}
 */
export async function setup(options = {}) {
  if (ctx) return ctx;

  const logger = createLogger({ level: 'silent' });
  const demo = await startIntegrationDemoServer(options);
  const engine = await loadClassicEngine();
  const bridge = new ClassicBridge(engine);

  ctx = { demo, bridge, logger };
  return ctx;
}

/**
 * Tear everything down.
 */
export async function teardown() {
  if (!ctx) return;
  ctx.demo.stop();
  resetClassicEngineCache();
  ctx = null;
}
