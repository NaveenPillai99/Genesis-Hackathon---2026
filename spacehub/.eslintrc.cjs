module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:react-hooks/recommended'],
  parserOptions: { ecmaVersion: 2021, sourceType: 'module', ecmaFeatures: { jsx: true } },
  settings: { react: { version: '18.3' } },
  plugins: ['react', 'react-hooks'],
  ignorePatterns: ['dist', 'node_modules'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
}
