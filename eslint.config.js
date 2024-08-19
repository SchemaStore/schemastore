import js from '@eslint/js'
import promise from 'eslint-plugin-promise'
import node from 'eslint-plugin-n'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

/** @type {import('eslint').Linter.FlatConfig} */
export default [
  {
    ignores: ['**/schema.json.translated.to.js'],
  },
  promise.configs['flat/recommended'],
  node.configs['flat/recommended-script'],
  prettier,
  {
    languageOptions: {
      globals: {
        ...globals.es2021,
        ...globals.node,
      },
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-empty': 'off',
      'no-unused-vars': 'off',
      'object-shorthand': ['error', 'always'],
      'n/no-process-exit': 'off',
    },
  },
]
