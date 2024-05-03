<!-- markdownlint-disable no-inline-html -->
<!-- markdownlint-disable no-emphasis-as-heading -->

# Contributing <!-- omit from toc -->

- [Introduction](#introduction)
- [Overview](#overview)
- [Recommended Extensions](#recommended-extensions)
- [Schema Authoring](#schema-authoring)
  - [Best practices](#best-practices)
    - [Avoiding overconstraint](#avoiding-overconstraint)
  - [Undocumented Features](#undocumented-features)
  - [API Compatibility](#api-compatibility)
  - [Troubleshooting](#troubleshooting)
- [How-to](#how-to)
  - [How to add a JSON Schema that's hosted in this repository](#how-to-add-a-json-schema-thats-hosted-in-this-repository)
  - [How to add a JSON Schema that's self-hosted/remote/external](#how-to-add-a-json-schema-thats-self-hostedremoteexternal)
  - [How to edit an existing JSON Schema](#how-to-edit-an-existing-json-schema)
  - [How to add a JSON Schema with multiple versions](#how-to-add-a-json-schema-with-multiple-versions)
  - [How to move a JSON Schema from SchemaStore to somewhere that's self-hosted](#how-to-move-a-json-schema-from-schemastore-to-somewhere-thats-self-hosted)
  - [How to add a `$ref` to a JSON Schema that's hosted in this repository](#how-to-add-a-ref-to-a-json-schema-thats-hosted-in-this-repository)
  - [How to add a `$ref` to a JSON Schema that's self-hosted](#how-to-add-a-ref-to-a-json-schema-thats-self-hosted)
  - [How to validate a JSON Schema](#how-to-validate-a-json-schema)
  - [How to ignore validation errors in a JSON Schema](#how-to-ignore-validation-errors-in-a-json-schema)
  - [How to name schemas that are subschemas (`partial-`)](#how-to-name-schemas-that-are-subschemas-partial-)

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

Most people want to add a new schema. For steps on how to do this, read the [How to add a JSON Schema that's hosted in this repository](#how-to-add-a-json-schema-thats-hosted-in-this-repository) section below.

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

## Schema Authoring

The goal of JSON Schemas in this repository is to correctly validate schemas that are used by the actual tools. That means, if a property is undocumented or deprecated, it should still be included in the schema.

### Best practices

✔️ **Use** the most recent JSON Schema version (specified by `$schema`) that's widely supported by editors and IDEs. Currently, the best supported version is `draft-07`. Later versions of JSON Schema are not recommended for use in SchemaStore until editor/IDE support improves for those versions.

✔️ **Use** [`base.json`][base] schema for `draft-07` and [`base-04.json`][base-04] for `draft-04` with some common types for all schemas.

There is an [unofficial draft-07][draft-07-unofficial-strict] schema that uses JSON Schema to validate your JSON Schema. It checks that:

- `type`, `title`, `description` properties are required
- There are no empty arrays. For instance, it's impossible to write less than 2 sub-schemas for `allOf`
- `type` can't be an array, which is intentional, `anyOf`/`oneOf` should be used in this case
- It links to [understanding-json-schema](https://json-schema.org/understanding-json-schema/index.html) for each hint/check

❌ **Don't forget** add test files.

- Always be consistent across your schema: order properties and describe in the one style.
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

[base]: https://github.com/SchemaStore/schemastore/blob/master/src/schemas/json/base.json
[base-04]: https://github.com/SchemaStore/schemastore/blob/master/src/schemas/json/base-04.json
[draft-07-unofficial-strict]: https://json.schemastore.org/metaschema-draft-07-unofficial-strict.json

#### Avoiding overconstraint

Sometimes, constraints do more harm than good. For example, [cron strings](http://pubs.opengroup.org/onlinepubs/7908799/xcu/crontab.html) validation regexes. False positives are likely as due to their complexity and abundance of implementations; and, when there is an error, the error message isn't helpful. Such cases can include:

- cron regexes
- string-embedded DSLs
- SSH URLs, HTTPS URLs, and other complex URIs

### Undocumented Features

The use of undocumented features in schemas is permitted and encouraged. However they must be labeled as such.

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
  }
}
```

In this case, `{ "tsBuildInfoFile": null }` is not documented. Using a string value is, however.

Note that JSON Schema draft `2019-09` adds support for a `deprecated` field. While this would be the best option, most schemas in this repository are `draft-07` - and as a result, Editors and IDEs may not use it.

### API Compatibility

Care must be taken to reduce breaking changes; some include:

**1. Preserving schema names**

When renaming a schema name, the old version must continue to exist. Its content will look something like:

```json
{
  "$ref": "https://json.schemastore.org/NEWNAME.json"
}
```

**2. Preserving schema paths**

Many tools, such as [validate-pyproject](https://github.com/abravalheri/validate-pyproject), accept passing in subpaths for validation like so:

```sh
validate-pyproject --tool cibuildwheel=https://json.schemastore.org/cibuildwheel.toml#/properties/tool/properties
```

This means that renames in subschema paths aren't zero-cost. If a rename is necessary, keep the old path and `$ref` where necessary.

### Troubleshooting

- There may be `git merge` conflicts in `catalog.json` because you added the item to the end of the list instead of alphabetically
- The `pre-commit` build server failed because the PR was created/push from an organization and not from your own account

## How-to

### How to add a JSON Schema that's hosted in this repository

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

Finally, validate your changes. See [How to Validate a JSON Schema](#how-to-validate-a-json-schema) for details.

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

### How to edit an existing JSON Schema

First, clone the repository:

```sh
git clone https://github.com/SchemaStore/schemastore
cd schemastore
```

Be sure that [NodeJS](https://nodejs.org) is installed. The minimum required NodeJS version is defined by the `engines` key in [package.json](src/package.json).

Now, modify the schema you intend to modify. Schemas are located under `src/schemas/json`.

Finally, validate your changes. See [How to Validate a JSON Schema](#how-to-validate-a-json-schema) for details.

### How to add a JSON Schema with multiple versions

Refer to this [`agripparc` PR](https://github.com/SchemaStore/schemastore/pull/1950/files) as an example. First, your schema names should be suffix with the version number.

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

### How to move a JSON Schema from SchemaStore to somewhere that's self-hosted

Simply changing the `url` field in the schema catalog (as described [here](#how-to-add-a-json-schema-thats-self-hostedremoteexternal)) is not enough. You must also:

- Keep the original schema files in the repository and point to your schema with `$ref`
- Add an entry under `skiptest` so the remaining schema file isn't tested

See [this PR](https://github.com/SchemaStore/schemastore/pull/2421/files) for a full example.

### How to add a `$ref` to a JSON Schema that's hosted in this repository

`$ref` from `schema_x.json` to `schema_y.json`

- Both schemas must exist [locally](src/schemas/json) in SchemaStore.
- Both schemas must have the same draft (ex. `draft-07`)
- `schema_y.json` must have `id` or `$id` with this value `"https://json.schemastore.org/schema_y.json"`
- In `schema_x.json`, add ref to `schema_y.json`: `"$ref": "https://json.schemastore.org/schema_y.json#..."`
- Within [schema-validation.json](./src/schema-validation.json), in `"options": []`, add an entry:
  `{ "schema_x.json": {"externalSchema": ["schema_y.json"] } }`

### How to add a `$ref` to a JSON Schema that's self-hosted

This currently isn't possible. This is tracked by [issue #2731](https://github.com/SchemaStore/schemastore/issues/2731).

### How to validate a JSON Schema

This repository validations JSON Schemas in multiple ways:

- "Meta validation"
  - Check there are no unused files or directories
  - Check that schema is valid JSON
  - Check that the entry in `catalog.json` is valid
  - etc.
- AJV strict mode validation
  - Checks schema to prevent any unexpected behaviors or silently ignored mistakes
  - Fixing strict mode errors does not change validation results, it only serves to improve schema quality
  - More info at [Ajv Strict mode docs](https://ajv.js.org/strict-mode.html#strict-schema)
- Schema validation
  - Actually uses the schema against any test files
  - Checks that schemas properly constrain the object as schema authors intended

To validate all schemas, run:

```console
npm run grunt
```

Because there are hundreds of schemas, you may only want to validate a single one to save time. To do this, run:

```console
npm run grunt -- --SchemaName=<schemaName.json>
```

For example, to validate the [`ava.json`](https://github.com/SchemaStore/schemastore/blob/master/src/schemas/json/ava.json) schema, run `npm run grunt -- --SchemaName=ava.json`

Note that `<schemaName.json>` refers to the _filename_ that the schema has under `src/schemas/json`. If the task succeeds, your changes are valid and you can safely create a PR.

### How to ignore validation errors in a JSON Schema

> **Note**
> Please only do this if you _must_. Validating in strict mode catches many common errors by schema authors and improves schema quality.

Sometimes, the build fails due to a failed validation check. See a list of validation checks [here](#how-to-validate-a-json-schema). An error may look like:

```txt
>> compile              | schemas/json/prefect-deploy.json (draft-07)(FullStrictMode)
>> Error: strict mode: use allowUnionTypes to allow union type keyword at "#/definitions/prefect_docker.deployments.steps.push_docker_image/properties/credentials" (strictTypes)
```

To ignore most validation errors, you need to modify `src/schema-validation.json`:

- If a strict error fails, you need to add your JSON Schema to the `ajvNotStrictMode` array
- If you are getting "unknown format" or "unknown keyword" errors, you need to add your JSON Schema to the `options` array
- If you are using a recent version of the JSON Schema specification, you will need to add your JSON Schema to the `highSchemaVersion` array

### How to name schemas that are subschemas (`partial-`)

Often, it is useful to extract a subschema into its own file. This can make it easier to write tests, find schemas pertaining to a particular project, and logically separate extremely large schemas. The `partial-` prefix makes it easier for SchemaStore developers and subschema consumers to identify that the schema is a subschema.

A subschema should be extracted to its own file based on the following rules:

- If a schema represents an existing project that could be its own file, then simply use that file for the "subschema". In other places, `$ref` that file where appropriate.
  - For example, [mypy](https://mypy-lang.org) reads configuration from both `mypy.ini` and `pyproject.toml`'s `tool.mypy` key. Because `mypy.ini` is its own file, then name the schema `mypy.json` like you usually would.
  - Same with [Prettier](https://prettier.io). It reads from `.prettierrc.json` (among other files) and `package.json`'s `prettier` key.
- If the schema cannot be its own file, then extracting the subschema may be an improvement
  - For example, [Poetry](https://python-poetry.org) reads configuration _only_ from `pyproject.toml`'s `tool.poetry` key. Because the Poetry subschema is relatively complex and a large project, it has been extracted to its own file, `partial-poetry.json`.
- If the schema must exist locally to workaround issue #2731, then the subschema should be extracted
  - In a top-level `$comment`, you must add the date at which you copied the original. See #3526 for an example

Use your best judgement; if the project or schema is small, then the drawbacks of extracting the subschema to its own file likely outweigh the benefits.
