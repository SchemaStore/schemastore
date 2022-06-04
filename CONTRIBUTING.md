## JSON Schema

You can contribute in a variety of ways. For a detailed tutorial, read [Scott Addie](https://twitter.com/Scott_Addie)'s [**Community-Driven JSON Schemas in Visual Studio 2015**](https://scottaddie.com/2016/08/02/community-driven-json-schemas-in-visual-studio-2015/) blog post.

1. Submit new JSON schema files
2. Add a JSON schema file to the [catalog](#catalog)
3. Modify/update existing schema files

Versioning of schema files are handled by modifying the file name to include
the version number: *myschema-1.2.json*

When uploading a new schema file, make sure it targets a file that is commonly
used or has potential for broad uptake.

If you don't have Visual Studio (using macOS or Linux?), you can check your modifications are fine by running:
```sh
make
```

### <a name="catalog"></a>Adding to catalog

After adding schema files, register them in [schema catalog](src/api/json/catalog.json) by adding an entry corresponding to your schema:

```json
{
    "name": "Friendly schema name",
    "description": "Schema description",
    "fileMatch": [
        "list of well-known filenames matching schema"
    ],
    "url": "https://json.schemastore.org/<schemaName>.json"
}
```

### Best practices

✔️ **Use** the lowest possible schema draft needed, preferably Draft v4, to ensure interoperability with as many supported editors, IDEs and parsers as possible.

✔️ **Use** [`base.json`][base] schema with some common types for all schemas.

:x: **Don't forget** add test files.

- Be consistent across your schema: order properties and describe in the one style.
- Use `$comment` to note about something to developers. You can refer to some issues here.
- Use `title` when documentation mentions title explicitly.
- Always use `description`, `type`, `additionalProperties`.
  - Always set `additionalProperties` to `false` until documentation permits additional properties explicitly. that tool the JSON schema is created for can be changed in the future to allow wrong extra properties.
- Use `minLength`/`maxLength`/`pattern`/etc for property values.
- Don't end `title`/`description` values with colon.

[base]: https://github.com/SchemaStore/schemastore/blob/master/src/schemas/json/base.json

### Adding tests (for [local schemas](src/schemas/json) only)

To make sure that files are validated against your schema correctly (we strongly suggest adding at least one before creating a pull request):

1. Create a subfolder in [`src/test`](src/test) named as your schema file
2. Create one or more `.json, .yml or .yaml` files in that folder
3. Run `npm run build`

If the build succeeds, your changes are valid and you can safely create a PR.

#### Adding negative tests

To make sure that invalid files fail to validate against your schema, use a subfolder in [`src/negative_test/`](src/negative_test) instead.

### Self-hosting schemas

If you wish to retain full control over your schema definition, simply register it in the [schema catalog](src/api/json/catalog.json) by providing a `url` pointing to the self-hosted schema file to the [entry](#catalog). Example on how to handle [multiple schema versions.](https://github.com/SchemaStore/schemastore/pull/2057#issuecomment-1024470105)

### Ref from schema x.json to schema y.json

- Both schemas must exist [locally](src/schemas/json) in SchemaStore.
- Both schemas must have the same draft (example draft-04)
- Schema y.json must have `id` or `$id` with this value `"https://json.schemastore.org/y.json"`
- In schema x.json add ref to schema y.json `"$ref": "https://json.schemastore.org/y.json#..."`
- [schema-validation.json](src/schema-validation.json) in "options": [] list add
 `"x.json": {"externalSchema": ["y.json"]}`

### JSON formatter

This project contains an [`.editorconfig`](https://github.com/SchemaStore/schemastore/blob/master/.editorconfig) file.
If your IDE or code editor doesn't natively support it, please install the [EditorConfig](https://editorconfig.org) plugin.

### Validation mode

SchemaStore supports three types of schema validation mode.
- [Full strict mode](https://ajv.js.org/strict-mode.html) via AJV validator (SchemaStore default mode)
- Not fully strict mode via AJV validator. (The json filename is present in the `ajvNotStrictMode` list in [schema-validation.json](src/schema-validation.json))
- Validation via [tv4](https://github.com/geraintluff/tv4) (The json filename is present in the `tv4test` list in [schema-validation.json](src/schema-validation.json))
