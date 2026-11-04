import { build } from 'esbuild';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
await mkdir(dist, { recursive: true });

await build({
  absWorkingDir: fileURLToPath(root),
  entryPoints: { index: 'src/lib.js', worker: 'src/worker.js' },
  outdir: 'dist',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  packages: 'external',
  define: { 'import.meta.url': '__s7plusSourceUrl' },
  banner: { js: 'const __s7plusSourceUrl = require("node:url").pathToFileURL(require("node:path").join(__dirname, "../src/package-root.js")).href;' },
});

const exports = Object.keys(require(fileURLToPath(new URL('index.cjs', dist)))).sort();
if (exports.some(name => !/^[A-Za-z_$][\w$]*$/.test(name))) throw new Error('Public API contains an unsupported export name');
await writeFile(new URL('index.js', dist), `import api from './index.cjs';\n${exports.map(name => `export const ${name} = api.${name};`).join('\n')}\n`);

const result = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.build.json'], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
await cp(new URL('types/', dist), new URL('types-cjs/', dist), { recursive: true });
await writeFile(new URL('types-cjs/package.json', dist), '{"type":"commonjs"}\n');