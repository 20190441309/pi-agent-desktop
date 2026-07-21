/**
 * Generate Windows .ico from icon.png (256x256, embedded PNG).
 * Usage: node scripts/generate-win-icon.mjs [path-to-icon.png]
 */
const fs = require('fs');
const path = require('path');

const pngPath = process.argv[2] || path.join(__dirname, '..', 'build', 'icon.png');
const icoPath = path.join(path.dirname(pngPath), 'icon.ico');

if (!fs.existsSync(pngPath)) {
  console.error('PNG not found:', pngPath);
  process.exit(1);
}

const png = fs.readFileSync(pngPath);

// ICO header: reserved(2) + type(2) + count(2)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);      // reserved
header.writeUInt16LE(1, 2);      // type = icon
header.writeUInt16LE(1, 4);      // 1 image

// Directory entry: 16 bytes
const dir = Buffer.alloc(16);
dir.writeUInt8(0, 0);            // width (0 = 256)
dir.writeUInt8(0, 1);            // height (0 = 256)
dir.writeUInt8(0, 2);            // color palette
dir.writeUInt8(0, 3);            // reserved
dir.writeUInt16LE(1, 4);         // color planes
dir.writeUInt16LE(32, 6);        // bits per pixel
dir.writeUInt32LE(png.length, 8); // image data size
dir.writeUInt32LE(22, 12);       // offset (6 + 16 = 22)

const ico = Buffer.concat([header, dir, png]);
fs.writeFileSync(icoPath, ico);
console.log('Done:', icoPath, `(${ico.length} bytes)`);
