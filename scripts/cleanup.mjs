#!/usr/bin/env node

// @ts-check

import { rimraf } from 'rimraf';
import fg from 'fast-glob';

const patterns = ['dist', '.cache'];
const ignore = ['**/node_modules/**', '**/.git/**'];

async function clean() {
  console.log('Cleaning workspace...');

  const matches = await fg(patterns, {
    onlyFiles: false,
    dot: true,
    ignore
  });

  for (const path of matches) {
    try {
      console.log(`Removing ${path}`);
      await rimraf(path);
    } catch (err) {
      console.error(`Failed to remove ${path}`, err);
    }
  }

  console.log('Clean complete');
}

await clean();
