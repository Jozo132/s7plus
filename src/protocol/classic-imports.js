// @ts-check
// Compatibility helper retained for existing consumers.

/** @import { Logger } from '../logging/logger.js' */

/**
 * Create legacy host callbacks.
 * @param {Logger} logger
 * @returns {import('./classic-loader.js').ClassicImports}
 */
export function createWasmImports(logger) {
  return {
    log_debug(_ptr, _len) {
      logger.debug('Classic engine debug');
    },
    log_error(_ptr, _len) {
      logger.error('Classic engine error');
    },
    now_ms() {
      return Date.now();
    },
    memory_grown(oldPages, newPages) {
      logger.debug({ oldPages, newPages }, 'Classic engine memory grown');
    },
  };
}
