#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

function fixDuplicateExports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const hasSelfReExport = lines.some(line =>
    line.includes('from "./index.ts"') || line.includes("from './index.ts'")
  );

  if (!hasSelfReExport) {
    return false;
  }

  const fixed = lines.filter(line => {
    const isSelfReExport = line.includes('from "./index.ts"') ||
                          line.includes("from './index.ts'");
    return !isSelfReExport;
  }).join('\n');

  fs.writeFileSync(filePath, fixed, 'utf-8');
  return true;
}

const genDir = path.resolve(process.cwd(), 'resources/js/.resonance');

function walkDir(dir) {
  if (!fs.existsSync(dir)) {
    console.log('[ok] No gen directory found, skipping cleanup');
    return;
  }

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file === 'index.ts') {
      if (fixDuplicateExports(filePath)) {
        console.log(`Fixed: ${filePath}`);
      }
    }
  }
}

walkDir(genDir);
console.log('[ok] Duplicate exports fixed');
