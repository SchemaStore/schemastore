# Contributing

- [Contributing](#contributing)
  - [Introduction](#introduction)
  - [Overview](#overview)
  - [Recommended Extensions](#recommended-extensions)
  - [Troubleshooting](#troubleshooting)
  - [Best practices](#best-practices)
  - [How-to](#how-to)
    - [How to add a JSON Schema that's local to this repository](#how-to-add-a-json-schema-thats-local-to-this-repository)
    - [How to add a JSON Schema that's self-hosted/remote/external](#how-to-add-a-json-schema-thats-self-hostedremoteexternal)
    - [How to add a schema with multiple versions](#how-to-add-a-schema-with-multiple-versions)
    - [How to move a schema from SchemaStore to somewhere that's self-hosted](#how-to-move-a-schema-from-schemastore-to-somewhere-thats-self-hosted)
    - [How to include a `$ref` to a SchemaStore schema](#how-to-include-a-ref-to-a-schemastore-schema)
    - [How to include a `$ref` to an external schema](#how-to-include-a-ref-to-an-external-schema)
    - [How to validate schema in non-strict mode](#how-to-validate-schema-in-non-strict-mode)

## Introduction

Welcome! Thank you for contributing to SchemaStore!

There are various ways you can contribute:

- Add a new JSON Schema
  - Local schema
  - Remote schema
- Enhance existing JSON schemas:
  - Fix typos
  - Fix bugs
  - Improve constraints
  - Add positive/negative tests
  - Refactor to pass under strict mode

Most people want to add a new schema. For steps on how to do this, read the [How to add a new JSON Schema](#how-to-add-a-json-schema-thats-local-to-this-repository) section below.

If you want to contribute, but not sure what needs fixing, see the [help wanted](https://github.com/SchemaStore/schemastore/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3A%22help+wanted%22) and [good first issue](https://github.com/SchemaStore/schemastore/issues?q=is%3Aopen+label%3A%22good+first+issue%22+sort%3Aupdated-desc) labels on GitHub.

## Overview

Schema files are located in `src/schemas/json`. Each schema file has a corresponding entry in the [Schema Catalog](src/api/json/catalog.json). Each catalog entry has a `fileMatch` field. IDEs use this field to know which files the schema should be used for (in autocompletion).

Some schema files have associated positive and negative tests, located at `src/test` and `src/negative_test`, respectively. This repository has Grunt tasks that automatically load these files and use a validator (either [AJV](https://ajv.js.org) or [SchemaSafe](https://github.com/ExodusMovement/schemasafe)) to ensure that they either pass or fail validation.

There are three types of schema validation modes:

- [AJV](https://ajv.js.org) [strict mode](https://ajv.js.org/strict-mode.html): The default validation mode that is most stringent
- [AJV](https://ajv.js.org) non-strict mode: Some rules are relaxed for the sake of brevity. To validate under non-strict mode, add your schema to the `ajvNotStrictMode` field in [schema-validation.json](src/schema-validation.json)
- [SchemaSafe](https://github.com/ExodusMovement/schemasafe): Helps catch errors within schemas that would otherwise be missed. This is a WIP.

## Recommended Extensions

We highly recommend installing the following extensions for your IDE:

- [EditorConfig](https://editorconfig.org) to automatically configure editor settings
- [Prettier](https://prettier.io) to automatically configure file formatting

If you are modifying JavaScript files, we also recommend:

- [ESLint](https://eslint.org) to automatically show JavaScript issues

## Troubleshooting

- There may be `git merge` conflicts in `catalog.json` because you added the item to the end of the list instead of alphabetically
- The `pre-commit` build server failed because the PR was created/push from an organization and not from your own account

## Best practices

✔️ **Use** the most recent JSON Schema version (specified by `$schema`) that's widely supported by editors and IDEs. Currently, the best supported version is `draft-07`. Later versions of JSON Schema are not recommended for use in SchemaStore until editor/IDE support improves for those versions.

✔️ **Use** [`base.json`][base] schema for `draft-07` and [`base-04.json`][base-04] for `draft-04` with some common types for all schemas.

You can also prefer our own [unofficial draft-07][unofficial-draft-07] schema with more extensive validation capabilities like:

- `type`, `title`, `description` properties are required
- empty arrays are forbidden in most cases, for instance, it's impossible to write less than 2 sub-schemas for `allOf`
- `type` can't be an array, which is intentional, `anyOf`/`oneOf` should be used in this case
- links to https://json-schema.org/understanding-json-schema/index.html available for almost all hints

[unofficial-draft-07]: https://json.schemastore.org/metaschema-draft-07-unofficial-strict.json

:x: **Don't forget** add test files.

- Always be consistent across your schema: order properties and describe in the one style.
- Always use `$comment` to note about something to developers. You can refer to some issues here.
- Always use `title` when property type is an object to enhance editor experience which use
  this property to show errors (like VS Code). [Why](./editor-features.md)?
- Always use `description`, `type`, `additionalProperties`.
  - Always set `additionalProperties` to `false` until documentation permits
    additional properties explicitly. That tool the JSON schema is created for
    can be changed in the future to allow wrong extra properties.
- Always use `minLength`/`maxLength`/`pattern`/etc for property values.
- Don't end `title`/`description` values with colon.
- Always omit leading articles for `title`-s and trailing punctuation to make
  expected object values look more like types in programming languages. Also
  start `title`-s with a lowercase letter and try use nouns for titles instead of sentences.
- Always explicitly state whether some setting is global for some tool or local
  for a project created with this tool. For instance if some settings is local
  then add `for the current <project-type>` at the end of the `description` like
  `Whether to ignore a theme configuration for the current site` for `Jekyll`.
- Always add documentation url to descriptions when available in the following
  format: `<description>\n<url>` like `"Whether to ignore a theme configuration for the current site\nhttps://jekyllrb.com/docs/configuration/options/#global-configuration"`.
- Don't add undocumented properties or features to the schema.

[base]: https://github.com/SchemaStore/schemastore/blob/master/src/schemas/json/base.json
[base-04]: https://github.com/SchemaStore/schemastore/blob/master/src/schemas/json/base-04.json

## How-to

### How to add a JSON Schema that's local to this repository

Follow these instructions if you want to add the JSON schema file directly to this repository. If you want to keep the JSON schema hosted elsewhere, see [How to add a JSON Schema that's self-hosted/remote/external](#how-to-add-a-json-schema-thats-self-hostedremoteexternal).

When uploading a new schema file, make sure it targets a file that is commonly used or has potential for broad uptake.

First, clone the repository:

```sh
git clone https://github.com/SchemaStore/schemastore
cd schemastore
```

Be sure that [NodeJS](https://nodejs.org) is installed. The minimum required NodeJS version is defined by the `engines` key in [package.json](src/package.json). Now, install dependencies and run the `new_schema` Grunt task:

```sh
cd src
npm install
npm run grunt new_schema
```

You will be prompted for the name of the schema. Once you enter your schema name, the task will:

- Create a new schema file at `src/schemas/json/<schemaName>.json`
- Create a positive test file at `src/test/<schemaName>/<schemaName>.json`
- Print a string for you to add to the [Schema Catalog](src/api/json/catalog.json)

If you do not wish to use the `new_schema` Grunt task, the manual steps are listed below 👇

<details>

<summary>Manual Steps</summary>

1. Create a schema file in `src/schemas/json/<name>.json`:

   ```json
   {
     "$id": "https://json.schemastore.org/<schemaName>.json",
     "$schema": "http://json-schema.org/draft-07/schema#",
     "additionalProperties": true,
     "properties": {},
     "type": "object"
   }
   ```

2. Add positive test files at `src/test/<schemaName>/<testFile>`: (optional, but _strongly_ recommended)

   File extensions `.json`, `.toml`, `.yml`, and `.yaml` are supported.

3. Add negative test files at `src/negative_test/<schemaName>/<testFile>` (optional)

4. Register your schema (in alphabetical order) in the [schema catalog](src/api/json/catalog.json):

   ```json
   {
     "description": "Schema description",
     "fileMatch": ["list of well-known filenames matching schema"],
     "name": "Friendly schema name",
     "url": "https://json.schemastore.org/<schemaName>.json"
   }
   ```

</details>

Once you have created the schema and its associated testing files, you can run the Grunt task that validates that your schema is correct:

```sh
cd src
npm run grunt
```

To test a single schema, execute `npm run grunt -- --SchemaName=<schemaName.json>`.

Note that `<schemaName.json>` refers to the _filename_ that the schema has under `src/schemas/json`. If the task succeeds, your changes are valid and you can safely create a PR.

### How to add a JSON Schema that's self-hosted/remote/external

You may wish to serve a schema from `https://json.schemastore.org/<schemaName>.json`, but keep the content of the schema file at a place you control (not this repository).

See [this PR](https://github.com/SchemaStore/schemastore/pull/1211/files) as an example. Simply register your schema in the [schema catalog](src/api/json/catalog.json), with the `url` field pointing to your schema file:

```json
{
  "name": "hydra.yml",
  "description": "ORY Hydra configuration file",
  "fileMatch": [
    "hydra.json",
    "hydra.yml",
    "hydra.yaml",
    "hydra.toml"
  ],
  "url": "https://raw.githubusercontent.com/ory/hydra/master/.schema/version.schema.json"
},
```

### How to add a schema with multiple versions

Refer to this [`agripparc` PR](https://github.com/SchemaStore/schemastore/pull/1950/files) as an example. First, your schema names should be postfixed with the version number.

- `src/schemas/json/agripparc-1.2.json`
- `src/schemas/json/agripparc-1.3.json`
- `src/schemas/json/agripparc-1.4.json`

Then, use the `versions` field to list each of them. Add the latest version to the `url` field:

```json
{
  "description": "JSON schema for the Agrippa config file",
  "fileMatch": [".agripparc.json", "agripparc.json"],
  "name": ".agripparc.json",
  "url": "https://json.schemastore.org/agripparc-1.4.json",
  "versions": {
    "1.2": "https://json.schemastore.org/agripparc-1.2.json",
    "1.3": "https://json.schemastore.org/agripparc-1.3.json",
    "1.4": "https://json.schemastore.org/agripparc-1.4.json"
  }
}
```

### How to move a schema from SchemaStore to somewhere that's self-hosted

Simply changing the `url` field in the schema catalog (as described [here](#how-to-add-a-json-schema-thats-self-hostedremoteexternal)) is not enough. You must also:

- Keep the original schema files in the repository and point to your schema with `$ref`
- Add an entry under `skiptest` so the remaining schema file isn't tested

See [this PR](https://github.com/SchemaStore/schemastore/pull/2421/files) for a full example.

### How to include a `$ref` to a SchemaStore schema

`$ref` from `schema_x.json` to `schema_y.json`

- Both schemas must exist [locally](src/schemas/json) in SchemaStore.
- Both schemas must have the same draft (ex. `draft-07`)
- `schema_y.json` must have `id` or `$id` with this value `"https://json.schemastore.org/schema_y.json"`
- In `schema_x.json`, add ref to `schema_y.json`: `"$ref": "https://json.schemastore.org/schema_y.json#..."`
- Within [schema-validation.json](./src/schema-validation.json), in `"options": []`, add an entry:
  `{ "schema_x.json": {"externalSchema": ["schema_y.json"] } }`

### How to include a `$ref` to an external schema

This currently isn't possible. This is tracked by [issue #2731](https://github.com/SchemaStore/schemastore/issues/2731).

### How to validate schema in non-strict mode

> **Info** > **Please only do this if you _must_. Validating in strict mode catches many common errors by schema authors and improves schema quality.**

When validating your schema, you may encounter errors like:

```txt
>> compile              | schemas/json/prefect-deploy.json (draft-07)(FullStrictMode)
>> Error: strict mode: use allowUnionTypes to allow union type keyword at "#/definitions/prefect_docker.deployments.steps.push_docker_image/properties/credentials" (strictTypes)
```

A full list is available at the [avj documentation](https://ajv.js.org/strict-mode.html#prevent-unexpected-validation). To disable any of the strict validation errors, please add your schema file to the `ajvNotStrictMode` field in `src/schema-validation.json`.
