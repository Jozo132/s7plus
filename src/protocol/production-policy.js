// @ts-check
import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { packageRoot } from '../package-root.js';

export function getProductionHost() {
  let host = process.env.S7PLUS_PRODUCTION_HOST;
  if (host === undefined) {
    try {
      const config = JSON.parse(readFileSync(process.env.S7PLUS_TARGET_CONFIG ?? resolve(packageRoot, '.s7plus-target.local.json'), 'utf8'));
      host = config.host;
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') return undefined;
      throw error;
    }
  }
  if (typeof host !== 'string' || !isIP(host) || ['127.0.0.1', '::1', '0.0.0.0', '::'].includes(host)) {
    throw new Error('Invalid S7PLUS_PRODUCTION_HOST or local target configuration');
  }
  return host;
}

export function getLabHost() {
  const host = process.env.S7PLUS_LAB_HOST;
  if (host === undefined) return undefined;
  if (!isIP(host) || ['127.0.0.1', '::1', '0.0.0.0', '::'].includes(host) || host === getProductionHost()) {
    throw new Error('S7PLUS_LAB_HOST must identify a separate explicitly authorized lab PLC');
  }
  return host;
}

/** @param {string} host */
export function assertClassicTarget(host) {
  if (host === getProductionHost()) {
    throw new Error('PRODUCTION_READ_ONLY: The configured production target requires the isolated S7CommPlus backend; classic writes and raw forwarding are not qualified');
  }
}