/** @type {unknown} */
let prettierPluginSortJson
try {
  // When running scripts locally (through npm-run-script), the relative path of the plugin
  // must be specified since 'require.resolve' will not find it by itself in subdirectory 'src'.
  prettierPluginSortJson = require.resolve(
    './src/node_modules/prettier-plugin-sort-json',
  )
} catch (err) {
  // In pre-commit CI, 'prettier-plugin-sort-json' is installed to some directory (which is in $NODE_PATH).
  // As as result, simply require.resolve to find the full path to the dependency.
  prettierPluginSortJson = require.resolve('prettier-plugin-sort-json')
}
if (!prettierPluginSortJson) {
  throw new Error(`Failed to import plugin: 'prettier-plugin-sort-json'`)
}

/** @type {import('./src/node_modules/prettier').Config} */
module.exports = {
  plugins: [prettierPluginSortJson],
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
        $schema: null,
        $id: null,
        $comment: null,
        jsonRecursiveSort: true,
        jsonSortOrder: JSON.stringify({
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
