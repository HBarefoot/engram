#!/usr/bin/env node
import { existsSync, mkdirSync, rmSync, copyFileSync, cpSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const resourcesDir = join(projectRoot, 'desktop/src-tauri/resources');
const nodeModulesDir = join(projectRoot, 'node_modules');

// Platform guard — sidecar build currently targets macOS only
if (process.platform !== 'darwin') {
  console.error(`Error: build-sidecar.js currently only supports macOS (darwin). Detected: ${process.platform}`);
  process.exit(1);
}

// Architecture mapping
const archSuffix = process.arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
const ortArch = process.arch === 'arm64' ? 'arm64' : 'x64';

function copyFile(src, dest) {
  const dir = dirname(dest);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  copyFileSync(src, dest);
}

async function buildSidecar() {
  console.log('Building Engram sidecar...\n');

  // Step 0: Clean old artifacts
  console.log('Step 0: Cleaning old artifacts...');
  const oldArtifacts = [
    join(resourcesDir, 'engram-sidecar-aarch64-apple-darwin'),
    join(resourcesDir, 'engram-sidecar-x86_64-apple-darwin'),
    join(resourcesDir, '.bundle'),
    join(resourcesDir, 'engram-bundle.cjs'),
    join(resourcesDir, `node-${archSuffix}`),
    join(resourcesDir, 'node_modules'),
    join(resourcesDir, 'models'),
  ];
  for (const artifact of oldArtifacts) {
    if (existsSync(artifact)) {
      rmSync(artifact, { recursive: true, force: true });
      console.log(`  Removed: ${artifact.replace(projectRoot + '/', '')}`);
    }
  }

  if (!existsSync(resourcesDir)) {
    mkdirSync(resourcesDir, { recursive: true });
  }

  // Step 1: esbuild bundle
  // Bundle @xenova/transformers INTO the output (pure JS).
  // Keep native addon packages as external.
  // Alias onnxruntime-web and sharp to stubs (not needed at runtime).
  console.log('\nStep 1: Building esbuild bundle...');
  const stubsDir = join(projectRoot, 'scripts/stubs');
  const esbuildCmd = [
    'npx esbuild bin/engram.js',
    '--bundle',
    '--platform=node',
    '--target=node20',
    '--format=cjs',
    `--outfile="${join(resourcesDir, 'engram-bundle.cjs')}"`,
    '--external:better-sqlite3',
    '--external:onnxruntime-node',
    '--external:onnxruntime-common',
    '--external:bindings',
    '--external:file-uri-to-path',
    `--alias:onnxruntime-web=${join(stubsDir, 'onnxruntime-web.cjs')}`,
    `--alias:sharp=${join(stubsDir, 'sharp.cjs')}`,
    '--define:import.meta.url=__import_meta_url',
    `--banner:js='var __import_meta_url = require("url").pathToFileURL(__filename).href;'`,
    '--log-level=warning',
  ].join(' ');

  try {
    const { stderr } = await execAsync(esbuildCmd, { cwd: projectRoot, timeout: 120000 });
    if (stderr) console.log(`  ${stderr.trim()}`);
    console.log('  Created: engram-bundle.cjs');
  } catch (error) {
    console.error('  esbuild failed:', error.message);
    process.exit(1);
  }

  // Step 2: Copy Node.js binary
  console.log('\nStep 2: Copying Node.js binary...');
  const nodeBinaryName = `node-${archSuffix}`;
  const nodeBinaryDest = join(resourcesDir, nodeBinaryName);
  copyFileSync(process.execPath, nodeBinaryDest);
  chmodSync(nodeBinaryDest, 0o755);
  console.log(`  Copied: ${process.execPath} → ${nodeBinaryName}`);

  // Step 3: Copy native module packages
  console.log('\nStep 3: Copying native modules...');
  const destModules = join(resourcesDir, 'node_modules');
  mkdirSync(destModules, { recursive: true });

  // 3a: better-sqlite3
  const bsq3Src = join(nodeModulesDir, 'better-sqlite3');
  const bsq3Dest = join(destModules, 'better-sqlite3');
  copyFile(join(bsq3Src, 'package.json'), join(bsq3Dest, 'package.json'));
  cpSync(join(bsq3Src, 'lib'), join(bsq3Dest, 'lib'), { recursive: true });
  copyFile(
    join(bsq3Src, 'build/Release/better_sqlite3.node'),
    join(bsq3Dest, 'build/Release/better_sqlite3.node')
  );
  console.log('  Copied: better-sqlite3 (lib/ + better_sqlite3.node)');

  // 3b: bindings (required by better-sqlite3)
  const bindingsSrc = join(nodeModulesDir, 'bindings');
  const bindingsDest = join(destModules, 'bindings');
  copyFile(join(bindingsSrc, 'package.json'), join(bindingsDest, 'package.json'));
  copyFile(join(bindingsSrc, 'bindings.js'), join(bindingsDest, 'bindings.js'));
  console.log('  Copied: bindings');

  // 3c: file-uri-to-path (required by bindings)
  const fSrc = join(nodeModulesDir, 'file-uri-to-path');
  const fDest = join(destModules, 'file-uri-to-path');
  copyFile(join(fSrc, 'package.json'), join(fDest, 'package.json'));
  copyFile(join(fSrc, 'index.js'), join(fDest, 'index.js'));
  console.log('  Copied: file-uri-to-path');

  // 3d: onnxruntime-node (native .node + .dylib for current arch)
  const ortNodeSrc = join(nodeModulesDir, 'onnxruntime-node');
  const ortNodeDest = join(destModules, 'onnxruntime-node');
  copyFile(join(ortNodeSrc, 'package.json'), join(ortNodeDest, 'package.json'));
  for (const f of ['index.js', 'backend.js', 'binding.js']) {
    copyFile(join(ortNodeSrc, 'dist', f), join(ortNodeDest, 'dist', f));
  }
  const ortNativeDir = join(ortNodeSrc, 'bin/napi-v3/darwin', ortArch);
  const ortNativeDest = join(ortNodeDest, 'bin/napi-v3/darwin', ortArch);
  if (existsSync(ortNativeDir)) {
    cpSync(ortNativeDir, ortNativeDest, { recursive: true });
    console.log(`  Copied: onnxruntime-node (dist/ + bin/napi-v3/darwin/${ortArch}/)`);
  } else {
    console.warn(`  WARNING: onnxruntime-node native dir not found: ${ortNativeDir}`);
  }

  // 3e: onnxruntime-common (pure JS, required by onnxruntime-node)
  const ortCommonSrc = join(nodeModulesDir, 'onnxruntime-common');
  const ortCommonDest = join(destModules, 'onnxruntime-common');
  copyFile(join(ortCommonSrc, 'package.json'), join(ortCommonDest, 'package.json'));
  copyFile(
    join(ortCommonSrc, 'dist/ort-common.node.js'),
    join(ortCommonDest, 'dist/ort-common.node.js')
  );
  cpSync(join(ortCommonSrc, 'dist/lib'), join(ortCommonDest, 'dist/lib'), { recursive: true });
  console.log('  Copied: onnxruntime-common (dist/)');

  // Step 4: Bundle embedding model for offline use
  console.log('\nStep 4: Bundling embedding model (~23 MB)...');
  const modelCacheSrc = join(nodeModulesDir, '@xenova/transformers/.cache/Xenova/all-MiniLM-L6-v2');
  const modelCacheDest = join(resourcesDir, 'models', 'Xenova', 'all-MiniLM-L6-v2');
  if (existsSync(modelCacheSrc)) {
    mkdirSync(modelCacheDest, { recursive: true });
    cpSync(modelCacheSrc, modelCacheDest, { recursive: true });
    console.log('  Copied: Xenova/all-MiniLM-L6-v2 embedding model');
  } else {
    console.warn('  WARNING: Embedding model cache not found at:', modelCacheSrc);
    console.warn('  Run "npm start" once to download the model, then rebuild the sidecar.');
  }

  // Summary
  console.log('\n✅ Sidecar build complete!');
  console.log(`\nOutput: desktop/src-tauri/resources/`);
  console.log(`  engram-bundle.cjs`);
  console.log(`  ${nodeBinaryName}`);
  console.log(`  models/       (Xenova/all-MiniLM-L6-v2 embedding model)`);
  console.log(`  node_modules/  (better-sqlite3, bindings, file-uri-to-path, onnxruntime-node, onnxruntime-common)`);
  console.log(`\nTest manually:`);
  console.log(`  NODE_PATH=${join(resourcesDir, 'node_modules')} \\`);
  console.log(`    ${nodeBinaryDest} \\`);
  console.log(`    ${join(resourcesDir, 'engram-bundle.cjs')} start --port 3839`);
}

buildSidecar().catch(err => {
  console.error('\n❌ Build failed:', err);
  process.exit(1);
});
