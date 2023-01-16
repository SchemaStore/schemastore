# Visual Studio Code

This editor uses [Red Hat YAML](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) extension to enable intellisence and JSON schema validation.

## `title` as an expected object type

Let's say you have the following schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema",
  "properties": {
    "first": {
      "title": "first",
      "type": "object"
    }
  },
  "title": "schema title"
}
```

If integer or another incorrect value is passed to `first` than
`Incorrect type. Expected "first".` error is shown. If `title` for this property
is removed than `Incorrect type. Expected "schema title".` is displayed. It leads us to
the following extension feature: **the most nested `title` is used for the error message**.
