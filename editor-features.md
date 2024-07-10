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

## Custom Schema Properties

### VSCode

- `allowTrailingCommas`
- `defaultSnippets`
- `markdownDescription`

#### `allowTrailingCommas`

Visual Studio Code [allows specifying](https://code.visualstudio.com/docs/languages/json) whether trailing commas are allowed in the schema itself. Use the [`allowTrailingCommas`](https://github.com/microsoft/vscode/issues/102061) field. See [this PR](https://github.com/SchemaStore/schemastore/pull/3259/files) if you wish to add this for your schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "allowTrailingCommas": true,
  ...
}
```

### Taplo

- `x-taplo`
- `x-taplo-info`

More information [here](https://taplo.tamasfe.dev/configuration/developing-schemas.html).

### IntelliJ

- `x-intellij-language-injection`
- `x-intellij-html-description`
- `x-intellij-enum-metadata`
