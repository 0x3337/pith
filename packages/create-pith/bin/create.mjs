#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templateDir = path.resolve(__dirname, '../template');

const target = process.argv[2] ?? '.';
const targetDir = path.resolve(process.cwd(), target);

if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
  console.error(`Directory "${target}" already exists and is not empty.`);
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.cpSync(templateDir, targetDir, { recursive: true });

// npm strips a template's .gitignore from the published tarball, so it ships as _gitignore.
fs.renameSync(path.join(targetDir, '_gitignore'), path.join(targetDir, '.gitignore'));

const packagePath = path.join(targetDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

packageJson.name = path.basename(targetDir);

fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

console.log(`Created a new pith project in ${targetDir}`);
console.log('');
console.log('Next steps:');
console.log(`  cd ${path.relative(process.cwd(), targetDir) || '.'}`);
console.log('  cp .env.example .env');
console.log('  npm install');
console.log('  npm start');
