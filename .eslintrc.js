module.exports = {
  extends: 'erb',
  plugins: ['@typescript-eslint'],
  overrides: [
    {
      files: ['src/tests/**/*.{ts,tsx}', 'src/**/__tests__/**/*.{ts,tsx}'],
      env: { jest: true },
      rules: {
        // Keep unused vars as warnings for tests (allows test setup flexibility)
        // Use _ prefix for intentionally unused: const _user = setupUser()
        '@typescript-eslint/no-unused-vars': [
          'warn', // Warn instead of error for test files
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            ignoreRestSiblings: true,
          },
        ],
        'class-methods-use-this': 'off',
        'promise/param-names': 'off',
      },
    },
  ],
  rules: {
    // A temporary hack related to IDE not resolving correct package.json
    'import/no-extraneous-dependencies': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/jsx-filename-extension': 'off',
    'import/extensions': 'off',
    'import/no-unresolved': 'off',
    'import/no-import-module-exports': 'off',
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': 'error',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
    // TS + React: we don't use prop-types
    'react/prop-types': 'off',
    'react/require-default-props': 'off',
    'react/no-unused-prop-types': 'off',
    // Allow inline handlers in this app
    'react/jsx-no-bind': 'off',
    // A11y rules that conflict with current UI
    'jsx-a11y/click-events-have-key-events': 'off',
    'jsx-a11y/no-static-element-interactions': 'off',
    'jsx-a11y/interactive-supports-focus': 'off',
    // Style relaxations to match existing code
    'no-plusplus': 'off',
    'no-nested-ternary': 'off',
    'no-void': 'off',
    'no-multi-str': 'off',
    'no-restricted-syntax': 'off',
    'no-empty': 'off',
    'global-require': 'off',
    'import/prefer-default-export': 'off',
    'react/function-component-definition': 'off',
    'no-use-before-define': ['off'],
    'promise/catch-or-return': 'off',
    'promise/always-return': 'off',
    'no-promise-executor-return': 'off',
    'no-bitwise': 'off',
    'react-hooks/exhaustive-deps': 'warn',
    'react/button-has-type': 'off',
    'react/no-array-index-key': 'off',
    'jsx-a11y/label-has-associated-control': 'off',
    'jsx-a11y/no-noninteractive-element-interactions': 'off',
    'consistent-return': 'off',
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  settings: {
    'import/resolver': {
      // See https://github.com/benmosher/eslint-plugin-import/issues/1396#issuecomment-575727774 for line below
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        moduleDirectory: ['node_modules', 'src/'],
      },
      webpack: {
        config: require.resolve('./.erb/configs/webpack.config.eslint.ts'),
      },
      typescript: {},
    },
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
  },
};
