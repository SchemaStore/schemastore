<!-- markdownlint-disable no-inline-html -->
<!-- markdownlint-disable no-emphasis-as-heading -->

# Contributing <!-- omit from toc -->

- [Introduction](#introduction)
- [Overview](#overview)
- [Recommended Extensions](#recommended-extensions)
- [Schema Authoring](#schema-authoring)
  - [Best practices](#best-practices)
    - [Avoiding Overconstraint](#avoiding-overconstraint)
    - [Undocumented Features](#undocumented-features)
    - [Deprecated Features](#deprecated-features)
    - [API Compatibility](#api-compatibility)
    - [Documenting Enums](#documenting-enums)
  - [Language Server Features](#language-server-features)
    - [Non-standard Properties](#non-standard-properties)
  - [Using the `CODEOWNERS` file](#using-the-codeowners-file)
- [Schema Validation](#schema-validation)
  - [Ajv strict mode](#ajv-strict-mode)
  - [Ajv non-strict mode](#ajv-non-strict-mode)
  - [SchemaSafe](#schemasafe)
- [About `catalog.json`](#about-catalogjson)
  - [Avoiding Generic Names](#avoiding-generic-names)
- [Compatible Language Servers and Tools](#compatible-language-servers-and-tools)
  - [`redhat-developer/yaml-language-server`](#redhat-developeryaml-language-server)
  - [`tamasfe/taplo`](#tamasfetaplo)
  - [`Microsoft/vscode-json-languageservice`](#microsoftvscode-json-languageservice)
  - [Other](#other)
- [Troubleshooting](#troubleshooting)
  - [Dependency Errors](#dependency-errors)
  - [`pre-commit` fails to format files in CI](#pre-commit-fails-to-format-files-in-ci)
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
- [Older Links](#older-links)
  - [use-of-codeowners-file](#use-of-codeowners-file)

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

Some schema files have associated positive and negative tests, located at `src/test` and `src/negative_test`, respectively. These tests may be in JSON, YAML, or TOML format.

Multiple libraries are used for validation to increase the compatibility and correctness of schemas. All schemas must correctly validate against their positive and negative tests using [Ajv](https://ajv.js.org). Other JSON Schema libraries can be optionally used. And, the schemas themselves can be linted using "Ajv strict mode" and other libraries. More details under [Schema Validation](#schema-validation).

## Recommended Extensions

We _highly recommend_ installing the following extensions for your IDE:

- [EditorConfig](https://editorconfig.org) to automatically configure editor settings
- [Prettier](https://prettier.io) to automatically configure file formatting

If you are modifying [cli.js](./cli.js), we also recommend:

- [ESLint](https://eslint.org) to automatically show JavaScript issues
- TypeScript language server (Bundled with VSCode)

## Schema Authoring

The goal of JSON Schemas in this repository is to correctly validate schemas that are used by the actual tools. That means, if a property is undocumented or deprecated, it should still be included in the schema.

### Best practices

✔️ **Use** the most recent JSON Schema version (specified by `$schema`) that's widely supported by editors and IDEs. Currently, the best supported version is `draft-07`. Later versions of JSON Schema are not recommended for use in SchemaStore until editor/IDE support improves for those versions.

✔️ **Use** [`base.json`][base] schema for `draft-07` and [`base-04.json`][base-04] for `draft-04` with some common types for all schemas.

There is an [unofficial draft-07][draft-07-unofficial-strict] schema that uses JSON Schema to validate your JSON Schema. It checks that:

- `type`, `title`, `description` properties are required
- There are no empty arrays. For instance, it's impossible to write less than 2 sub-schemas for `allOf`
- `type` can't be an array, which is intentional, `anyOf`/`oneOf` should be used in this case
- It links to [understanding-json-schema](https://json-schema.org/understanding-json-schema) for each hint/check

To check your schema against that schema, use `node cli.js check-strict --schema-name=<schemaName.json>`.

❌ **Don't forget** add test files.

- Always be consistent across your schema: order properties and describe in the same style.
- Always use `description`, `type`, `additionalProperties`.
  - Always set `additionalProperties` to `false` unless documentation permits
    additional properties explicitly. That tool the JSON schema is created for
    can be changed in the future to allow wrong extra properties.
- Don't end `title`/`description` values with colon.
- Always omit leading articles for `title`-s and trailing punctuation to make
  expected object values look more like types in programming languages. Also
  start `title`-s with a lowercase letter and try use nouns for titles instead of sentences.
- Always add documentation url to descriptions when available in the following
  format: `<description>\n<url>` like `"Whether to ignore a theme configuration for the current site\nhttps://jekyllrb.com/docs/configuration/options/#global-configuration"`.

[base]: https://github.com/SchemaStore/schemastore/blob/master/src/schemas/json/base.json
[base-04]: https://github.com/SchemaStore/schemastore/blob/master/src/schemas/json/base-04.json
[draft-07-unofficial-strict]: https://json.schemastore.org/metaschema-draft-07-unofficial-strict.json

#### Avoiding Overconstraint

Sometimes, constraints do more harm than good. For example, [cron strings](http://pubs.opengroup.org/onlinepubs/7908799/xcu/crontab.html) validation regexes. In general, do not add a constraint if:

- false positives are likely (due to their complexity or abundance of implementations)
- its error message is too confusing or not helpful

So, do not add regex patterns for any of the following:

- cron regexes
- string-embedded DSLs
- SSH URLs, HTTPS URLs, and other complex URIs

In addition, be wary when adding exhaustive support to enum-type fields. Often, when applications expand support (thus expanding the set of allowable enums), the schema will become invalid.

#### Undocumented Features

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
    "type": ["string", "null"]
  }
}
```

In this case, `{ "tsBuildInfoFile": null }` is not documented. Using a string value is, however.

#### Deprecated Features

Software that reads a schema may deprecate and eventually remove particular properties or features.

For most schemas, we don't recommend removing properties from schemas, especially immediately after they are no longer supported. They are useful during the migration process or if users are stuck on an older version.

To note that a property or feature is deprecated, use the same strategy as described in [Undocumented Features](#undocumented-features). For example:

```json
{
  "description": "DEPRECATED. Documentation of this property. Migrate to this alternative."
}
```

Note that JSON Schema draft `2019-09` adds support for a `deprecated` field:

```json
{
  "description": "Documentation of this property. Migrate to this alternative.",
  "deprecated": true
}
```

While this would be the best option, most schemas in this repository are `draft-07`. As a result, _Editors and IDEs may not use it_.

#### API Compatibility

Care must be taken to reduce breaking changes; some include:

**1. Preserving schema names**

When renaming a schema name, the old version must continue to exist. Otherwise, all references to it will break. The content of the old schema must look something like:

```json
{
  "$ref": "https://json.schemastore.org/NEWNAME.json"
}
```

The process of renaming schemas is similar to [this section](#how-to-move-a-json-schema-from-schemastore-to-somewhere-thats-self-hosted).

**2. Preserving schema paths**

Many tools, such as [validate-pyproject](https://github.com/abravalheri/validate-pyproject), accept passing in subpaths for validation like so:

```sh
validate-pyproject --tool cibuildwheel=https://json.schemastore.org/cibuildwheel.toml#/properties/tool/properties
```

This means that renames in subschema paths is a potentially a breaking change. However, it needs to be possible to refactor internal schema structures.

It is okay when refactoring the subschema to a location under `$defs` or `definitions`. Otherwise, use your best judgement. If a rename is necessary, it is recommended to keep the old path and `$ref` to the new location, if possible.

#### Documenting Enums

There are several ways to document enums. It is recommended to use [this solution](https://github.com/json-schema-org/json-schema-spec/issues/57#issuecomment-247861695):

```json
{
  "oneOf": [
    { "const": "foo", "description": "Description foo" },
    { "const": "bar", "description": "Description bar" }
  ]
}
```

It is also possible to use `x-intellij-enum-metadata`:

```json
{
  "enum": ["foo", "bar"],
  "x-intellij-enum-metadata": {
    "foo": {
      "description": "Description foo"
    },
    "bar": {
      "description": "Description bar"
    }
  }
}
```

Or, `enumDescriptions`:

```json
{
  "enum": ["foo", "bar"]
  "enumDescriptions": [
    "Description foo",
    "Description bar"
  ]
}
```

The latter two approaches are not recommended because they use editor-specific, non-standard properties. See [Non-standard Properties](#non-standard-properties) for details.

### Language Server Features

There are several language servers that use SchemaStore:

#### Non-standard Properties

Some language servers support non-standard properties. They include:

**`allowTrailingCommas`**

Used by: `vscode-json-languageservice`.

Whether trailing commas are allowed in the schema itself. Use the [`allowTrailingCommas`](https://github.com/microsoft/vscode/issues/102061) field. See [this PR](https://github.com/SchemaStore/schemastore/pull/3259/files) if you wish to add this for your schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "allowTrailingCommas": true,
  ...
}
```

**`defaultSnippets`**

Used by: `vscode-json-languageservice`.

**`markdownDescription`**

Used by: `vscode-json-languageservice`.

**`enumDescriptions`**

Used by: `vscode-json-languageservice`. See [Documenting Enums](#documenting-enums) for details.

**`x-taplo`**

Used by: `tamasfe/taplo`.

**`x-taplo-info`**

Used by: `tamasfe/taplo`.

**`x-intellij-language-injection`**

Used by Intellij.

**`x-intellij-html-description`**

Used by Intellij.

**`x-intellij-enum-metadata`**

Used by Intellij. See [Documenting Enums](#documenting-enums) for details.

### Using the `CODEOWNERS` file

This repository uses the [the code-owner-self-merge](https://github.com/OSS-Docs-Tools/code-owner-self-merge) GitHub action to give project maintainers more control over their schema. It allows for:

- Mentioning a user when a schema is modified in a PR
- Enabling a user to merge a PR, so long it only modifies files that is "owned" by that user

See the [CODEOWNERS](.github/CODEOWNERS) file, the [action configuration](.github/workflows/codeowners-merge.yml), and [action documentation](https://github.com/OSS-Docs-Tools/code-owner-self-merge) for more information.

## Schema Validation

After authoring a schema, you'll want to validate so it behaves as intended against popular validators.

This repository validations JSON Schemas in multiple ways:

### [Ajv](https://ajv.js.org) [strict mode](https://ajv.js.org/strict-mode.html)

- The default validation mode that is most stringent
- Checks schema to prevent any unexpected behaviors or silently ignored mistakes
- Fixing strict mode errors does not change validation results, it only serves to improve schema quality
- More info at [Ajv Strict mode docs](https://ajv.js.org/strict-mode.html#strict-schema)

### [Ajv](https://ajv.js.org) non-strict mode

- Some rules are relaxed for the sake of brevity
- To validate under non-strict mode, add your schema to the `ajvNotStrictMode` field in [schema-validation.jsonc](src/schema-validation.jsonc)

### [SchemaSafe](https://github.com/ExodusMovement/schemasafe)

- Helps catch errors within schemas that would otherwise be missed. This is a WIP

To actually run the validation checks, see [How to validate a JSON Schema](#how-to-validate-a-json-schema).

## About `catalog.json`

The `catalog.json` file is generally used by editors and extensions to determine which schemas apply to what files. Specifically:

- VSCode ignores this file [see issue](https://github.com/microsoft/vscode/issues/26289)
- [RedHat's YAML language server](#redhat-developeryaml-language-server) uses this file ([see configuration](https://github.com/redhat-developer/vscode-yaml/blob/41e0be736f2d07cdf7489e1c1c591b35b990e096/package.json#L176))
- [Taplo TOML language server](#tamasfetaplo) uses this file (see [this](https://github.com/tamasfe/taplo/blob/2e01e8cca235aae3d3f6d4415c06fd52e1523934/editors/vscode/package.json#L240) and [this](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml))

Sometimes, `catalog.json` is interpreted differently:

- With [RedHat's YAML language server](#redhat-developeryaml-language-server), the `fileMatch` will not work as expected if no `.ya?ml` extension is supplied with a custom file extension
  - See [upstream issue](https://github.com/redhat-developer/yaml-language-server/issues/790)
  - See the [schemastore issue](https://github.com/SchemaStore/schemastore/pull/3982) issue for more info

And, generally, if a software supports multiple formats, stick with configuration file formats like JSON and avoid JavaScript. See [this](https://github.com/SchemaStore/schemastore/pull/3989) issue.

### Avoid Generic `fileMatch` Patterns

When adding glob patterns to `fileMatch` so language servers can auto-apply schemas, avoid adding generic patterns. For example, [Hugo](https://gohugo.io) used to use `config.toml`:

```jsonc
{
  "name": "Hugo",
  "description": "Hugo static site generator config file",
  "fileMatch": ["config.toml"], // Avoid generic patterns.
  "url": "https://json.schemastore.org/hugo.json",
}
```

This would not be accepted because the file detection would have too many false positives, conflicting with other frameworks and personal configurations. There are several ways to fix this:

- Modify the tool to read from a more specific file (Hugo [now reads](https://github.com/gohugoio/hugo/issues/8979) from `hugo.toml` as well)
- Omit `fileMatch` or set it to an empty array (which still allows the user to manually select it)
- Prepend a directory name to the pattern (e.g. `"**/micro/runtime/syntax/*.yaml"`)

## Compatible Language Servers and Tools

### [`redhat-developer/yaml-language-server`](https://github.com/redhat-developer/yaml-language-server)

- Used by VSCode's [Red Hat YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml)

### [`tamasfe/taplo`](https://github.com/tamasfe/taplo)

- Used by VSCode's [Even Better TOML extension](https://marketplace.visualstudio.com/items?itemName=tamasfe.even-better-toml)
- More information [here](https://taplo.tamasfe.dev/configuration/developing-schemas.html)

### [`Microsoft/vscode-json-languageservice`](https://github.com/Microsoft/vscode-json-languageservice)

- Used by VSCode
- Used by Zed (see [source](https://github.com/zed-industries/zed/blob/eb9eae09b1186ca54895a80a352da76591625032/crates/languages/src/json.rs#L31))
- Used by Emacs's LSP Mode (see [docs](https://emacs-lsp.github.io/lsp-mode/page/lsp-json/))
- More information [here](https://code.visualstudio.com/docs/languages/json)

### Other

- Visual Studio proprietary
- Intellij proprietary
- [vscode-langservers-extracted](https://github.com/hrsh7th/vscode-langservers-extracted)
- [SchemaStore.nvim](https://github.com/b0o/SchemaStore.nvim)

## Troubleshooting

Some common errors include:

### Dependency Errors

When updating the working tree, you may suddenly come across issues with dependencies like the following:

```console
$ node ./cli.js
node:internal/modules/esm/resolve:838
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'ajv' imported from .../schemastore/cli.js
    at packageResolve (node:internal/modules/esm/resolve:838:9)
    ...
    at ModuleJob._link (node:internal/modules/esm/module_job:132:49) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v23.0.0
```

To fix dependencies it is recommended to run `npm clean-install`. The command `npm install` should work as well.

### `pre-commit` fails to format files in CI

The `pre-commit.ci` action can "mysteriously" fail to automatically commit formatted files. This happens because the repository corresponding to the pull request branch is not owned by a user account. This constraint is detailed in [GitHub's documentation](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/committing-changes-to-a-pull-request-branch-created-from-a-fork).

To fix this, run the formatter manually:

```console
npm run prettier:fix
```

Note this will also format the following files:

```sh
$ git status --short
M src/test/prettierrc/.prettierrc.yml
M src/test/prettierrc/prettierrc.json
```

_Do not_ add those two files; pre-commit.ci seems to have issue with them. (Undo modifications to those files by running `git restore -- 'src/test/prettierrc/*'`)

To run Prettier on scpecific files, run:

```console
# Run on a schema file
./node_modules/.bin/prettier --config .prettierrc.cjs --ignore-path .gitignore --write src/schemas/json/<schemaName.json>
# Run on test files
./node_modules/.bin/prettier --config .prettierrc.cjs --ignore-path .gitignore --write src/test/<schemaName>/
```

## How-to

### How to add a JSON Schema that's hosted in this repository

Follow these instructions if you want to add the JSON schema file directly to this repository. If you want to keep the JSON schema hosted elsewhere, see [How to add a JSON Schema that's self-hosted/remote/external](#how-to-add-a-json-schema-thats-self-hostedremoteexternal).

When uploading a new schema file, make sure it targets a file that is commonly used or has potential for broad uptake.

First, clone the repository:

```sh
git clone https://github.com/SchemaStore/schemastore
cd schemastore
```

Be sure that [NodeJS](https://nodejs.org) is installed. The minimum required NodeJS version is defined by the `engines` key in [package.json](package.json). Now, install dependencies and run the `new-schema` task:

```sh
npm clean-install
node cli.js new-schema
```

You will be prompted for the name of the schema. Once you enter your schema name, the task will:

- Create a new schema file at `src/schemas/json/<schemaName>.json`
- Create a positive test file at `src/test/<schemaName>/<schemaName>.json`
- Print a string for you to add to the [Schema Catalog](src/api/json/catalog.json)

If you do not wish to use the `new-schema` task, the manual steps are listed below 👇

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

Be sure that [NodeJS](https://nodejs.org) is installed. The minimum required NodeJS version is defined by the `engines` key in [package.json](package.json).

Now, modify the schema you intend to modify. Schemas are located under `src/schemas/json`.

Finally, validate your changes. See [How to Validate a JSON Schema](#how-to-validate-a-json-schema) for details.

### How to add a JSON Schema with multiple versions

Refer to this [`agripparc` PR](https://github.com/SchemaStore/schemastore/pull/1950/files) as an example. First, your schema names should be suffixed with the version number.

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
- Within [schema-validation.jsonc](./src/schema-validation.jsonc), in `"options": []`, add an entry:
  `{ "schema_x.json": {"externalSchema": ["schema_y.json"] } }`

### How to add a `$ref` to a JSON Schema that's self-hosted

This currently isn't possible. This is tracked by [issue #2731](https://github.com/SchemaStore/schemastore/issues/2731).

### How to validate a JSON Schema

To validate all schemas, run:

```console
node ./cli.js check
```

Because there are hundreds of schemas, you may only want to validate a single one to save time. To do this, run:

```console
node ./cli.js check --schema-name=<schemaName.json>
```

For example, to validate the [`ava.json`](https://github.com/SchemaStore/schemastore/blob/master/src/schemas/json/ava.json) schema, run `node ./cli.js check --schema-name=ava.json`

Note that `<schemaName.json>` refers to the _filename_ that the schema has under `src/schemas/json`.

### How to ignore validation errors in a JSON Schema

> **Note**
> Please only do this if you _must_. Validating in strict mode catches many common errors by schema authors and improves schema quality.

Sometimes, the build fails due to a failed validation check. See a list of validation checks [here](#how-to-validate-a-json-schema). An error may look like:

```txt
>> compile              | schemas/json/prefect-deploy.json (draft-07)(FullStrictMode)
>> Error: strict mode: use allowUnionTypes to allow union type keyword at "#/definitions/prefect_docker.deployments.steps.push_docker_image/properties/credentials" (strictTypes)
```

To ignore most validation errors, you need to modify `./src/schema-validation.jsonc`:

- If a strict error fails, you need to add your JSON Schema to the `ajvNotStrictMode` array
- If you are getting "unknown format" or "unknown keyword" errors, you need to add your JSON Schema to the `options` object
- If you are using a recent version of the JSON Schema specification, you will need to add your JSON Schema to the `highSchemaVersion` array

### How to name schemas that are subschemas (`partial-`)

Often, it is useful to extract a subschema into its own file. This can make it easier to write tests, find schemas pertaining to a particular project, and logically separate extremely large schemas. The `partial-` prefix makes it easier for SchemaStore developers and subschema consumers to identify that the schema is a subschema.

A subschema should be extracted to its own file based on the following rules:

- If a schema represents an existing project that could be its own file, then simply use that file for the "subschema". In other places, `$ref` that file where appropriate.
  - For example, [mypy](https://mypy-lang.org) reads configuration from both `mypy.ini` and `pyproject.toml`'s `tool.mypy` key. Because `mypy.ini` is its own file, then name the schema `mypy.json` like you usually would.
  - Same with [Prettier](https://prettier.io). It reads from `.prettierrc.json` (among other files) and `package.json`'s `prettier` key.
- If the schema cannot be its own file, then extracting the subschema may be an improvement
  - For example, [Poetry](https://python-poetry.org) reads configuration _only_ from `pyproject.toml`'s `tool.poetry` key. Because the Poetry subschema is relatively complex and a large project, it has been extracted to its own file, `partial-poetry.json`.
- If the schema must exist locally to workaround issue [#2731](https://github.com/SchemaStore/schemastore/issues/2731), then the subschema should be extracted
  - In a top-level `$comment`, you must add the date at which you copied the original. See [#3526](https://github.com/SchemaStore/schemastore/issues/3526) for an example

Use your best judgement; if the project or schema is small, then the drawbacks of extracting the subschema to its own file likely outweigh the benefits.

## Older Links

### use-of-codeowners-file

See [Using the `CODEOWNERS` file](#using-the-codeowners-file).
