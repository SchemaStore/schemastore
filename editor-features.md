# Editor Features

## LSPs

For YAML, [`redhat-developer/yaml-language-server`](https://github.com/redhat-developer/yaml-language-server) is popular. For VSCode, this is used by the [Red Hat YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml)

For TOML, [`tamasfe/taplo`](https://github.com/tamasfe/taplo) is popular. For VSCode, this is used by the [Even Better TOML](https://marketplace.visualstudio.com/items?itemName=tamasfe.even-better-toml) extension. Some JSON Schemas have `x-taplo` fields to improve the editing experience.

## Schema Properties

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
