# Editor Features

## Language Servers

There are language servers that use schemas from [SchemaStore](https://www.schemastore.org).

### YAML

- [`redhat-developer/yaml-language-server`](https://github.com/redhat-developer/yaml-language-server)
  - Used by the VSCode [Red Hat YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml)

### TOML

- [`tamasfe/taplo`](https://github.com/tamasfe/taplo)
  - Used by the VSCode [Even Better TOML extension](https://marketplace.visualstudio.com/items?itemName=tamasfe.even-better-toml)
    - Reads the `x-taplo` field to enhance the editing experience.

## Schema Properties

### `allowTrailingCommas`

Visual Studio Code [allows specifying](https://code.visualstudio.com/docs/languages/json) whether trailing commas are allowed in the schema itself. Use the [`allowTrailingCommas`](https://github.com/microsoft/vscode/issues/102061) field. See [this PR](https://github.com/SchemaStore/schemastore/pull/3259/files) if you wish to add this for your schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "allowTrailingCommas": true,
  ...
}
```

### `title` as an expected object type

Let's say you have the following schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "properties": {
    "first": {
      "title": "first",
      "type": "object"
    }
  },
  "title": "schema title"
}
```

If integer or another incorrect value is passed to `first`, then `Incorrect type. Expected "first".` error is shown. If `title` for this property is removed, then `Incorrect type. Expected "schema title".` is displayed. **The most nested `title` is used for the error message**.

### Undocumented Features

The use of undocumented features in schemas is permitted. However they must be labeled as such.

It is preferred to add `UNDOCUMENTED.` to the beginning of `description`.

```json
{
  "type": "object",
  "properties": {
    "experimental_useBranchPrediction": {
      "type": "string",
      "description": "UNDOCUMENTED. Enables branch prediction in the build."
    }
  }
}
```

However, that is not always possible or correct. Alternatively, use `$comment`:

```json
{
  "type": "object",
  "tsBuildInfoFile": {
    "$comment": "The value of 'null' is UNDOCUMENTED.",
    "description": "Specify the folder for .tsbuildinfo incremental compilation files.",
    "default": ".tsbuildinfo",
    "type": ["string", "null"],
    "description": "Specify the folder for .tsbuildinfo incremental compilation files."
  },
}
```

In this case, `{ "tsBuildInfoFile": null }` is not documented. Using a string value is, however.
