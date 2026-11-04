// @ts-check
import { describe, it, expect, beforeAll } from 'vitest';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire, isBuiltin } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url);
const require = createRequire(import.meta.url);

describe('standalone package boundaries', () => {
  beforeAll(() => {
    execFileSync(process.execPath, [fileURLToPath(new URL('scripts/build.js', root))], { cwd: root, stdio: 'pipe' });
  }, 30000);

  it('exports the same shared API to ESM and CommonJS', () => {
    const script = `import * as esm from 's7plus';
      import * as source from './src/lib.js';
      import { createRequire } from 'node:module';
      import assert from 'node:assert/strict';
      const commonjs = createRequire(import.meta.url)('s7plus');
      assert.deepEqual(Object.keys(esm).sort(), Object.keys(source).sort());
      assert.deepEqual(Object.keys(commonjs).sort(), Object.keys(esm).sort());
      for (const name of Object.keys(esm)) assert.equal(esm[name], commonjs[name]);`;
    execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: root, stdio: 'pipe' });
  });

  it('type-checks ESM and CommonJS consumers with full declaration checking', () => {
    execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', 'test/types/tsconfig.json'], { cwd: root, stdio: 'pipe' });
  }, 30000);

  it('resolves the production target relative to the installed package in CommonJS', () => {
    const directory = mkdtempSync(join(tmpdir(), 's7plus package '));
    try {
      mkdirSync(join(directory, 'dist'));
      copyFileSync(fileURLToPath(new URL('dist/index.cjs', root)), join(directory, 'dist', 'index.cjs'));
      symlinkSync(fileURLToPath(new URL('node_modules/', root)), join(directory, 'node_modules'), 'junction');
      writeFileSync(join(directory, '.s7plus-target.local.json'), JSON.stringify({ host: '192.0.2.10' }));
      const env = { ...process.env };
      delete env.S7PLUS_PRODUCTION_HOST;
      delete env.S7PLUS_TARGET_CONFIG;
      const script = `const { S7CommPlusClient } = require('./dist/index.cjs');
        if (new S7CommPlusClient().report.target.host !== '192.0.2.10') process.exit(1);`;
      execFileSync(process.execPath, ['-e', script], { cwd: directory, env, stdio: 'pipe' });
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it('runs both worker entry points', async () => {
    for (const entry of [new URL(import.meta.resolve('s7plus/worker')), require.resolve('s7plus/worker')]) {
      const worker = new Worker(entry);
      try {
        const reply = new Promise((resolve, reject) => {
          worker.once('message', resolve);
          worker.once('error', reject);
        });
        worker.postMessage({ type: 'unknown' });
        await expect(reply).resolves.toEqual({ type: 'error', error: 'Unknown message type: unknown' });
      } finally { await worker.terminate(); }
    }
  }, 10000);

  it('resolves source imports only within the package or declared external dependencies', () => {
    const metadata = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
    const dependencies = new Set(Object.keys(metadata.dependencies));
    /** @param {URL} directory */
    function inspect(directory) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
        if (entry.isDirectory()) { inspect(url); continue; }
        if (!entry.name.endsWith('.js')) continue;
        const source = readFileSync(url, 'utf8');
        const imports = source.matchAll(/\b(?:import|export)\s+[^;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]/g);
        for (const match of imports) {
          const specifier = match[1] ?? match[2];
          if (specifier.startsWith('.')) {
            expect(fileURLToPath(new URL(specifier, url)).startsWith(fileURLToPath(root)), `${url.pathname}: ${specifier}`).toBe(true);
            expect(new URL(specifier, url).href.startsWith(new URL('src/', root).href), `Runtime import of test-only storage: ${specifier}`).toBe(true);
          } else {
            const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
            expect(isBuiltin(specifier) || dependencies.has(name), `${url.pathname}: ${specifier}`).toBe(true);
          }
        }
      }
    }
    inspect(new URL('src/', root));
  });
});
