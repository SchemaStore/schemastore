/** @type {import('prettier').Config} */
module.exports = {
  // pre-commit.ci fails without `require.resolve()`.
  plugins: [
    require.resolve('prettier-plugin-sort-json'),
    require.resolve('prettier-plugin-toml'),
  ],
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  jsonRecursiveSort: true,
  jsonSortOrder: JSON.stringify({
    '/^[^\\d+]/': 'none',
    '/^\\d+/': 'none',
  }),
  overrides: [
    {
      files: '*.jsonc',
      options: {
        trailingComma: 'none',
      },
    },
    {
      files: 'src/api/json/catalog.json',
      options: {
        jsonRecursiveSort: true,
        jsonSortOrder: JSON.stringify({
          $schema: null,
          version: null,
          name: null,
          description: null,
          fileMatch: null,
          url: null,
          versions: null,
          // Set to "none" to prevent lexical sorting of version strings.
          '/^[^\\d+]/': 'none',
          '/^\\d+/': 'none',
        }),
      },
    },
    {
      files: 'src/schema-validation.jsonc',
      options: {
        jsonRecursiveSort: true,
        jsonSortOrder: JSON.stringify({
          $schema: null,
          $id: null,
          $comment: null,
          ajvNotStrictMode: null,
          fileMatchConflict: null,
          highSchemaVersion: null,
          missingCatalogUrl: null,
          skiptest: null,
          catalogEntryNoLintNameOrDescription: null,
          options: null,
          externalSchema: null,
          unknownKeywords: null,
          unknownFormat: null,
          '/^[^\\d+]/': null,
          '/^\\d+/': null,
        }),
      },
    },
    {
      files: 'src/{test,negative_test}/**',
      options: {
        jsonRecursiveSort: true,
        jsonSortOrder: JSON.stringify({
          '/^[^\\d+]/': null,
          '/^\\d+/': null,
        }),
      },
    },
    {
      files: 'src/schemas/json/**',
      options: {
        jsonRecursiveSort: true,
        jsonSortOrder: JSON.stringify({
          $schema: null,
          $id: null,
          $comment: null,
          $ref: null,
          '/^\\$.*/': null,
          '/^[^\\d+]/': 'none',
          '/^\\d+/': 'none',
          if: null,
          then: null,
          else: null,
        }),
      },
    },
    {
      files: 'src/test/bun-lock/bun.lock.json',
      options: {
        jsonRecursiveSort: false,
        jsonSortOrder: JSON.stringify({
          '.': 'none',
          '*': 'none',
          lockfileVersion: 'none',
          workspaces: 'none',
          '/^\\$.*/': null,
        }),
        bracketSameLine: true,
        printWidth: 100000000000,
      },
    },
  ],
}
