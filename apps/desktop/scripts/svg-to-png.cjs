const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const svgPath = path.join(__dirname, '..', 'build', 'icon-source.svg');
const pngPath = path.join(__dirname, '..', 'build', 'icon.png');

const svg = fs.readFileSync(svgPath);

sharp(svg)
  .resize(1024, 1024)
  .png()
  .toFile(pngPath)
  .then(() => console.log('Done:', pngPath))
  .catch(err => { console.error(err); process.exit(1); });
