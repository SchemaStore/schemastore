/** @type {import('prettier').Config} */
module.exports = {
  // pre-commit.ci fails without `require.resolve()`.
  plugins: [require.resolve('prettier-plugin-sort-json')],
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
          '/^[^\\d+]/': 'none',
          '/^\\d+/': 'none',
        }),
      },
    },
    {
      files: 'src/schema-validation.json',
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
          '/^[^\\d+]/': 'lexical',
          '/^\\d+/': 'numeric',
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
          '/^[^\\d+]/': 'none',
          '/^\\d+/': 'none',
        }),
      },
    },
  ],
}
