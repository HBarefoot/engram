#!/usr/bin/env node
import { exec } from "child_process";
import { promisify } from "util";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

async function buildSidecar() {
  const outputDir = join(projectRoot, "desktop/src-tauri/resources");
  const bundleDir = join(projectRoot, "desktop/src-tauri/resources/.bundle");

  // Ensure output directories exist
  for (const dir of [outputDir, bundleDir]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  console.log("Step 1: Bundling ESM to CJS with esbuild...");

  // Bundle the ESM entry point to a single CJS file for pkg compatibility
  const bundledEntry = join(bundleDir, "engram-bundle.cjs");
  try {
    await execAsync(
      `npx esbuild bin/engram.js ` +
      `--bundle ` +
      `--platform=node ` +
      `--target=node20 ` +
      `--format=cjs ` +
      `--outfile="${bundledEntry}" ` +
      `--external:better-sqlite3 ` +
      `--external:@xenova/transformers ` +
      `--external:onnxruntime-node`,
      { cwd: projectRoot, timeout: 60000 }
    );
    console.log("  Bundled to CJS successfully");
  } catch (error) {
    console.error("  esbuild failed:", error.message);
    console.log("  Falling back to direct pkg (may have ESM issues)...");
  }

  // Create a minimal package.json for the bundle
  writeFileSync(
    join(bundleDir, "package.json"),
    JSON.stringify({ name: "engram-sidecar", version: "1.0.0", bin: "engram-bundle.cjs" })
  );

  console.log("Step 2: Building standalone binaries with pkg...");

  const entryFile = existsSync(bundledEntry)
    ? bundledEntry
    : join(projectRoot, "bin/engram.js");

  const targets = [
    { target: "node20-macos-arm64", suffix: "aarch64-apple-darwin" },
    { target: "node20-macos-x64", suffix: "x86_64-apple-darwin" },
  ];

  for (const { target, suffix } of targets) {
    const outputPath = join(outputDir, `engram-sidecar-${suffix}`);

    console.log(`  Building for ${target}...`);

    try {
      const { stdout, stderr } = await execAsync(
        `npx @yao-pkg/pkg "${entryFile}" ` +
        `--target ${target} ` +
        `--output "${outputPath}" ` +
        `--compress GZip`,
        { cwd: projectRoot, timeout: 300000 }
      );
      if (stdout) console.log(stdout);
      if (stderr && !stderr.includes("Warning")) console.error(stderr);
      console.log(`  Built ${outputPath}`);
    } catch (error) {
      console.error(`  Failed to build ${target}:`, error.message);
      process.exit(1);
    }
  }

  console.log("Sidecar build complete!");
  console.log("\nNote: The sidecar requires better-sqlite3 and @xenova/transformers");
  console.log("to be available at runtime. For production, these native modules");
  console.log("need to be bundled alongside the binary in the resources directory.");
}

buildSidecar();
