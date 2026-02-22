#!/usr/bin/env node
// Update Wails app icons from project root logo.png
// - Copies logo.png to ../build/appicon.png
// - Generates ../build/windows/icon.ico from logo.png in multiple sizes

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const pngToIco = require('png-to-ico').default;
const sharp = require('sharp');

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true }).catch(() => {});
}

async function main() {
  const rootDir = path.resolve(__dirname, '../..');
  const logoPath = path.join(rootDir, 'logo.png');
  const buildDir = path.join(rootDir, 'build');
  const winDir = path.join(buildDir, 'windows');
  const appIconPng = path.join(buildDir, 'appicon.png');
  const winIconIco = path.join(winDir, 'icon.ico');

  // Validate logo exists
  try {
    await fsp.access(logoPath, fs.constants.R_OK);
  } catch (e) {
    console.error(`logo.png not found at ${logoPath}`);
    process.exit(1);
  }

  await ensureDir(buildDir);
  await ensureDir(winDir);

  // Copy PNG as app icon
  await fsp.copyFile(logoPath, appIconPng);
  console.log(`Copied app icon -> ${path.relative(rootDir, appIconPng)}`);

  // Generate ICO for Windows with multiple sizes
  const sizes = [16, 32, 48, 256];
  const pngBuffers = await Promise.all(
    sizes.map(size => sharp(logoPath).resize(size, size).png().toBuffer())
  );
  try {
    const icoBuffer = await pngToIco(pngBuffers);
    await fsp.writeFile(winIconIco, icoBuffer);
    console.log(`Generated Windows icon -> ${path.relative(rootDir, winIconIco)}`);
  } catch (e) {
    console.error('Failed to generate ICO from logo.png:', e.message || e);
    process.exit(1);
  }

  console.log('Icon update complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
