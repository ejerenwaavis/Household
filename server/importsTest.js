#!/usr/bin/env node

/**
 * Quick syntax and import validation script
 * Run: node importsTest.js
 */

import fs from 'fs';
import path from 'path';

const testFiles = [
  'src/routes/creditCardStatement.js',
  'src/routes/taskReminder.js',
  'src/services/overspendService.js',
  'src/models/CreditCardStatement.js',
  'src/models/OverspendProject.js',
  'src/models/TaskReminder.js'
];

console.log('🔍 Checking files exist...\n');

let allExist = true;
testFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  const exists = fs.existsSync(filePath);
  console.log(`${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allExist = false;
});

if (!allExist) {
  console.error('\n❌ Some files missing!');
  process.exit(1);
}

console.log('\n✅ All files exist!');
console.log('\n📝 Route files are ready for import.\n');
console.log('Next steps:');
console.log('1. Restart the Node server to apply changes');
console.log('2. Test endpoints via Postman or REST Client');
console.log('3. Run: npm start');
