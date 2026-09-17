#!/usr/bin/env node

// @ts-check

import { promises as fs } from 'node:fs';
import { join, relative } from 'node:path';

import esbuild from 'esbuild';
import fg from 'fast-glob';
import Table from 'cli-table3';
import { filesize } from 'filesize';
import { gzipSize } from 'gzip-size';

import { getWorkspaceRoot, exec } from './utils.mjs';

const workspaceRoot = getWorkspaceRoot();

const config = {
  workspaceRoot,
  get distDirectory() {
    return join(this.workspaceRoot, 'dist');
  },
  get workspacePackageJson() {
    return join(this.workspaceRoot, 'package.json');
  },
  get distPackageJson() {
    return join(this.distDirectory, 'package.json');
  },
  distEntryFileName: 'index'
};

const runCleanup = async () => {
  return exec('pnpm', ['cleanup'], {
    cwd: config.workspaceRoot
  });
};

const getBuildStats = async () => {
  const files = await fg(['**/*.js', '**/*.d.ts', '**/*.json', 'LICENSE', 'README.md'], {
    cwd: config.distDirectory,
    absolute: true,
    onlyFiles: true
  });

  let total = 0;
  let gzipTotal = 0;

  const stats = await Promise.all(
    files.map(async (file) => {
      const content = await fs.readFile(file);

      const size = content.length;
      const gzip = await gzipSize(content);

      total += size;
      gzipTotal += gzip;

      return {
        file: relative(config.distDirectory, file),
        size: filesize(size),
        gzip: filesize(gzip)
      };
    })
  );

  return {
    files: stats.sort((a, b) => a.file.localeCompare(b.file)),
    total,
    gzipTotal
  };
};

const createStatsTable = (stats) => {
  const table = new Table({
    head: ['File', 'Size', 'Gzip']
  });

  for (const item of stats.files) {
    table.push([item.file, item.size, item.gzip]);
  }

  return table.toString();
};

const build = async () => {
  await runCleanup();

  const entryPoints = await fg(['src/**/*.{ts,tsx}'], {
    cwd: config.workspaceRoot,
    ignore: ['**/*.test.ts', '**/*.test.tsx'],
    absolute: true
  });

  await esbuild.build({
    entryPoints,
    platform: 'browser',
    format: 'esm',
    outdir: config.distDirectory,
    outbase: 'src',
    target: 'es2020',
    packages: 'external',
    define: {
      'process.env.NODE_ENV': '"production"'
    },
    minifySyntax: true
  });

  exec('tsc', ['-p', 'tsconfig.build.json'], {
    cwd: config.workspaceRoot
  });

  const workspacePackageJson = JSON.parse(await fs.readFile(config.workspacePackageJson, 'utf8'));
  const distPackage = { ...workspacePackageJson };

  distPackage.main = `./${config.distEntryFileName}.js`;
  distPackage.module = `./${config.distEntryFileName}.js`;
  distPackage.types = `./${config.distEntryFileName}.d.ts`;
  distPackage.exports = {
    '.': {
      types: `./${config.distEntryFileName}.d.ts`,
      default: `./${config.distEntryFileName}.js`
    }
  };
  distPackage.sideEffects = false;

  delete distPackage.files;
  delete distPackage.private;
  delete distPackage.scripts;
  delete distPackage.devDependencies;
  delete distPackage.packageManager;

  await fs.writeFile(config.distPackageJson, `${JSON.stringify(distPackage, null, 2)}\n`, 'utf8');

  const filesToCopy = ['LICENSE', 'README.md'];

  await Promise.all(
    filesToCopy.map(async (file) => {
      const srcPath = join(config.workspaceRoot, file);

      try {
        await fs.access(srcPath);
        await fs.copyFile(srcPath, join(config.distDirectory, file));
      } catch {
        // ignore if file doesn't exist
      }
    })
  );

  const stats = await getBuildStats();

  console.log('\nBuild complete\n');

  console.log(`Output: ${relative(config.workspaceRoot, config.distDirectory)}\n`);

  console.log(createStatsTable(stats));

  console.log('\nSummary');

  console.log(`Total      : ${filesize(stats.total)}`);

  console.log(`Gzip total : ${filesize(stats.gzipTotal)}`);

  console.log();
};

const main = async () => {
  try {
    await build();
  } catch (error) {
    console.error('\nBuild failed\n');

    console.error(error instanceof Error ? error.message : String(error));

    process.exit(1);
  }
};

main();
