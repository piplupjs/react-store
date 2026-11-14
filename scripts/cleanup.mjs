#!/usr/bin/env node

// @ts-check

import fg from 'fast-glob';
import { rimraf } from 'rimraf';

const patterns = ['dist', '.cache'];
const ignore = ['**/node_modules/**', '**/.git/**'];

async function clean() {
  console.log('Cleaning workspace...');

  const matches = await fg(patterns, {
    dot: true,
    ignore,
    onlyFiles: false,
  });

  for (const path of matches) {
    try {
      console.log(`Removing ${path}`);
      // eslint-disable-next-line no-await-in-loop -- one at a time keeps the log in order
      await rimraf(path);
    } catch (err) {
      console.error(`Failed to remove ${path}`, err);
    }
  }

  console.log('Clean complete');
}

await clean();
