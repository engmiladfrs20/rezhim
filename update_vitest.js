const fs = require('fs');
const path = require('path');
const files = [
  'workers/ai-jobs/package.json',
  'packages/testing/package.json',
  'packages/storage/package.json',
  'packages/schemas/package.json',
  'packages/localization/package.json',
  'packages/types/package.json',
  'packages/config/package.json',
  'apps/web/package.json',
  'apps/admin/package.json',
  'apps/mobile/package.json',
  'package.json',
];

files.forEach((f) => {
  try {
    const p = path.join('d:/rezhim', f);
    if (fs.existsSync(p)) {
      let c = fs.readFileSync(p, 'utf8');
      let o = c;
      c = c.replace(/"vitest":\s*"[^"]+"/g, '"vitest": "^4.1.0"');
      c = c.replace(
        /"@vitest\/coverage-istanbul":\s*"[^"]+"/g,
        '"@vitest/coverage-istanbul": "^4.1.0"',
      );
      if (c !== o) {
        fs.writeFileSync(p, c);
        console.log('Fixed ' + f);
      }
    }
  } catch (e) {
    console.error('Failed ' + f, e);
  }
});
