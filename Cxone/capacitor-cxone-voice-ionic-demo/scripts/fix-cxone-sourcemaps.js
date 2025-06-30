#!/usr/bin/env node

/**
 * Fix source map issues with CXONE SDK modules
 * The CXONE SDKs reference source files that don't exist in the npm package
 * This script creates empty placeholder files to prevent build errors
 */

const fs = require('fs');
const path = require('path');

const filesToCreate = [
  'node_modules/@nice-devone/core-sdk/src/index.js',
  'node_modules/@nice-devone/common-sdk/node_modules/rxjs/dist/cjs/index.js',
  'node_modules/@nice-devone/agent-sdk/node_modules/tslib/tslib.es6.js'
];

console.log('Fixing CXONE SDK source map references...');

filesToCreate.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath);
  const dir = path.dirname(fullPath);
  
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Create empty file if it doesn't exist
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, '// Placeholder file to fix source map loading\n');
      console.log(`Created: ${filePath}`);
    }
  } catch (error) {
    console.warn(`Warning: Could not create ${filePath}:`, error.message);
  }
});

console.log('Done fixing source map references.');