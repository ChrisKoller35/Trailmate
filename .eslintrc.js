module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier', // Deaktiviert ESLint-Regeln die mit Prettier kollidieren
  ],
  settings: {
    react: { version: 'detect' },
  },
  env: {
    es2021: true,
    node: true,
  },
  rules: {
    // React 17+ braucht kein "import React" mehr
    'react/react-in-jsx-scope': 'off',

    // Erlaubt TypeScript-spezifische "unused vars" statt der Standard-Regel
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

    // Nicht zu streng für ein laufendes Projekt
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-require-imports': 'off',
    'react/prop-types': 'off', // Wir nutzen TypeScript statt PropTypes

    // React Hooks Regeln (wichtig für Bugs!)
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // React Compiler Regeln – als Warnung, da kein React Compiler aktiv
    'react-hooks/set-state-in-effect': 'warn',
    'react-hooks/preserve-manual-memoization': 'warn',
    'react-hooks/immutability': 'warn',
    'react-hooks/refs': 'warn',
  },
  ignorePatterns: ['node_modules/', '.expo/', 'dist/', 'babel.config.js'],
};
