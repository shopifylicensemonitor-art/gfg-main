const fs = require('fs');
const path = require('path');

const gfgMainDir = path.join(__dirname, 'gfg-main');

function readUtf16File(filename) {
  const filePath = path.join(gfgMainDir, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf16le');
    console.log(`--- ${filename} ---`);
    console.log(data);
    console.log(`--- End of ${filename} ---\n`);
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
  }
}

readUtf16File('build_error.txt');
readUtf16File('eslint_errors.txt');
readUtf16File('out.log');
