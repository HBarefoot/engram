#!/usr/bin/env node
/**
 * generate-brand.js — render the Engram "Bloom" mark to every raster the
 * product needs, from the two canonical SVGs in assets/brand/.
 *
 *   assets/brand/engram-icon.svg  → gradient squircle app/Dock tile
 *   assets/brand/engram-mark.svg  → flat accent mark (tray, favicon, logo)
 *
 * Outputs (deterministic, committed):
 *   desktop/src-tauri/icons/{icon.png,icon-512,256,128,32.png,icon.icns,
 *                            tray-icon.png,tray-icon@2x.png}
 *   dashboard/public/{favicon.png,engram-logo.png,engram-mark.svg}
 *   desktop/public/{favicon.png,engram-logo.png}
 *   engram-logo.png (repo root, 180px — referenced by README)
 *
 * Pure JS rasteriser (@resvg/resvg-js, no system libs). macOS `sips` +
 * `iconutil` build the .icns. Run from repo root: `node scripts/generate-brand.js`.
 */
import { Resvg } from '@resvg/resvg-js';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const r = (...p) => join(ROOT, ...p);

const ICON_SVG = readFileSync(r('assets/brand/engram-icon.svg'));
const MARK_SVG = readFileSync(r('assets/brand/engram-mark.svg'));

/** Render an SVG buffer to a PNG buffer at a given pixel width. */
function png(svg, size) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}
function writePng(svg, size, outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, png(svg, size));
  console.log('  ✓', outPath.replace(ROOT + '/', ''), `(${size}px)`);
}

console.log('Engram brand assets');

// --- macOS app icon set (gradient squircle) ---
console.log('App icons → desktop/src-tauri/icons/');
const iconsDir = r('desktop/src-tauri/icons');
writePng(ICON_SVG, 1024, join(iconsDir, 'icon.png'));
for (const s of [512, 256, 128, 32]) writePng(ICON_SVG, s, join(iconsDir, `icon-${s}.png`));

// .icns via iconutil (build a .iconset then compile)
console.log('  building icon.icns …');
const iconset = mkdtempSync(join(tmpdir(), 'engram-')) + '/icon.iconset';
mkdirSync(iconset, { recursive: true });
const icns = [
  [16, 'icon_16x16.png'], [32, 'icon_16x16@2x.png'],
  [32, 'icon_32x32.png'], [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'], [256, 'icon_128x128@2x.png'],
  [256, 'icon_256x256.png'], [512, 'icon_256x256@2x.png'],
  [512, 'icon_512x512.png'], [1024, 'icon_512x512@2x.png'],
];
for (const [s, name] of icns) writeFileSync(join(iconset, name), png(ICON_SVG, s));
execFileSync('iconutil', ['-c', 'icns', iconset, '-o', join(iconsDir, 'icon.icns')]);
rmSync(dirname(iconset), { recursive: true, force: true });
console.log('  ✓ desktop/src-tauri/icons/icon.icns');

// --- menu-bar tray icon (flat accent mark) ---
console.log('Tray icons → desktop/src-tauri/icons/');
writePng(MARK_SVG, 22, join(iconsDir, 'tray-icon.png'));
writePng(MARK_SVG, 44, join(iconsDir, 'tray-icon@2x.png'));

// --- web/app logo + favicon ---
console.log('Web assets');
for (const dir of ['dashboard/public', 'desktop/public']) {
  writePng(ICON_SVG, 32, r(dir, 'favicon.png'));
  writePng(ICON_SVG, 180, r(dir, 'engram-logo.png'));
}
// vector mark available to the dashboard at /engram-mark.svg
mkdirSync(r('dashboard/public'), { recursive: true });
copyFileSync(r('assets/brand/engram-mark.svg'), r('dashboard/public/engram-mark.svg'));
console.log('  ✓ dashboard/public/engram-mark.svg');

// repo-root logo referenced by README (raw.githubusercontent)
writePng(ICON_SVG, 180, r('engram-logo.png'));

console.log('Done. Fonts are managed separately in assets/brand/fonts/ (see DESIGN_SYSTEM.md).');
