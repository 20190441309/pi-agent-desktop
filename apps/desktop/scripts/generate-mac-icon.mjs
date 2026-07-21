#!/usr/bin/env node
/**
 * Generate macOS .icns from a 1024x1024 PNG.
 * Usage: node scripts/generate-mac-icon.mjs [path-to-icon.png]
 *
 * Requires macOS with `sips` and `iconutil` (pre-installed).
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join, resolve } from 'path';

const pngPath = resolve(process.argv[2] || 'build/icon.png');
const outPath = resolve('build/icon.icns');
const tmpDir = resolve('build/icon.iconset');

if (!existsSync(pngPath)) {
  console.error(`PNG not found: ${pngPath}`);
  console.error('Usage: node scripts/generate-mac-icon.mjs [path-to-1024x1024-icon.png]');
  process.exit(1);
}

if (process.platform !== 'darwin') {
  console.error('This script requires macOS (sips + iconutil).');
  process.exit(1);
}

const sizes = [
  [16, 16, 'icon_16x16.png'],
  [32, 32, 'icon_16x16@2x.png'],
  [32, 32, 'icon_32x32.png'],
  [64, 64, 'icon_32x32@2x.png'],
  [128, 128, 'icon_128x128.png'],
  [256, 256, 'icon_128x128@2x.png'],
  [256, 256, 'icon_256x256.png'],
  [512, 512, 'icon_256x256@2x.png'],
  [512, 512, 'icon_512x512.png'],
  [1024, 1024, 'icon_512x512@2x.png'],
];

if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

console.log(`Generating icon sizes from ${pngPath}...`);
for (const [w, h, name] of sizes) {
  execSync(`sips -z ${w} ${h} "${pngPath}" --out "${join(tmpDir, name)}"`, { stdio: 'pipe' });
}

console.log('Creating .icns...');
execSync(`iconutil -c icns "${tmpDir}" -o "${outPath}"`, { stdio: 'pipe' });
rmSync(tmpDir, { recursive: true });

console.log(`Done: ${outPath}`);
