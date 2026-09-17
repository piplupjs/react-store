#!/usr/bin/env node

// @ts-check

/**
 * Release automation CLI.
 *
 * Handles:
 * - validating git state
 * - building the package
 * - bumping package version
 * - npm authentication
 * - publishing package
 * - creating git tags/releases
 */

import { join } from 'node:path';

import { getWorkspaceRoot, spawn, exec, readJson, writeJson } from './utils.mjs';

const workspaceRoot = getWorkspaceRoot();

const config = {
  workspaceRoot,
  distDirectory: join(workspaceRoot, 'dist'),
  distPackageJson: join(workspaceRoot, 'dist', 'package.json')
};

const parseArgs = (argv) => {
  const options = {
    bump: /** @type {'patch' | 'minor' | 'major'} */ ('patch'),
    dryRun: false,
    ci: false,
    message: /** @type {string | null} */ (null),
    remote: 'origin'
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    switch (arg) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--ci':
        options.ci = true;
        break;
      case '--message':
        options.message = argv[++index] ?? null;
        break;
      case '--remote':
        options.remote = argv[++index] ?? 'origin';
        break;
      case '--help':
        printHelp();
        process.exit(0);
      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unknown flag: ${arg}`);
        }

        options.bump = /** @type {'patch' | 'minor' | 'major'} */ (arg);
    }
  }

  return options;
};

const printHelp = () => {
  console.log(`
Release usage:

  release [patch|minor|major]

Flags:
  --dry-run      Simulate release
  --ci           CI mode
  --message      Custom commit message
  --remote       Git remote (default: origin)
`);
};

const assertCleanGitTree = (dryRun) => {
  if (dryRun) return;

  const { stdout } = exec('git', ['status', '--porcelain'], { silent: true });

  if (stdout.trim()) {
    throw new Error('Working tree not clean. Commit/stash changes first.');
  }
};

const build = (dryRun) => {
  if (dryRun) {
    console.log('[dry-run] build skipped');
    return;
  }

  exec('node', ['scripts/build.mjs'], {
    cwd: config.workspaceRoot
  });
};

const bumpVersion = async (type, dryRun) => {
  const pkg = await readJson(config.distPackageJson);

  const parts = pkg.version.split('.').map(Number);

  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error(`Invalid version: ${pkg.version}`);
  }

  const [major, minor, patch] = parts;

  const next =
    type === 'major'
      ? `${major + 1}.0.0`
      : type === 'minor'
        ? `${major}.${minor + 1}.0`
        : `${major}.${minor}.${patch + 1}`;

  if (dryRun) {
    console.log(`[dry-run] version ${pkg.version} -> ${next}`);

    return next;
  }

  pkg.version = next;

  await writeJson(config.distPackageJson, pkg);

  return next;
};

const ensureAuth = (dryRun, ci) => {
  const token = process.env.NPM_TOKEN ?? process.env.NODE_AUTH_TOKEN;

  if (ci) {
    if (token && !dryRun) {
      exec('npm', ['config', 'set', '//registry.npmjs.org/:_authToken', token]);
    }

    return;
  }

  const result = spawn('npm', ['whoami']);

  if (result.status !== 0 && !dryRun) {
    console.log('npm login required...');
    exec('npm', ['login']);
  }
};

const publish = (dryRun) => {
  if (dryRun) {
    console.log('[dry-run] npm publish skipped');
    return;
  }

  exec('npm', ['publish', '--access', 'public'], {
    cwd: config.distDirectory
  });
};

const releaseGit = (version, remote, message, dryRun) => {
  const tag = `v${version}`;
  const commitMessage = message ?? `chore(release): ${version}`;

  if (dryRun) {
    console.log(`[dry-run] git commit + tag ${tag}`);

    return;
  }

  exec('git', ['add', '-A']);
  exec('git', ['commit', '-m', commitMessage]);
  exec('git', ['tag', tag]);
  exec('git', ['push', remote, 'HEAD']);
  exec('git', ['push', remote, tag]);
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));

  const ci = options.ci || process.env.CI === 'true';

  try {
    assertCleanGitTree(options.dryRun);

    build(options.dryRun);

    const version = await bumpVersion(options.bump, options.dryRun);

    ensureAuth(options.dryRun, ci);

    publish(options.dryRun);

    releaseGit(version, options.remote, options.message, options.dryRun);

    console.log(`
Release successful

Version: ${version}
Tag    : v${version}
`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`
Release failed

${message}
`);

    process.exit(1);
  }
};

main();
