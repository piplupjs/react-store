import { combine, presets, rules } from '@piplup/code-infra/oxlint';

export default combine(presets.recommended, presets.test, {
  overrides: [
    {
      // Node.js build and release scripts.
      files: ['scripts/**'],
      rules: rules({ 'compat/compat': 'off', 'no-console': 'off' }),
    },
  ],
  rules: rules({
    // NodeNext module resolution needs the `.js` extension on relative imports.
    'import/extensions': ['error', 'ignorePackages', { js: 'always', mjs: 'always' }],
  }),
});
