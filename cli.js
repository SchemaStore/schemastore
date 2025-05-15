/// <binding AfterBuild='build' />
// @ts-check
import path from 'node:path'
import fs from 'node:fs/promises'
import fsCb from 'node:fs'
import readline from 'node:readline'
import util from 'node:util'

import _AjvDraft04 from 'ajv-draft-04'
import { Ajv as AjvDraft06And07 } from 'ajv'
import _Ajv2019 from 'ajv/dist/2019.js'
import _Ajv2020 from 'ajv/dist/2020.js'
import _addFormats from 'ajv-formats'
import { ajvFormatsDraft2019 } from '@hyperupcall/ajv-formats-draft2019'
import schemasafe from '@exodus/schemasafe'
import TOML from 'smol-toml'
import YAML from 'yaml'
import jsonlint from '@prantlf/jsonlint'
import * as jsoncParser from 'jsonc-parser'
import ora from 'ora'
import chalk from 'chalk'
import minimist from 'minimist'
import fetch, { FetchError } from 'node-fetch'

/**
 * @import { Ora } from 'ora'
 */

/**
 * Ajv defines types, but they don't work when importing the library with
 * ESM syntax. Tweaking `jsconfig.json` with `esModuleInterop` didn't seem
 * to fix things, so manually set the types with a cast. This issue is
 * tracked upstream at https://github.com/ajv-validator/ajv/issues/2132.
 */
/** @type {typeof _AjvDraft04.default} */
const AjvDraft04 = /** @type {any} */ (_AjvDraft04)

/** @type {typeof _Ajv2019.default} */
const Ajv2019 = /** @type {any} */ (_Ajv2019)

/** @type {typeof _Ajv2020.default} */
const Ajv2020 = /** @type {any} */ (_Ajv2020)

/** @type {typeof _addFormats.default} */
const addFormats = /** @type {any} */ (_addFormats)

// Declare constants.
const AjvDraft06SchemaJson = await readJsonFile(
  'node_modules/ajv/dist/refs/json-schema-draft-06.json',
)

const CatalogFile = './src/api/json/catalog.json'
const Catalog = /** @type {CatalogJson} */ (
  jsoncParser.parse(await fs.readFile(CatalogFile, 'utf-8'))
)

const SchemaValidationFile = './src/schema-validation.jsonc'
const SchemaValidation = /** @type {SchemaValidationJson} */ (
  jsoncParser.parse(await fs.readFile(SchemaValidationFile, 'utf-8'))
)

const SchemaDir = './src/schemas/json'
const TestPositiveDir = './src/test'
const TestNegativeDir = './src/negative_test'
const UrlSchemaStore = 'https://json.schemastore.org/'
const [SchemasToBeTested, FoldersPositiveTest, FoldersNegativeTest] = (
  await Promise.all([
    fs.readdir(SchemaDir),
    fs.readdir(TestPositiveDir),
    fs.readdir(TestNegativeDir),
  ])
).map((files) => {
  return files.filter((file) => !isIgnoredFile(file))
})

// prettier-ignore
const SchemaDialects = [
  { draftVersion: '2020-12', url: 'https://json-schema.org/draft/2020-12/schema', isActive: true, isTooHigh: true },
  { draftVersion: '2019-09', url: 'https://json-schema.org/draft/2019-09/schema', isActive: true, isTooHigh: true },
  { draftVersion: 'draft-07', url: 'http://json-schema.org/draft-07/schema#', isActive: true, isTooHigh: false },
  { draftVersion: 'draft-06', url: 'http://json-schema.org/draft-06/schema#', isActive: false, isTooHigh: false },
  { draftVersion: 'draft-04', url: 'http://json-schema.org/draft-04/schema#', isActive: false, isTooHigh: false },
  { draftVersion: 'draft-03', url: 'http://json-schema.org/draft-03/schema#', isActive: false, isTooHigh: false },
]

/** @type {{ _: string[], fix?: boolean, help?: boolean, SchemaName?: string, 'schema-name'?: string, 'unstable-check-with'?: string }} */
const argv = /** @type {any} */ (
  minimist(process.argv.slice(2), {
    string: ['SchemaName', 'schema-name', 'unstable-check-with'],
    boolean: ['help'],
  })
)
if (argv.SchemaName) {
  process.stderr.write(
    `WARNING: Please use "--schema-name" instead of "--SchemaName". The flag "--SchemaName" will be removed.\n`,
  )
  argv['schema-name'] = argv.SchemaName
}

/**
 * @typedef {Object} JsonSchemaAny
 * @property {string} $schema
 * @property {string | undefined} $ref
 *
 * @typedef {Object} JsonSchemaDraft04
 * @property {undefined} $id
 * @property {string} id
 *
 * @typedef {Object} JsonSchemaDraft07
 * @property {string} $id
 * @property {undefined} id
 *
 * @typedef {JsonSchemaAny & (JsonSchemaDraft04 | JsonSchemaDraft07)} JsonSchema
 */

/**
 * @typedef {Object} CatalogJsonEntry
 * @property {string} name
 * @property {string} description
 * @property {string[] | undefined} fileMatch
 * @property {string} url
 * @property {Record<string, string>} versions
 *
 * @typedef {Object} CatalogJson
 * @property {number} version
 * @property {CatalogJsonEntry[]} schemas
 */

/**
 * @typedef {Object} SchemaValidationJsonOption
 * @property {string[]} unknownFormat
 * @property {string[]} unknownKeywords
 * @property {string[]} externalSchema
 *
 * @typedef {Object} SchemaValidationJson
 * @property {string[]} ajvNotStrictMode
 * @property {string[]} fileMatchConflict
 * @property {string[]} highSchemaVersion
 * @property {string[]} missingCatalogUrl
 * @property {string[]} skiptest
 * @property {string[]} catalogEntryNoLintNameOrDescription
 * @property {Record<string, SchemaValidationJsonOption>} options
 */

/**
 * @typedef {Object} DataFile
 * @property {Buffer} buffer
 * @property {string} text
 * @property {Record<PropertyKey, unknown>} json
 * @property {string} name
 * @property {string} path
 *
 * @typedef {Object} SchemaFile
 * @property {Buffer} buffer
 * @property {string} text
 * @property {JsonSchema} json
 * @property {string} name
 * @property {string} path
 */

async function exists(/** @type {string} */ filepath) {
  return fs
    .stat(filepath)
    .then(() => {
      return true
    })
    .catch((/** @type {NodeJS.ErrnoException} */ err) => {
      if (err instanceof Error && err.code === 'ENOENT') {
        return false
      } else {
        throw err
      }
    })
}

async function readJsonFile(/** @type {string} */ filename) {
  return JSON.parse(await fs.readFile(filename, 'utf-8'))
}

function isIgnoredFile(/** @type {string} */ file) {
  return file === '.DS_Store'
}

async function forEachCatalogUrl(
  /** @type {((arg0: string) => (void | Promise<void>))} */ fn,
) {
  for (const catalogEntry of Catalog.schemas) {
    await fn(catalogEntry.url)
    for (const url of Object.values(catalogEntry?.versions ?? {})) {
      await fn(url)
    }
  }
}

/**
 * @typedef {Object} ExtraParams
   @property {any} spinner
}
 * @typedef {Object} ForEachTestFile
 * @property {string} [actionName]
 * @property {(arg0: SchemaFile, arg1: ExtraParams) => Promise<any>} [onSchemaFile]
 * @property {(arg0: SchemaFile, arg1: DataFile, data: any, arg2: ExtraParams) => Promise<void>} [onPositiveTestFile]
 * @property {(arg0: SchemaFile, arg1: DataFile, data: any, arg2: ExtraParams) => Promise<void>} [onNegativeTestFile]
 * @property {(arg0: SchemaFile, arg1: ExtraParams) => Promise<void>} [afterSchemaFile]
 */
async function forEachFile(/** @type {ForEachTestFile} */ obj) {
  const spinner = ora()
  if (obj.actionName) {
    spinner.start()
  }

  let hasValidatedAtLeastOneFile = false
  for (const dirent1 of await fs.readdir(SchemaDir, { withFileTypes: true })) {
    if (isIgnoredFile(dirent1.name)) continue

    const schemaName = dirent1.name
    const schemaId = schemaName.replace('.json', '')

    if (argv['schema-name'] && argv['schema-name'] !== schemaName) {
      continue
    }

    if (SchemaValidation.skiptest.includes(schemaName)) {
      continue
    }

    hasValidatedAtLeastOneFile = true

    const schemaPath = path.join(SchemaDir, schemaName)
    const schemaFile = await toFile(schemaPath)
    if (obj.actionName) {
      if (process.env.CI) {
        console.info(`Running "${obj.actionName}" on file "${schemaFile.path}"`)
      } else {
        spinner.text = `Running "${obj.actionName}" on file "${schemaFile.path}"`
      }
    }
    const data = await obj?.onSchemaFile?.(schemaFile, { spinner })

    if (obj?.onPositiveTestFile) {
      const positiveTestDir = path.join(TestPositiveDir, schemaId)
      for (const testfile of await fs
        .readdir(positiveTestDir)
        .catch(ignoreOnlyENOENT)) {
        if (isIgnoredFile(testfile)) continue

        const testfilePath = path.join(TestPositiveDir, schemaId, testfile)
        let file = await toFile(testfilePath)
        await obj.onPositiveTestFile(schemaFile, file, data, { spinner })
      }
    }

    if (obj?.onNegativeTestFile) {
      const negativeTestDir = path.join(TestNegativeDir, schemaId)
      for (const testfile of await fs
        .readdir(negativeTestDir)
        .catch(ignoreOnlyENOENT)) {
        if (isIgnoredFile(testfile)) continue

        const testfilePath = path.join(TestNegativeDir, schemaId, testfile)
        let file = await toFile(testfilePath)
        await obj.onNegativeTestFile(schemaFile, file, data, { spinner })
      }
    }

    await obj?.afterSchemaFile?.(schemaFile, { spinner })
  }

  if (obj.actionName) {
    spinner.stop()
  }

  if (!hasValidatedAtLeastOneFile) {
    const fileExistsNotice =
      argv['schema-name'] &&
      (await exists(path.join(SchemaDir, argv['schema-name'])))
        ? []
        : [`No schema exists with filename "${argv['schema-name']}"`]
    printErrorAndExit(
      null,
      [
        `Failed to execute action "${obj.actionName}" on at least one file`,
      ].concat(fileExistsNotice),
    )
  }

  if (obj.actionName) {
    console.info(`✔️ Completed "${obj.actionName}"`)
  }

  function ignoreOnlyENOENT(/** @type {unknown} */ err) {
    if (
      err instanceof Error &&
      /** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT'
    ) {
      return []
    } else {
      spinner.stop()
      throw err
    }
  }
}

async function toFile(/** @type {string} */ schemaPath) {
  const buffer = await fs.readFile(schemaPath)
  const text = buffer.toString()
  return {
    buffer,
    text,
    json: await readDataFile({ filepath: schemaPath, text }),
    name: path.basename(schemaPath),
    path: schemaPath.replace(/^\.\//u, ''),
  }
}

async function readDataFile(
  /** @type {{filepath: string, text: string }} */ obj,
) {
  const fileExtension = path.parse(obj.filepath).ext
  switch (fileExtension) {
    case '.json':
      try {
        return JSON.parse(obj.text)
      } catch (err) {
        printErrorAndExit(err, [
          `Failed to parse JSON file "./${obj.filepath}"`,
        ])
      }
      break
    case '.jsonc':
      try {
        return jsoncParser.parse(obj.text)
      } catch (err) {
        printErrorAndExit(err, [
          `Failed to parse JSONC file "./${obj.filepath}"`,
        ])
      }
      break
    case '.yaml':
    case '.yml':
      try {
        return YAML.parse(obj.text)
      } catch (err) {
        printErrorAndExit(err, [
          `Failed to parse YAML file "./${obj.filepath}"`,
        ])
      }
      break
    case '.toml':
      try {
        return TOML.parse(obj.text)
      } catch (err) {
        printErrorAndExit(err, [
          `Failed to parse TOML file "./${obj.filepath}"`,
        ])
      }
      break
    default:
      printErrorAndExit(new Error(), [
        `Unable to handle file extension "${fileExtension}" for file "./${obj.filepath}"`,
      ])
      break
  }
}

/**
 * @param {unknown} error
 * @param {string[]} [messages]
 * @param {string} [extraText]
 * @returns {never}
 */
function printErrorAndExit(error, messages, extraText) {
  if (Array.isArray(messages) && messages.length > 0) {
    console.warn('---')
    for (const msg of messages) {
      console.error(chalk.red('>>') + ' ' + msg)
    }
  }

  if (extraText) {
    process.stderr.write(extraText)
    process.stderr.write('\n')
  }

  console.warn('---')
  if (error instanceof Error && error?.stack) {
    process.stderr.write(error.stack)
    process.stderr.write('\n')
  }
  process.exit(1)
}

function getSchemaDialect(/** @type {string} */ schemaUrl) {
  const schemaDialect = SchemaDialects.find((obj) => schemaUrl === obj.url)
  if (!schemaDialect) {
    throw new Error(`No schema dialect found for url: ${schemaUrl}`)
  }

  return schemaDialect
}

/**
 * @typedef {Object} AjvFactoryOptions
 * @property {string} draftVersion
 * @property {boolean} fullStrictMode
 * @property {string[]} [unknownFormats]
 * @property {string[]} [unknownKeywords]
 * @property {string[]} [unknownSchemas]
 * @property {Record<PropertyKey, unknown>} [options]
 */

/**
 * Returns the correct and configured Ajv instance for a particular $schema version
 */
async function ajvFactory(
  /** @type {AjvFactoryOptions} */ {
    draftVersion,
    fullStrictMode = true,
    unknownFormats = [],
    unknownKeywords = [],
    unknownSchemas = [],
    options,
  },
) {
  let ajvOptions = {}
  Object.assign(
    ajvOptions,
    fullStrictMode
      ? {
          strict: true,
        }
      : {
          strictTypes: false, // recommended: true
          strictTuples: false, // recommended: true
          allowMatchingProperties: true, // recommended: false
        },
  )
  Object.assign(ajvOptions, options)

  let ajv
  switch (draftVersion) {
    case 'draft-04':
      ajv = new AjvDraft04(ajvOptions)
      addFormats(ajv)
      break
    case 'draft-06':
      ajv = new AjvDraft06And07(ajvOptions)
      ajv.addMetaSchema(AjvDraft06SchemaJson)
      addFormats(ajv)
      break
    case 'draft-07':
      /**
       * Note that draft-07 defines iri{,-reference}, idn-{hostname,email}, which
       * are not available through `addFormats`. So, use `ajvFormatsDraft2019` to
       * obtain these. Thus, some draft2019 formats like "duration" are applied.
       * See https://ajv.js.org/packages/ajv-formats.html for details.
       */
      ajv = new AjvDraft06And07(ajvOptions)
      addFormats(ajv)
      ajvFormatsDraft2019(ajv)
      break
    case '2019-09':
      ajv = new Ajv2019(ajvOptions)
      addFormats(ajv)
      ajvFormatsDraft2019(ajv)
      break
    case '2020-12':
      ajv = new Ajv2020(ajvOptions)
      addFormats(ajv)
      ajvFormatsDraft2019(ajv)
      break
    default:
      throw new Error('No JSON Schema version specified')
  }

  /**
   * In strict mode, Ajv will throw an error if it does not
   * recognize any non-standard formats. That is, unrecognized
   * values of the "format" field. Supply this information to
   * Ajv to prevent errors.
   */
  for (const format of unknownFormats) {
    ajv.addFormat(format, true)
  }

  /**
   * Ditto, but with keywords (ex. "x-intellij-html-description")..
   */
  for (const unknownKeyword of unknownKeywords.concat([
    'allowTrailingCommas',
    'defaultSnippets',
    'markdownDescription',
    'enumDescriptions',
    'markdownEnumDescriptions',
    'x-taplo',
    'x-taplo-info',
    'x-tombi-toml-version',
    'x-tombi-array-values-order',
    'x-tombi-table-keys-order',
    'x-intellij-language-injection',
    'x-intellij-html-description',
    'x-intellij-enum-metadata',
  ])) {
    ajv.addKeyword(unknownKeyword)
  }

  /**
   * Ditto, but with "$ref" URIs to external schemas.
   */
  for (const schemaPath of unknownSchemas) {
    ajv.addSchema(await readJsonFile(schemaPath))
  }

  return ajv
}

function getSchemaOptions(/** @type {string} */ schemaName) {
  const options = SchemaValidation.options[schemaName] ?? {}

  return {
    unknownFormats: options.unknownFormat ?? [],
    unknownKeywords: options.unknownKeywords ?? [],
    unknownSchemas: (options.externalSchema ?? []).map((schemaName2) => {
      return path.join(SchemaDir, schemaName2)
    }),
  }
}

/**
 * @param {string} filepath
 * @param {string} schemaFilepath
 * @param {unknown[] | null | undefined} ajvErrors
 * @returns {never}
 */
function printSchemaValidationErrorAndExit(
  filepath,
  schemaFilepath,
  ajvErrors,
) {
  printErrorAndExit(
    null,
    [
      `Failed to validate file "${filepath}" against schema file "./${schemaFilepath}"`,
      `Showing first error out of ${ajvErrors?.length ?? '?'} total error(s)`,
    ],
    util.formatWithOptions({ colors: true }, '%O', ajvErrors?.[0] ?? '???'),
  )
}

async function taskNewSchema() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  console.log('Enter the name of the schema (without .json extension)')
  await handleInput()
  async function handleInput(/** @type {string | undefined} */ schemaName) {
    if (!schemaName || schemaName.endsWith('.json')) {
      rl.question('input: ', handleInput)
      return
    }

    const schemaFile = path.join(SchemaDir, schemaName + '.json')
    const testDir = path.join(TestPositiveDir, schemaName)
    const testFile = path.join(testDir, `${schemaName}.json`)

    if (await exists(schemaFile)) {
      throw new Error(`Schema file already exists: ${schemaFile}`)
    }

    console.info(`Creating schema file at 'src/${schemaFile}'...`)
    console.info(`Creating positive test file at 'src/${testFile}'...`)

    await fs.mkdir(path.dirname(schemaFile), { recursive: true })
    await fs.writeFile(
      schemaFile,
      `{
  "$id": "https://json.schemastore.org/${schemaName}.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "additionalProperties": true,
  "properties": {

  },
  "type": "object"
}\n`,
    )
    await fs.mkdir(testDir, { recursive: true })
    await fs.writeFile(
      testFile,
      `"Replace this file with an example/test that passes schema validation. Supported formats are JSON, YAML, and TOML. We recommend adding as many files as possible to make your schema most robust."\n`,
    )

    console.info(`Please add the following to 'src/api/json/catalog.json':
{
  "name": "",
  "description": "",
  "fileMatch": ["${schemaName}.yml", "${schemaName}.yaml"],
  "url": "https://json.schemastore.org/${schemaName}.json"
}`)
    process.exit(0)
  }
}

async function taskLint() {
  const /** @type {{count: number, file: string}[]} */ entries = []

  await forEachFile({
    actionName: 'lint',
    async onSchemaFile(schema) {
      // This checks to be sure $id is a schemastore.org URL.
      // Commenting out because it is overly aggressive for now.
      // await assertSchemaHasCorrectMetadata(schema)
      await assertTopLevelRefIsStandalone(schema)
      // await assertSchemaNoSmartQuotes(schema)

      try {
        const errors = schemasafe.lint(schema.json, {
          // mode: 'strong',
          requireSchema: true,
          requireValidation: true,
          requireStringValidation: false,
          complexityChecks: true,
          forbidNoopValues: true,

          extraFormats: false,
          schemas: {},
        })
        for (const err of errors) {
          console.log(`${schema.name}: ${err.message}`)
        }
        entries.push({
          count: errors.length,
          file: schema.name,
        })
      } catch (err) {
        console.log(err)
        return
      }
    },
  })

  entries.sort((a, b) => a.count - b.count)
  for (const entry of entries) {
    console.info(`${entry.count}: ${entry.file}`)
  }
}

async function taskCheck() {
  console.info(`===== VALIDATE PRECONDITIONS =====`)
  await assertFileSystemIsValid()

  // Check catalog.json.
  await assertFileValidatesAgainstSchema(
    CatalogFile,
    path.join(SchemaDir, 'schema-catalog.json'),
  )
  await assertFilePassesJsonLint(await toFile(CatalogFile))
  assertCatalogJsonHasNoDuplicateNames()
  assertCatalogJsonHasNoBadFields()
  assertCatalogJsonHasNoFileMatchConflict()
  await assertCatalogJsonLocalURLsAreOneToOne()

  // Check schema-validation.jsonc.
  await assertFileValidatesAgainstSchema(
    SchemaValidationFile,
    'src/schema-validation.schema.json',
  )
  await assertFilePassesJsonLint(await toFile(SchemaValidationFile), {
    ignoreComments: true,
  })
  await assertSchemaValidationJsonReferencesNoNonexistentFiles()
  assertSchemaValidationJsonHasValidSkipTest()

  // Run pre-checks (checks before JSON Schema validation) on all files
  console.info(`===== VALIDATE SCHEMAS =====`)
  await forEachFile({
    actionName: 'pre-checks',
    async onSchemaFile(schema) {
      assertFileHasNoBom(schema)
      assertFileHasCorrectExtensions(schema.path, ['.json'])
      await assertFilePassesJsonLint(schema)
      await assertSchemaHasValidIdField(schema)
      await assertSchemaHasValidSchemaField(schema)
    },
    async onPositiveTestFile(schema, testFile, _data, { spinner }) {
      assertFileHasNoBom(testFile)
      assertFileHasCorrectExtensions(testFile.path, [
        '.json',
        '.yaml',
        '.yml',
        '.toml',
      ])
      await assertTestFileHasSchemaPragma(schema, testFile, spinner)
      if (testFile.path.endsWith('.json')) {
        await assertFilePassesJsonLint(testFile)
      }
    },
    async onNegativeTestFile(schema, testFile, _data, { spinner }) {
      assertFileHasNoBom(testFile)
      assertFileHasCorrectExtensions(testFile.path, [
        '.json',
        '.yaml',
        '.yml',
        '.toml',
      ])
      await assertTestFileHasSchemaPragma(schema, testFile, spinner)
      if (testFile.path.endsWith('.json')) {
        await assertFilePassesJsonLint(testFile)
      }
    },
  })

  // Run tests against JSON schemas
  await forEachFile({
    actionName: 'Ajv validation',
    async onSchemaFile(schemaFile, { spinner }) {
      const isFullStrictMode = !SchemaValidation.ajvNotStrictMode.includes(
        schemaFile.name,
      )
      const schemaDialect = getSchemaDialect(schemaFile.json.$schema)
      const options = getSchemaOptions(schemaFile.name)
      let ajv
      try {
        ajv = await ajvFactory({
          draftVersion: schemaDialect.draftVersion,
          fullStrictMode: isFullStrictMode,
          unknownFormats: options.unknownFormats,
          unknownKeywords: options.unknownKeywords,
          unknownSchemas: options.unknownSchemas,
        })
      } catch (err) {
        spinner.fail()
        printErrorAndExit(
          err,
          [`Failed to create Ajv instance for schema "./${schemaFile.path}"`],
          JSON.stringify({ options, schemaDialect, isFullStrictMode }, null, 2),
        )
      }

      let validateFn
      try {
        validateFn = ajv.compile(schemaFile.json)
      } catch (err) {
        spinner.fail()
        printErrorAndExit(err, [
          `Failed to compile schema file "./${schemaFile.path}"`,
        ])
      }

      return {
        validateFn,
      }
    },
    async onPositiveTestFile(
      schemaFile,
      testFile,
      { validateFn },
      { spinner },
    ) {
      if (!validateFn(testFile.json)) {
        spinner.fail()
        printSchemaValidationErrorAndExit(
          testFile.path,
          schemaFile.path,
          validateFn.errors,
        )
      }
    },
    async onNegativeTestFile(schemaFile, testFile, data, { spinner }) {
      const validate = data.validateFn
      if (validate(testFile.json)) {
        spinner.fail()
        printErrorAndExit(new Error(), [
          `Schema validation succeeded for test file "./${testFile.path}", but was supposed to fail `,
          `For schema "./${schemaFile.path}"`,
        ])
      }
    },
  })

  // Print information.
  console.info(`===== REPORT =====`)
  await printSimpleStatistics()
}

async function taskCheckStrict() {
  const ajv = await ajvFactory({
    draftVersion: 'draft-07',
    fullStrictMode: false,
  })
  const metaSchemaFile = await toFile(
    './src/schemas/json/metaschema-draft-07-unofficial-strict.json',
  )
  let validateFn
  try {
    validateFn = ajv.compile(metaSchemaFile.json)
  } catch (err) {
    printErrorAndExit(err, [
      `Failed to compile schema file "./${metaSchemaFile.path}"`,
    ])
  }

  await forEachFile({
    actionName: 'strict metaschema check',
    async onSchemaFile(schemaFile, { spinner }) {
      if (!validateFn(schemaFile.json)) {
        spinner.fail()
        printSchemaValidationErrorAndExit(
          schemaFile.path,
          metaSchemaFile.path,
          validateFn.errors,
        )
      }
    },
  })

  // Print information.
  console.info(`===== REPORT =====`)
  await printSimpleStatistics()
}

async function taskCheckRemote() {
  console.info('TODO')
}

async function taskReport() {
  await printSchemaReport()
}

async function taskMaintenance() {
  {
    console.info(`===== BROKEN SCHEMAS =====`)
    forEachCatalogUrl((url) => {
      if (url.startsWith(UrlSchemaStore)) return

      fetch(url)
        .then(async (res) => {
          if (res.ok) {
            assertJsonOrYaml(url, await res.text())
            return
          }

          if (
            [
              // https://github.com/SchemaStore/schemastore/pull/3926#issuecomment-2234102850
              'https://deployments.allegrogroup.com/tycho/schema',
            ].includes(url)
          ) {
            return
          }

          if (res.status === 405) {
            try {
              const res = await fetch(url)
              if (res.ok) {
                assertJsonOrYaml(url, await res.text())
                return
              }

              console.info(
                `NOT OK (${res.status}/${res.statusText}): ${url} (after 405 code)`,
              )
            } catch (err) {
              console.info(
                `NOT OK (${/** @type {FetchError} */ (err).code}): ${url} (after 405 code)`,
              )
            }
            return
          }
          console.info(`NOT OK (${res.status}/${res.statusText}): ${url}`)
        })
        .catch((err) => {
          console.info(`NOT OK (${err.code}): ${url}`)
        })

      function assertJsonOrYaml(
        /** @type {string} */ url,
        /** @type {string} */ str,
      ) {
        try {
          JSON.parse(str)
          return
        } catch {}

        try {
          YAML.parse(str)
          return
        } catch {}

        console.info(`NOT OK (Not JSON/YAML): ${url}`)
      }
    })
  }
  // await printDowngradableSchemaVersions()
}

async function assertFileSystemIsValid() {
  /**
   * Check that files exist only where files belong, and directories exist only
   * where directories belong.
   */
  {
    for (const dirent of await fs.readdir(SchemaDir, {
      withFileTypes: true,
    })) {
      if (isIgnoredFile(dirent.name)) continue

      const schemaName = dirent.name
      const schemaPath = path.join(SchemaDir, schemaName)

      if (!dirent.isFile()) {
        printErrorAndExit(new Error(), [
          `Expected only files under directory "${SchemaDir}"`,
          `Found non-file at "./${schemaPath}"`,
        ])
      }
    }

    await Promise.all([onTestDir(TestPositiveDir), onTestDir(TestNegativeDir)])
    async function onTestDir(/** @type {string} */ rootTestDir) {
      for (const dirent of await fs.readdir(rootTestDir, {
        withFileTypes: true,
      })) {
        if (isIgnoredFile(dirent.name)) continue

        const testDir = path.join(rootTestDir, dirent.name)
        if (!dirent.isDirectory()) {
          printErrorAndExit(new Error(), [
            `Expected only directories under directory "${rootTestDir}"`,
            `Found non-directory at "./${testDir}"`,
          ])
        }

        for (const dirent of await fs.readdir(testDir, {
          withFileTypes: true,
        })) {
          if (isIgnoredFile(dirent.name)) continue

          const schemaName = dirent.name
          const schemaPath = path.join(testDir, schemaName)

          if (!dirent.isFile()) {
            printErrorAndExit(new Error(), [
              `Expected only files under directory "./${testDir}"`,
              `Found non-file at "./${schemaPath}"`,
            ])
          }
        }
      }
    }
  }

  /**
   * Check that each test file has a corresponding schema. We only need to
   * check "one way". That is, a schema doesn't need to have any corresponding
   * positive or negative tests.
   */
  {
    await Promise.all([onTestDir(TestPositiveDir), onTestDir(TestNegativeDir)])
    async function onTestDir(/** @type {string} */ rootTestDir) {
      for (const testDir of await fs.readdir(rootTestDir)) {
        if (isIgnoredFile(testDir)) continue

        const schemaPath = path.join(SchemaDir, testDir + '.json')
        if (!(await exists(schemaPath))) {
          printErrorAndExit(new Error(), [
            `Failed to find a schema file at "./${schemaPath}"`,
            `Expected schema file computed from directory at "./${path.join(rootTestDir, testDir)}"`,
          ])
        }
      }
    }
  }

  /**
   * Check for miscellaneous things.
   */
  const results = await fs.readdir(path.dirname(CatalogFile))
  if (results.length !== 1) {
    printErrorAndExit(new Error(), [
      `Expected only one file in directory "${path.dirname(CatalogFile)}"`,
      `Found ${results.length} files: ${new Intl.ListFormat().format(results.map((result) => `"${result}"`))}`,
    ])
  }

  console.info('✔️ Directory structure conforms to expected layout')
}

function assertCatalogJsonHasNoDuplicateNames() {
  /** @type {string[]} */
  const schemaNames = Catalog.schemas.map((entry) => entry.name)
  /** @type {string[]} */

  for (const catalogEntry of Catalog.schemas) {
    if (
      schemaNames.indexOf(catalogEntry.name) !==
      schemaNames.lastIndexOf(catalogEntry.name)
    ) {
      const duplicateEntry =
        Catalog.schemas[schemaNames.lastIndexOf(catalogEntry.name)]
      printErrorAndExit(new Error(), [
        `Found two schema entries with duplicate "name" of "${catalogEntry.name}" in file "${CatalogFile}"`,
        `The first entry has url "${catalogEntry.url}"`,
        `The second entry has url "${duplicateEntry.url}"`,
        `Expected the "name" property of schema entries to be unique`,
      ])
    }
  }
}

function assertCatalogJsonHasNoBadFields() {
  for (const catalogEntry of Catalog.schemas) {
    if (
      SchemaValidation.catalogEntryNoLintNameOrDescription.includes(
        catalogEntry.url,
      )
    ) {
      continue
    }

    for (const property of /** @type {const} */ (['name', 'description'])) {
      if (
        /$[,. \t-]/u.test(catalogEntry?.[property]) ||
        /[,. \t-]$/u.test(catalogEntry?.[property])
      ) {
        printErrorAndExit(new Error(), [
          `Expected the "name" or "description" properties of catalog entries to not end with characters ",.<space><tab>-"`,
          `The invalid entry has a "url" of "${catalogEntry.url}" in file "${CatalogFile}"`,
        ])
      }
    }

    for (const property of /** @type {const} */ (['name', 'description'])) {
      if (catalogEntry?.[property]?.toLowerCase()?.includes('schema')) {
        printErrorAndExit(new Error(), [
          `Expected the "name" or "description" properties of entries in "${CatalogFile}" to not include the word "schema"`,
          `All specified files are already schemas, so its meaning is implied`,
          `If the JSON schema is actually a meta-schema (or some other exception applies), ignore this error by appending to the property "catalogEntryNoLintNameOrDescription" in file "${SchemaValidationFile}"`,
          `The invalid entry has a "url" of "${catalogEntry.url}" in file "${CatalogFile}"`,
        ])
      }
    }

    for (const property of /** @type {const} */ (['name', 'description'])) {
      if (catalogEntry?.[property]?.toLowerCase()?.includes('\n')) {
        printErrorAndExit(new Error(), [
          `Expected the "name" or "description" properties of catalog entries to not include a newline character"`,
          `The invalid entry has a "url" of "${catalogEntry.url}" in file "${CatalogFile}"`,
        ])
      }
    }

    for (const fileGlob of catalogEntry.fileMatch ?? []) {
      if (fileGlob.includes('/')) {
        // A folder must start with **/
        if (!fileGlob.startsWith('**/')) {
          printErrorAndExit(new Error(), [
            'Expected the "fileMatch" values of catalog entries to start with "**/" if it matches a directory',
            `The invalid entry has a "url" of "${catalogEntry.url}" in file "${CatalogFile}"`,
          ])
        }
      }
    }
  }

  console.info(`✔️ catalog.json has no fields that break guidelines`)
}

function assertCatalogJsonHasNoFileMatchConflict() {
  const /** @type {string[]} */ allFileMatches = []

  for (const catalogEntry of Catalog.schemas) {
    for (const fileGlob of catalogEntry.fileMatch ?? []) {
      // Ignore globs that are OK to conflict for backwards compatibility.
      if (SchemaValidation.fileMatchConflict.includes(fileGlob)) {
        continue
      }

      if (allFileMatches.includes(fileGlob)) {
        const firstEntry = Catalog.schemas.find((entry) =>
          entry.fileMatch?.includes(fileGlob),
        )
        // @ts-expect-error Node v18 supports "Array.prototype.findLast".
        const lastEntry = Catalog.schemas.findLast((entry) =>
          entry.fileMatch?.includes(fileGlob),
        )
        printErrorAndExit(new Error(), [
          `Found two schema entries with duplicate "fileMatch" entry of "${fileGlob}" in file "${CatalogFile}"`,
          `The first entry has url "${firstEntry?.url}"`,
          `The second entry has url "${lastEntry?.url}"`,
          `Expected all values in "fileMatch" entries to be unique`,
        ])
      }

      allFileMatches.push(fileGlob)
    }
  }

  console.info('✔️ catalog.json has no duplicate "fileMatch" values')
}

async function assertCatalogJsonLocalURLsAreOneToOne() {
  // Check that each local URL in the catalog has a corresponding JSON Schema file.
  {
    await forEachCatalogUrl((/** @type {string} */ catalogUrl) => {
      // Skip external schemas.
      if (!catalogUrl.startsWith(UrlSchemaStore)) {
        return
      }

      const filename = new URL(catalogUrl).pathname.slice(1)

      // Check that local URLs end in .json
      if (!filename.endsWith('.json')) {
        printErrorAndExit(new Error(), [
          `Expected catalog entries for local files to have a "url" that ends in ".json"`,
          `The invalid entry has a "url" of "${catalogUrl}" in file "${CatalogFile}"`,
        ])
      }

      // Check if schema file exist or not.
      if (!exists(path.join(SchemaDir, filename))) {
        printErrorAndExit(new Error(), [
          `Expected schema file to exist at "./${path.join(SchemaDir, filename)}", but no file found`,
          `Schema file path inferred from catalog entry with a "url" of "${catalogUrl}" in file "${CatalogFile}"`,
        ])
      }
    })

    console.info(`✔️ catalog.json has no invalid schema URLs`)
  }

  // Check that each JSON Schema file has a corresponding local entry in the catalog.
  {
    const /** @type {string[]} */ allCatalogLocalJsonFiles = []

    await forEachCatalogUrl((catalogUrl) => {
      if (catalogUrl.startsWith(UrlSchemaStore)) {
        const filename = new URL(catalogUrl).pathname.slice(1)
        allCatalogLocalJsonFiles.push(filename)
      }
    })

    for (const schemaName of await fs.readdir(SchemaDir)) {
      if (isIgnoredFile(schemaName)) continue
      if (
        SchemaValidation.missingCatalogUrl.includes(schemaName) ||
        SchemaValidation.skiptest.includes(schemaName)
      ) {
        continue
      }

      if (!allCatalogLocalJsonFiles.includes(schemaName)) {
        printErrorAndExit(new Error(), [
          `Expected schema file "${schemaName}" to have a corresponding entry in the catalog file "${CatalogFile}"`,
          `Expected to find entry with "url" of "${UrlSchemaStore}${schemaName}"`,
          `If this is intentional, ignore this error by appending to the property "missingCatalogUrl" in file "${SchemaValidationFile}"`,
        ])
      }
    }

    console.info(
      `✔️ catalog.json has all local entries that exist in file total`,
    )
  }
}

async function assertSchemaValidationJsonReferencesNoNonexistentFiles() {
  const schemaNamesMustExist = (
    /** @type {string[]} */ schemaNames,
    /** @type {string} */ propertyName,
  ) => {
    for (const schemaName of schemaNames) {
      if (!SchemasToBeTested.includes(`${schemaName}`)) {
        printErrorAndExit(new Error(), [
          `Expected to find file at path "${SchemaDir}/${schemaName}"`,
          `Filename "${schemaName}" declared in file "${SchemaValidationFile}" under property "${propertyName}[]"`,
        ])
      }
    }
  }

  schemaNamesMustExist(SchemaValidation.ajvNotStrictMode, 'ajvNotStrictMode')
  schemaNamesMustExist(SchemaValidation.skiptest, 'skiptest')
  schemaNamesMustExist(SchemaValidation.missingCatalogUrl, 'missingCatalogUrl')
  schemaNamesMustExist(SchemaValidation.highSchemaVersion, 'highSchemaVersion')
  for (const schemaName in SchemaValidation.options) {
    if (!SchemasToBeTested.includes(schemaName)) {
      printErrorAndExit(new Error(), [
        `Expected to find file at path "${SchemaDir}/${schemaName}"`,
        `Filename "${schemaName}" declared in file "${SchemaValidationFile}" under property "options"`,
      ])
    }
  }
  console.info('✔️ schema-validation.jsonc has no invalid schema names')

  const schemaUrlsMustExist = async (
    /** @type {string[]} */ schemaUrls,
    /** @type {string} */ propertyName,
  ) => {
    const /** @type {string[]} */ catalogUrls = []
    await forEachCatalogUrl((catalogUrl) => {
      catalogUrls.push(catalogUrl)
    })
    for (const schemaUrl of schemaUrls) {
      if (!catalogUrls.includes(schemaUrl)) {
        printErrorAndExit(new Error(), [
          `Failed to find a "url" with value of "${schemaUrl}" in file "${CatalogFile}" under property "${propertyName}[]"`,
        ])
      }
    }
  }

  await schemaUrlsMustExist(
    SchemaValidation.catalogEntryNoLintNameOrDescription,
    'catalogEntryNoLintNameOrDescription',
  )

  console.info(`✔️ schema-validation.jsonc has no invalid schema URLs`)
}

async function assertTestFileHasSchemaPragma(
  /** @type {SchemaFile} */ schemaFile,
  /** @type {DataFile} */ testFile,
  /** @type {Ora} */ spinner,
) {
  if (testFile.path.endsWith('yaml') || testFile.path.endsWith('yml')) {
    const firstLine = await readFirstLine(testFile.path)
    const expected = `# yaml-language-server: $schema=${path.relative(path.dirname(testFile.path), schemaFile.path).replaceAll('\\', '/')}`

    if (firstLine !== expected) {
      if (argv.fix) {
        spinner.info(`Fixing pragma for file "${testFile.path}"`)
        if (firstLine.includes('yaml-language-server')) {
          const oldContent = await fs.readFile(testFile.path, 'utf-8')
          const newContent =
            expected + '\n' + oldContent.slice(oldContent.indexOf('\n') + 1)
          await fs.writeFile(testFile.path, newContent)
        } else {
          const newContent =
            expected + '\n' + (await fs.readFile(testFile.path, 'utf-8'))
          await fs.writeFile(testFile.path, newContent)
        }
      } else {
        spinner.stop()
        printErrorAndExit(new Error(), [
          `Failed to find schema pragma for YAML File "./${testFile.path}"`,
          `Expected first line of file to be "${expected}"`,
          `But, found first line of file to be "${firstLine}"`,
          `Append "--fix" to the command line to automatically fix all fixable issues`,
        ])
      }
    }
  } else if (testFile.path.endsWith('.toml')) {
    const firstLine = await readFirstLine(testFile.path)
    const expected = `#:schema ${path.relative(path.dirname(testFile.path), schemaFile.path).replaceAll('\\', '/')}`

    if (firstLine !== expected) {
      if (argv.fix) {
        spinner.info(`Fixing pragma for file "${testFile.path}"`)
        if (firstLine.includes('#:schema')) {
          const oldContent = await fs.readFile(testFile.path, 'utf-8')
          const newContent =
            expected + '\n' + oldContent.slice(oldContent.indexOf('\n') + 1)
          await fs.writeFile(testFile.path, newContent)
        } else {
          const newContent =
            expected + '\n' + (await fs.readFile(testFile.path, 'utf-8'))
          await fs.writeFile(testFile.path, newContent)
        }
      } else {
        spinner.stop()
        printErrorAndExit(new Error(), [
          `Failed to find schema pragma for TOML File "./${testFile.path}"`,
          `Expected first line of file to be "${expected}"`,
          `But, found first line of file to be "${firstLine}"`,
          `Append "--fix" to the command line to automatically fix all fixable issues`,
        ])
      }
    }
  }
  spinner.start()

  async function readFirstLine(/** @type {string} */ filepath) {
    const inputStream = fsCb.createReadStream(filepath)
    try {
      for await (const line of readline.createInterface(inputStream))
        return line
      return '' // If the file is empty.
    } finally {
      inputStream.destroy() // Destroy file stream.
    }
  }
}

function assertSchemaValidationJsonHasValidSkipTest() {
  const check = (
    /** @type {string[]} */ schemaNames,
    /** @type {string} */ propertyName,
  ) => {
    for (const schemaName of schemaNames) {
      if (SchemaValidation.skiptest.includes(schemaName)) {
        printErrorAndExit(new Error(), [
          `Did not expect to find filename "${schemaName}" in file "${SchemaValidationFile}" under property "${propertyName}[]"`,
          `Because filename "${schemaName}" is listed under "skiptest", it should not be referenced anywhere else in the file`,
        ])
      }
    }
  }

  check(SchemaValidation.ajvNotStrictMode, 'ajvNotStrictMode')
  check(SchemaValidation.missingCatalogUrl, 'missingCatalogUrl')
  check(SchemaValidation.highSchemaVersion, 'highSchemaVersion')

  for (const schemaName in SchemaValidation.options) {
    if (SchemaValidation.skiptest.includes(schemaName)) {
      printErrorAndExit(new Error(), [
        `Did not expect to find filename "${schemaName}" in file "${SchemaValidationFile}" under property "options"`,
        `Because filename "${schemaName}" is listed under "skiptest", it should not be referenced anywhere else in the file`,
      ])
    }
  }

  // Test folder must not exist if defined in skiptest[]
  for (const schemaName of SchemaValidation.skiptest) {
    const folderName = schemaName.replace(/\.json$/, '')

    if (FoldersPositiveTest.includes(folderName)) {
      printErrorAndExit(new Error(), [
        `Did not expect to find positive test directory at "./${path.join(TestPositiveDir, folderName)}"`,
        `Because filename "${schemaName}" is listed under "skiptest", it should not have any positive test files`,
      ])
    }

    if (FoldersNegativeTest.includes(folderName)) {
      printErrorAndExit(new Error(), [
        `Did not expect to find negative test directory at "./${path.join(TestNegativeDir, folderName)}"`,
        `Because filename "${schemaName}" is listed under "skiptest", it should not have any negative test files`,
      ])
    }
  }

  console.info(`✔️ schema-validation.jsonc has no invalid skiptest[] entries`)
}

function assertFileHasCorrectExtensions(
  /** @type {string} */ pathname,
  /** @type {string[]} */ allowedExtensions,
) {
  if (!allowedExtensions.includes(path.parse(pathname).ext)) {
    printErrorAndExit(new Error(), [
      `Expected schema file "./${pathname}" to have a valid file extension`,
      `Valid file extensions: ${JSON.stringify(allowedExtensions, null, 2)}`,
    ])
  }
}

function assertFileHasNoBom(/** @type {DataFile} */ file) {
  const bomTypes = [
    { name: 'UTF-8', signature: [0xef, 0xbb, 0xbf] },
    { name: 'UTF-16 (BE)', signature: [0xfe, 0xff] },
    { name: 'UTF-16 (LE)', signature: [0xff, 0xfe] },
    { name: 'UTF-32 (BE)', signature: [0x00, 0x00, 0xff, 0xfe] },
    { name: 'UTF-32 (LE)', signature: [0xff, 0xfe, 0x00, 0x00] },
  ]

  for (const bom of bomTypes) {
    if (file.buffer.length >= bom.signature.length) {
      const bomFound = bom.signature.every(
        (value, index) => file.buffer[index] === value,
      )

      if (bomFound) {
        printErrorAndExit(new Error(), [
          `Expected to have no BOM (${bom.name} BOM) in file "./${file.path}"`,
        ])
      }
    }
  }
}

async function assertFilePassesJsonLint(
  /** @type {DataFile} */ file,
  /** @type {Record<string, unknown>} */ options,
) {
  try {
    jsonlint.parse(file.text, {
      ignoreBOM: false,
      ignoreComments: false,
      ignoreTrailingCommas: false,
      allowSingleQuotedStrings: false,
      allowDuplicateObjectKeys: false,
      ...options,
    })
  } catch (err) {
    printErrorAndExit(err, [
      `Failed strict jsonlint parse of file "./${file.path}"`,
    ])
  }
}

async function assertFileValidatesAgainstSchema(
  /** @type {string} */ filepath,
  /** @type {string} */ schemaFilepath,
) {
  const [data, schemaJson] = await Promise.all([
    fs.readFile(filepath, 'utf-8').then((data) => jsoncParser.parse(data)),
    readJsonFile(schemaFilepath),
  ])

  const ajv = new AjvDraft06And07({
    strict: true,
  })
  addFormats(ajv)

  if (ajv.validate(schemaJson, data)) {
    console.info(`✔️ ${path.basename(filepath)} validates against its schema`)
  } else {
    printSchemaValidationErrorAndExit(filepath, schemaFilepath, ajv.errors)
  }
}

async function assertSchemaHasValidSchemaField(
  /** @type {SchemaFile} */ schema,
) {
  const schemaDialectUrls = SchemaDialects.map(
    (schemaDialect) => schemaDialect.url,
  )
  if (!schemaDialectUrls.includes(schema.json.$schema)) {
    printErrorAndExit(new Error(), [
      `Invalid or missing '$schema' keyword in schema file "${schema.name}"`,
      `Valid schemas: ${JSON.stringify(schemaDialectUrls)}`,
    ])
  }

  if (!SchemaValidation.highSchemaVersion.includes(schema.name)) {
    const tooHighSchemas = SchemaDialects.filter(
      (schemaDialect) => schemaDialect.isTooHigh,
    ).map((schemaDialect) => schemaDialect.url)
    if (tooHighSchemas.includes(schema.json.$schema)) {
      printErrorAndExit(new Error(), [
        `Found a too high schema version in file "./${schema.path}"`,
        `Schema version "${schema.json.$schema}" is not supported by many editors and IDEs`,
        `We recommend using a lower schema version.`,
        `To ignore this error, append to the "highSchemaVersion" key in "${SchemaValidationFile}"`,
      ])
    }
  }
}

async function assertSchemaHasValidIdField(/** @type {SchemaFile} */ schema) {
  let schemaId = ''
  /**
   * Old JSON Schema specification versions use the "id" key for unique
   * identifiers, rather than "$id". See for details:
   * https://json-schema.org/understanding-json-schema/basics.html#declaring-a-unique-identifier
   */
  const schemasWithDollarlessId = [
    'http://json-schema.org/draft-03/schema#',
    'http://json-schema.org/draft-04/schema#',
  ]
  if (schemasWithDollarlessId.includes(schema.json.$schema)) {
    if (schema.json.id === undefined) {
      printErrorAndExit(new Error(), [
        `Missing property 'id' for schema "./${path.join(SchemaDir, schema.name)}"`,
      ])
    }
    schemaId = schema.json.id
  } else {
    if (schema.json.$id === undefined) {
      printErrorAndExit(new Error(), [
        `Missing property '$id' for schema "./${path.join(SchemaDir, schema.name)}"`,
      ])
    }
    schemaId = schema.json.$id
  }

  if (!schemaId.startsWith('https://') && !schemaId.startsWith('http://')) {
    printErrorAndExit(new Error(), [
      `Expected schema id/$id to begin with 'https://' or 'http://'`,
      `Found schema with value of "${schemaId}" in "./${path.join(SchemaDir, schema.name)}"`,
    ])
  }
}

async function assertSchemaHasCorrectMetadata(
  /** @type {SchemaFile} */ schema,
) {
  const schemasWithDollarlessId = [
    'http://json-schema.org/draft-03/schema#',
    'http://json-schema.org/draft-04/schema#',
  ]

  if (schemasWithDollarlessId.includes(schema.json.$schema)) {
    if (schema.json.$id) {
      printErrorAndExit(new Error(), [
        `Expected to find correct metadata on schema file "./${schema.path}"`,
        `Bad property of '$id'; expected 'id' for this schema version`,
      ])
    }

    if (schema.json.id !== `https://json.schemastore.org/${schema.name}`) {
      printErrorAndExit(new Error(), [
        `Expected to find correct metadata on schema file "./${schema.path}"`,
        `Incorrect property 'id' for schema "./${path.join(SchemaDir, schema.name)}"`,
        `Expected value of "https://json.schemastore.org/${schema.name}"`,
        `Found value of "${schema.json.id}"`,
      ])
    }
  } else {
    if (schema.json.id) {
      printErrorAndExit(new Error(), [
        `Expected to find correct metadata on schema file "./${schema.path}"`,
        `Bad property of 'id'; expected '$id' for this schema version`,
      ])
    }

    if (schema.json.$id !== `https://json.schemastore.org/${schema.name}`) {
      printErrorAndExit(new Error(), [
        `Expected to find correct metadata on schema file "./${schema.path}"`,
        `Incorrect property '$id' for schema "./${path.join(SchemaDir, schema.name)}"`,
        `Expected value of "https://json.schemastore.org/${schema.name}"`,
        `Found value of "${schema.json.$id}"`,
      ])
    }
  }
}

async function assertSchemaNoSmartQuotes(/** @type {SchemaFile} */ schema) {
  const buffer = schema.buffer
  const bufferArr = buffer.toString().split('\n')

  for (let i = 0; i < bufferArr.length; ++i) {
    const line = bufferArr[i]

    if (/"(?:description|title)": ".*?:"/.test(line)) {
      printErrorAndExit(new Error(), [
        `Do not expect "description" or "title" to end with a colon`,
        `Failed to successfully validate file "${schema.path}:${i + 1}"`,
      ])
    }

    // const smartQuotes = ['‘', '’', '“', '”']
    // for (const quote of smartQuotes) {
    //   if (line.includes(quote)) {
    //     printErrorAndExit(new Error(), [
    //       `Expected file to have no smart quotes`,
    //       `Found smart quotes in file "./${schema.path}:${++i}"`,
    //     ])
    //   }
    // }
  }
}

async function assertTopLevelRefIsStandalone(/** @type {SchemaFile} */ schema) {
  if (schema.json.$ref?.startsWith('http')) {
    for (const [member] of Object.entries(schema.json)) {
      if (member !== '$ref') {
        printErrorAndExit(new Error(), [
          `Schemas that reference a remote schema must only have $ref as a property. Found property "${member}" for "${schema.name}"`,
        ])
      }
    }
  }
}

async function printSchemaReport() {
  // `bowtie validate --implementation go-gojsonschema ./src/schemas/json/ava.json ./src/test/ava/ava.config.json`
  console.log('TODO')
}

async function printDowngradableSchemaVersions() {
  console.info('Check if a schema can use a lower "$schema" version')

  await forEachFile({ onSchemaFile })
  console.info(`Done.`)

  /**
   * There are no positive or negative test processes here. Only the
   * schema files are
   */
  async function onSchemaFile(/** @type {SchemaFile} */ schema) {
    const schemaDialectVersionIndex = SchemaDialects.findIndex(
      (schemaDialect) => {
        return schema.json.$schema === schemaDialect.url
      },
    )

    // Test each schema version in a while loop.
    let validates = false
    let recommendedIndex = schemaDialectVersionIndex
    let versionIndexToBeTested = schemaDialectVersionIndex
    do {
      // Attempt to use the next lower schema version.
      versionIndexToBeTested++
      const schemaDialectToBeTested = SchemaDialects[versionIndexToBeTested]
      if (!schemaDialectToBeTested.isActive) {
        break
      }

      const options = getSchemaOptions(schema.name)
      const ajv = await ajvFactory({
        draftVersion: schemaDialectToBeTested.draftVersion,
        fullStrictMode: false,
        unknownFormats: options.unknownFormats,
        unknownKeywords: options.unknownKeywords,
        unknownSchemas: options.unknownSchemas,
      })

      schema.json.$schema = schemaDialectToBeTested.url
      try {
        ajv.compile(schema.json)
        validates = true
      } catch {
        validates = false
      }

      // It passes the test. So this is the new recommended index
      if (validates) {
        recommendedIndex = versionIndexToBeTested
      }

      // Continue until the validation process fails.
    } while (validates)

    // If found a different schema version that also works.
    if (recommendedIndex !== schemaDialectVersionIndex) {
      const original = SchemaDialects[schemaDialectVersionIndex].draftVersion
      const recommended = SchemaDialects[recommendedIndex].draftVersion
      console.info(
        `Schema "${schema.name}" (${original}) can likely be downgraded to "${recommended}"`,
      )
    }
  }
}

async function printSimpleStatistics() {
  {
    let countScanURLExternal = 0
    let countScanURLInternal = 0

    await forEachCatalogUrl((catalogUrl) => {
      catalogUrl.startsWith(UrlSchemaStore)
        ? countScanURLInternal++
        : countScanURLExternal++
    })

    const totalCount = countScanURLExternal + countScanURLInternal
    const percentExternal = Math.round(
      (countScanURLExternal / totalCount) * 100,
    )

    console.info(`Out of ${totalCount} TOTAL schemas:`)
    console.info(
      `- ${countScanURLInternal} (${100 - percentExternal}%) are SchemaStore URLs`,
    )
    console.info(
      `- ${countScanURLExternal} (${percentExternal}%) are External URLs`,
    )
    console.info()
  }

  {
    let totalSchemas = 0
    let validatingInStrictMode = 0
    let totalPositiveTests = 0
    let totalNegativeTests = 0

    for (const schemaName of SchemasToBeTested) {
      if (SchemaValidation.skiptest.includes(schemaName)) {
        continue
      }

      totalSchemas += 1

      if (SchemaValidation.ajvNotStrictMode.includes(schemaName)) {
        validatingInStrictMode += 1
      }

      if (FoldersPositiveTest.includes(schemaName.replace('.json', ''))) {
        totalPositiveTests += 1
      }

      if (FoldersNegativeTest.includes(schemaName.replace('.json', ''))) {
        totalNegativeTests += 1
      }
    }

    const strictModePercent = Math.round(
      (validatingInStrictMode / totalSchemas) * 100,
    )
    const positivePercent = Math.round(
      (totalPositiveTests / totalSchemas) * 100,
    )
    const negativePercent = Math.round(
      (totalNegativeTests / totalSchemas) * 100,
    )

    console.info(`Out of ${totalSchemas} TESTED schemas:`)
    console.info(
      `- ${validatingInStrictMode} (${strictModePercent}%) are validated with Ajv's strict mode`,
    )
    console.info(`- ${totalPositiveTests} (${positivePercent}%) have tests`)
    console.info(
      `- ${totalNegativeTests} (${negativePercent}%) have negative tests`,
    )
    console.info()
  }

  {
    let totalSchemas = 0
    /** @type {Map<string, number>} */
    const schemaDialectCounts = new Map(
      SchemaDialects.map((schemaDialect) => [schemaDialect.url, 0]),
    )

    await forEachFile({
      async onSchemaFile(/** @type {SchemaFile} */ schema) {
        totalSchemas += 1

        let schemaDialect = getSchemaDialect(schema.json.$schema)
        if (schemaDialect) {
          schemaDialectCounts.set(
            schemaDialect.url,
            // @ts-expect-error
            schemaDialectCounts.get(schemaDialect.url) + 1,
          )
        }
      },
    })

    console.info(`Out of ${totalSchemas} TESTED schemas:`)
    for (const schemaDialect of SchemaDialects) {
      const versionPadded = schemaDialect.draftVersion.startsWith('draft-')
        ? schemaDialect.draftVersion
        : ` ${schemaDialect.draftVersion}`

      console.info(
        `- Total ${versionPadded}: ${schemaDialectCounts.get(schemaDialect.url)}`,
      )
    }
  }
}

{
  const helpMenu = `USAGE:
  node ./cli.js [--help] [--schema-name=<schema>] <taskName|functionName>

TASKS:
  new-schema: Create a new JSON schema
  lint: Run less-important checks on schemas
  check: Run all build checks
  check-strict: Checks all or the given schema against the strict meta schema
  check-remote: Run all build checks for remote schemas
  maintenance: Run maintenance checks

EXAMPLES:
  node ./cli.js check
  node ./cli.js check --fix
  node ./cli.js check --schema-name=schema-catalog.json
  node ./cli.js check-strict --schema-name=schema-catalog.json
`

  if (!argv._[0]) {
    process.stderr.write(helpMenu + '\n')
    process.stderr.write(`${chalk.red('Error:')} No argument given` + '\n')
    process.exit(1)
  }
  if (argv._[1]) {
    process.stderr.write(helpMenu + '\n')
    process.stderr.write(
      `${chalk.red('Error:')} Too many arguments given` + '\n',
    )
    process.exit(1)
  }
  if (argv.help) {
    console.info(helpMenu)
    process.exit(0)
  }

  /** @type {Record<string, () => Promise<unknown>>} */
  const taskMap = {
    'new-schema': taskNewSchema,
    lint: taskLint,
    check: taskCheck,
    'check-strict': taskCheckStrict,
    'check-remote': taskCheckRemote,
    report: taskReport,
    maintenance: taskMaintenance,
    build: taskCheck, // Undocumented alias.
  }
  const taskOrFn = argv._[0]
  if (taskOrFn in taskMap) {
    if (taskOrFn === 'build') {
      process.stdout.write(
        `WARNING: Please use the "check" task instead of "build". The "build" task will be removed.\n`,
      )
    }

    await taskMap[taskOrFn]()
  } else {
    eval(`${taskOrFn}()`)
  }
}
