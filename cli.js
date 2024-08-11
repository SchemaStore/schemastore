/// <binding AfterBuild='build' />
// @ts-check
import path from 'node:path'
import fs from 'node:fs/promises'
import readline from 'node:readline'
import util from 'node:util'

import _AjvDraft04 from 'ajv-draft-04'
import { Ajv as AjvDraft06And07 } from 'ajv'
import _Ajv2019 from 'ajv/dist/2019.js'
import _Ajv2020 from 'ajv/dist/2020.js'
import _AjvStandalone from 'ajv/dist/standalone/index.js'
import _addFormats from 'ajv-formats'
import ajvFormatsDraft2019 from 'ajv-formats-draft2019'
import TOML from '@ltd/j-toml'
import YAML from 'yaml'
import schemasafe from '@exodus/schemasafe'
import prettier from 'prettier'
import fetch from 'node-fetch'
import jsonlint from '@prantlf/jsonlint'
import * as jsoncParser from 'jsonc-parser'
import chalk from 'chalk'
import minimist from 'minimist'

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

/** @type {typeof _AjvStandalone.default} */
const AjvStandalone = /** @type {any} */ (_AjvStandalone)

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

const TempCoverageDir = './temp'
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
).map(filterIgnoredFiles)

// prettier-ignore
const SchemaDialects = [
  { draftVersion: '2020-12', url: 'https://json-schema.org/draft/2020-12/schema', isActive: true, isTooHigh: true },
  { draftVersion: '2019-09', url: 'https://json-schema.org/draft/2019-09/schema', isActive: true, isTooHigh: true },
  { draftVersion: 'draft-07', url: 'http://json-schema.org/draft-07/schema#', isActive: true, isTooHigh: false },
  { draftVersion: 'draft-06', url: 'http://json-schema.org/draft-06/schema#', isActive: false, isTooHigh: false },
  { draftVersion: 'draft-04', url: 'http://json-schema.org/draft-04/schema#', isActive: false, isTooHigh: false },
  { draftVersion: 'draft-03', url: 'http://json-schema.org/draft-03/schema#', isActive: false, isTooHigh: false },
]

/** @type {{ _: string[], help?: boolean, lint?: boolean, SchemaName?: string }} */
const argv = /** @type {any} */ (
  minimist(process.argv.slice(2), {
    boolean: [' help', 'lint'],
  })
)

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
 * @property {string[]} fileMatch
 * @property {string} url
 * @property {Record<string, string>} versions
 *
 * @typedef {Object} CatalogJson
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
 * @typedef {Object} SchemaFile
 * @property {Buffer} buffer
 * @property {string} text
 * @property {JsonSchema} json
 * @property {string} name
 * @property {string} uri
 *
 * @typedef {Object} DataFile
 * @property {Buffer} buffer
 * @property {string} text
 * @property {object} json
 * @property {string} name
 * @property {string} uri
 */

function logInfo(/** @type {string} */ msg) {
  console.log(chalk.green('>>') + ' ' + msg)
}

function logError(/** @type {string} */ msg) {
  console.error(chalk.red('>>') + ' ' + msg)
}

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

function filterIgnoredFiles(/** @type {string[]} */ files) {
  return files.filter((file) => file !== '.DS_Store')
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
 * @typedef {Object} ForEachDataFile
 * @property {(arg0: SchemaFile) => Promise<void>} [onSchemaFile]
 * @property {(arg0: DataFile) => Promise<void>} [onPositiveTestFile]
 * @property {(arg0: DataFile) => Promise<void>} [onNegativeTestFile]
 * @property {(arg0: SchemaFile) => Promise<void>} [afterSchemaFile]
 *
 */
async function forEachDataFile(/** @type {ForEachDataFile} */ obj) {
  for (const dirent1 of await fs.readdir(SchemaDir, { withFileTypes: true })) {
    const schemaName = dirent1.name

    if (argv.SchemaName && argv.SchemaName !== schemaName) {
      continue
    }

    // TODO: Make invalidation more specific
    if (SchemaValidation.skiptest.includes(schemaName)) {
      continue
    }

    const schemaPath = path.join(SchemaDir, schemaName)
    const schema = await toSchema(schemaPath, schemaName)
    await obj?.onSchemaFile?.(schema)

    const positiveTestDir = path.join(TestPositiveDir, schemaName)
    if (await exists(positiveTestDir)) {
      for (const testfile of await fs.readdir(positiveTestDir)) {
        const schemaPath = path.join(TestPositiveDir, schemaName, testfile)
        const schema = await toSchema(schemaPath, schemaName)
        await obj?.onPositiveTestFile?.(schema)
      }
    }

    const negativeTestDir = path.join(TestNegativeDir, schemaName)
    if (await exists(negativeTestDir)) {
      for (const testfile of await fs.readdir(negativeTestDir)) {
        const schemaPath = path.join(TestNegativeDir, schemaName, testfile)
        const schema = await toSchema(schemaPath, schemaName)
        await obj?.onNegativeTestFile?.(schema)
      }
    }

    await obj?.afterSchemaFile?.(schema)
  }

  async function toSchema(
    /** @type {string} */ uri,
    /** @type {string} */ schemaName,
  ) {
    const buffer = await fs.readFile(uri)
    const text = buffer.toString()
    return {
      buffer,
      text,
      json: await readDataFile({ uri, text }),
      name: schemaName,
      uri,
    }
  }

  async function readDataFile(
    /** @type {{uri: string, text: string }} */ { uri, text },
  ) {
    const fileExtension = path.parse(uri).ext
    switch (fileExtension) {
      case '.json':
        try {
          return JSON.parse(text)
        } catch (err) {
          printErrorAndExit(err, [`Failed to parse JSON file "${uri}"`])
        }
        break
      case '.yaml':
      case '.yml':
        try {
          return YAML.parse(text)
        } catch (err) {
          printErrorAndExit(err, [`Failed to parse YAML file "${uri}"`])
        }
        break
      case '.toml':
        try {
          /**
           * Set `bigint` to `false` so JSON numbers parse as JavaScript
           * numbers (instead of JavaScript BigInts).
           */
          return TOML.parse(text, {
            bigint: false,
            joiner: '\n',
          })
        } catch (err) {
          printErrorAndExit(err, [`Failed to decode TOML file "${uri}"`])
        }
        break
      default:
        printErrorAndExit(new Error(), [
          `Unable to handle file extension "${fileExtension}" for file "${uri}"`,
        ])
    }
  }
}

async function forEachTestFile() {
  // await Promise.all([onTestDir(TestPositiveDir), onTestDir(TestNegativeDir)])
  await onTestDir(TestPositiveDir)
  await onTestDir(TestNegativeDir)

  async function onTestDir(/** @type {string} */ rootTestDir) {}
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
      logError(msg)
    }
  }

  if (extraText) {
    process.stderr.write(extraText)
    process.stderr.write('\n')
  }

  console.warn('---')
  process.stderr.write(error instanceof Error ? error?.stack ?? '' : '')
  process.stderr.write('\n')
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
 * @typedef {Object} ajvFactoryOptions
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
  /** @type {ajvFactoryOptions} */ {
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
  for (const unknownKeyword of unknownKeywords) {
    ajv.addKeyword(unknownKeyword)
  }

  /**
   * Ditto, but with "$ref" URIs to external schemas.
   */
  for (const schemaPath of unknownSchemas) {
    ajv.addSchema(await readJsonFile(schemaPath.toString()))
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

async function ajv() {
  const textCompile = 'compile              | '
  const textPassSchema = 'pass schema          | '
  const textPositivePassTest = 'pass positive test   | '
  const textPositiveFailedTest = 'Failed positive test | '
  const textNegativePassTest = 'pass negative test   | '
  const textNegativeFailedTest = 'Failed negative test | '

  /** @type {undefined | ((arg0: object) => boolean)} */
  let validateFn
  let totalSchemas = 0

  const schemaForTestScan = async (/** @type {SchemaOld} */ schema) => {
    const fullStrictMode = !SchemaValidation.ajvNotStrictMode.includes(
      schema.name,
    )

    const schemaDialect = getSchemaDialect(schema.json.$schema)
    const options = getSchemaOptions(schema.name)
    const ajv = await ajvFactory({
      draftVersion: schemaDialect.draftVersion,
      fullStrictMode,
      unknownFormats: options.unknownFormats,
      unknownKeywords: options.unknownKeywords,
      unknownSchemas: options.unknownSchemas,
    })

    const schemaVersionStr = schemaDialect
      ? schemaDialect.draftVersion
      : 'unknown'
    const fullStrictModeStr = fullStrictMode
      ? '(FullStrictMode)'
      : '(NotStrictMode)'

    try {
      validateFn = ajv.compile(schema.json)
    } catch (err) {
      printErrorAndExit(err, [
        `${textCompile}${schema.url} (${schemaVersionStr})${fullStrictModeStr}`,
      ])
    }

    totalSchemas++
    console.log()
    logInfo(
      `${textPassSchema}${schema.url} (${schemaVersionStr})${fullStrictModeStr}`,
    )
  }

  const processTestFile = (
    /** @type {SchemaOld} */ schema,
    /** @type {() => void} */ success,
    /** @type {() => void} */ failure,
  ) => {
    validateFn(schema.json) ? success() : failure()
  }

  const positiveTestScan = (/** @type {SchemaOld} */ schema) => {
    processTestFile(
      schema,
      () => {
        logInfo(`${textPositivePassTest}${schema.url}`)
      },
      () => {
        printErrorAndExit(
          new Error(),
          [
            `${textPositiveFailedTest} for schema file "${schema.url}"`,
            `Showing first error out of ${validateFn.errors?.length ?? '?'} total error(s)`,
          ],
          util.formatWithOptions(
            { colors: true },
            '%O',
            validateFn.errors?.[0] ?? '???',
          ),
        )
      },
    )
  }

  const negativeTestScan = (/** @type {SchemaOld} */ schema) => {
    processTestFile(
      schema,
      () => {
        printErrorAndExit(new Error(), [
          `${textNegativeFailedTest}${schema.url}`,
          'Negative test must always fail.',
        ])
      },
      () => {
        // must show log as single line
        // const path = validate.errors[0].instancePath
        let text = ''
        text = text.concat(`${textNegativePassTest}${schema.url}`)
        text = text.concat(` (Schema: ${validateFn.errors[0].schemaPath})`)
        text = text.concat(` (Test: ${validateFn.errors[0].instancePath})`)
        text = text.concat(` (Message): ${validateFn.errors[0].message})`)
        logInfo(text)
      },
    )
  }

  const schemaForTestScanDone = () => {
    console.log()
    logInfo(`Total schemas validated with Ajv: ${totalSchemas}`)
    totalSchemas = 0
  }

  return {
    schemaForTestScan,
    schemaForTestScanDone,
    positiveTestScan,
    negativeTestScan,
  }
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
  await assertSchemaHasCorrectMetadata()
  await lintTopLevelRefIsStandalone()
  await assertSchemaNoSmartQuotes()
}

async function taskCheck() {
  await assertFileSystemIsValid()

  // Check catalog.json.
  await assertCatalogJsonValidatesAgainstJsonSchema()
  await assertCatalogJsonPassesJsonLint()
  assertCatalogJsonHasNoDuplicateNames()
  assertCatalogJsonHasNoBadFields()
  assertCatalogJsonHasNoFileMatchConflict()
  await assertCatalogJsonLocalUrlsMustRefFile()
  await assertCatalogJsonIncludesAllSchemas()

  // Check schema-validation.jsonc.
  await assertSchemaValidationJsonValidatesAgainstJsonSchema()
  assertSchemaValidationJsonReferencesNoNonexistentFiles()
  assertSchemaValidationJsonHasNoUnmatchedUrls()
  assertSchemaValidationJsonHasValidSkipTest()

  // Perform basic validation checks for JSON Schema files, all their negative
  // tests, or all their positive tests.
  await forEachDataFile({
    async onSchemaFile(schema) {
      assertSchemaFileHasCorrectExtensions(schema)
      assertFileHasNoBom(schema)
      await assertFileHasNoDuplicatedPropertyKeys(schema)
      await assertSchemaHasValidIdField(schema)
      await assertSchemaHasValidSchemaField(schema)
      await assertSchemaPassesSchemaSafeLint(schema) // TODO: Make check
    },
    async onPositiveTestFile(file) {
      assertTestFileHasCorrectExtensions(file)
      assertFileHasNoBom(file)
      await assertFileHasNoDuplicatedPropertyKeys(file)
    },
    async onNegativeTestFile(file) {
      assertTestFileHasCorrectExtensions(file)
      assertFileHasNoBom(file)
      await assertFileHasNoDuplicatedPropertyKeys(file)
    },
  })
  logInfo(`Ran basic validation checks for all relevant files`)

  await printSchemasTestedInFullStrictMode()
  // printSchemasWithoutPositiveTestFiles()
  // Run JSON Schema validations
  // forEachTestFile(() => )
  // await forEachDataFile({
  //   async onSchemaFile(schema) {},
  //   async onPositiveTestFile(schema) {},
  //   async onNegativeTestFile(schema) {},
  //   async afterSchemaFile(schema) {},
  // })
  // await printUrlCountsInCatalog()
  // await printCountSchemaVersions()
}

async function taskCheckRemote() {
  console.info('TODO')
}

async function taskMaintenance() {
  console.log()
  await printDowngradableSchemaVersions()
  console.log()
  await printStrictAndNotStrictAjvValidatedSchemas()
}

async function taskCoverage() {
  // const ajv = await ajvFactory({
  //   draftVersion: schemaDialect.draftVersion,
  //   fullStrictMode: !SchemaValidation.ajvNotStrictMode.includes(jsonName),
  //   unknownFormats,
  //   unknownKeywords,
  //   options: {
  //     code: {
  //       source: true,
  //       esm: true,
  //     },
  //     schemas: multipleSchema,
  //   },
  // })
  // let moduleCode
  // if (isThisWithExternalSchema) {
  //   // Multiple schemas are combine to one JavaScript file.
  //   // Must use the root $id/id to call the correct 'main' schema in JavaScript code
  //   mainSchemaJsonId =
  //     getSchemaDialect(mainSchema.$schema).draftVersion === 'draft-04'
  //       ? mainSchema.id
  //       : mainSchema.$id
  //   if (!mainSchemaJsonId) {
  //     printErrorAndExit(new Error(), [`Missing $id or id in ${jsonName}`])
  //   }
  //   moduleCode = AjvStandalone(ajv)
  // } else {
  //   // Single schema
  //   mainSchemaJsonId = undefined
  //   moduleCode = AjvStandalone(ajv, ajv.compile(mainSchema))
  // }
  // // Prettify the JavaScript module code
  // const prettierOptions = await prettier.resolveConfig(process.cwd())
  // await fs.writeFile(
  //   javaScriptCoverageNameWithPath,
  //   await prettier.format(moduleCode, {
  //     ...prettierOptions,
  //     parser: 'babel',
  //     printWidth: 200,
  //   }),
  // )
  // // Now use this JavaScript as validation in the positive and negative test
  // validations = await readJsonFile(javaScriptCoverageNameWithPath)
  // const schemaNameArg = argv.SchemaName
  // if (!schemaNameArg) {
  //   printErrorAndExit(new Error(), [
  //     'Must start "make" file with --SchemaName parameter.',
  //   ])
  // }
  // await generateCoverage(schemaNameArg)
  // logInfo('OK')
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
        const schemaName = testDir + '.json'
        const schemaPath = path.join(SchemaDir, schemaName)
        if (!(await exists(schemaPath))) {
          printErrorAndExit(new Error(), [
            `Failed to find a schema file at "${schemaPath}"`,
          ])
        }
      }
    }
  }

  logInfo('directories: directory structure is valid')
}

async function assertCatalogJsonPassesJsonLint() {
  try {
    jsonlint.parse(await fs.readFile(CatalogFile, 'utf-8'), {
      ignoreBOM: false,
      ignoreComments: false,
      ignoreTrailingCommas: false,
      allowSingleQuotedStrings: false,
      allowDuplicateObjectKeys: false,
    })
    logInfo('catalog.json: Parses with jsonlint')
  } catch (err) {
    printErrorAndExit(err, [
      `Failed strict jsonlint parse of file "${CatalogFile}"`,
    ])
  }
}

async function assertCatalogJsonValidatesAgainstJsonSchema() {
  const catalogSchemaFile = path.join(SchemaDir, 'schema-catalog.json')
  const catalogSchema = await readJsonFile(catalogSchemaFile)

  const ajv = new AjvDraft06And07({
    strict: true,
  })
  addFormats(ajv)

  if (ajv.validate(catalogSchema, Catalog)) {
    logInfo('catalog.json: Validates against schema')
  } else {
    printErrorAndExit(
      new Error(),
      [
        `Failed to validate file "${CatalogFile}" against schema file "${catalogSchemaFile}"`,
        `Showing first error out of ${ajv.errors?.length ?? '?'} total error(s)`,
      ],
      util.formatWithOptions({ colors: true }, '%O', ajv.errors?.[0] ?? '???'),
    )
  }
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
      printErrorAndExit(new Error(), [
        `Found two schema entries with duplicate "name" of "${catalogEntry.name}" in file "${CatalogFile}"`,
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
          `Expected the "name" or "description" properties of catalog entries to not include the word "schema"`,
          `All files are already schemas, so its meaning is implied`,
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

  logInfo(`catalog.json: Has no fields that break guidelines`)
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
        printErrorAndExit(new Error(), [
          `Expected "fileMatch" value of "${fileGlob}" to be unique across all "fileMatch" properties in file "${CatalogFile}"`,
        ])
      }

      allFileMatches.push(fileGlob)
    }
  }

  logInfo('catalog.json: No duplicate "fileMatch" values found')
}

async function assertCatalogJsonLocalUrlsMustRefFile() {
  await forEachCatalogUrl((/** @type {string} */ catalogUrl) => {
    // Skip external schemas.
    if (!catalogUrl.startsWith(UrlSchemaStore)) {
      return
    }

    const filename = new URL(catalogUrl).pathname.slice(1)

    // Check that local URLs have end in .json
    if (!filename.endsWith('.json')) {
      printErrorAndExit(new Error(), [
        `Expected catalog entries for local files to have a "url" that ends in ".json"`,
        `The invalid entry has a "url" of "${catalogUrl}" in file "${CatalogFile}"`,
      ])
    }

    // Check if schema file exist or not.
    if (!exists(path.join(SchemaDir, filename))) {
      printErrorAndExit(new Error(), [
        `Expected schema file to exist at "${path.join(SchemaDir, filename)}", but no file found`,
        `Schema file path inferred from catalog entry with a "url" of "${catalogUrl}" in file "${CatalogFile}"`,
      ])
    }
  })

  logInfo(`catalog.json: All local entries point to a schema file that exists`)
}

async function assertCatalogJsonIncludesAllSchemas() {
  const /** @type {string[]} */ allCatalogLocalJsonFiles = []

  await forEachCatalogUrl((/** @type {string} */ catalogUrl) => {
    if (catalogUrl.startsWith(UrlSchemaStore)) {
      const filename = new URL(catalogUrl).pathname.slice(1)
      allCatalogLocalJsonFiles.push(filename)
    }
  })

  for (const schemaName of await fs.readdir(SchemaDir)) {
    if (SchemaValidation.missingCatalogUrl.includes(schemaName)) {
      return
    }

    if (!allCatalogLocalJsonFiles.includes(schemaName)) {
      printErrorAndExit(new Error(), [
        `Expected schema file "${schemaName}" to have a corresponding entry in the catalog file "${CatalogFile}"`,
        `If this is intentional, ignore this error by appending to the property "missingCatalogUrl" in file "${SchemaValidationFile}"`,
      ])
    }
  }

  logInfo(`catalog.json: All local entries exist in file total`)
}

async function assertSchemaValidationJsonValidatesAgainstJsonSchema() {
  const schemaValidationSchemaFile = './src/schema-validation.schema.json'
  const schemaValidationSchema = await readJsonFile(schemaValidationSchemaFile)

  const ajv = new AjvDraft06And07({
    strict: true,
  })
  addFormats(ajv)

  if (ajv.validate(schemaValidationSchema, SchemaValidation)) {
    logInfo('schema-validation.jsonc: Validates against schema')
  } else {
    printErrorAndExit(
      new Error(),
      [
        `Failed to validate file "${SchemaValidationFile}" against schema file "${schemaValidationSchemaFile}"`,
        `Showing first error out of ${ajv.errors?.length} total error(s)`,
      ],
      util.formatWithOptions({ colors: true }, '%O', ajv.errors?.[0] ?? '???'),
    )
  }
}

function assertSchemaValidationJsonReferencesNoNonexistentFiles() {
  const check = (
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

  check(SchemaValidation.ajvNotStrictMode, 'ajvNotStrictMode')
  check(SchemaValidation.skiptest, 'skiptest')
  check(SchemaValidation.missingCatalogUrl, 'missingCatalogUrl')
  check(SchemaValidation.highSchemaVersion, 'highSchemaVersion')

  for (const schemaName in SchemaValidation.options) {
    if (!SchemasToBeTested.includes(schemaName)) {
      printErrorAndExit(new Error(), [
        `Expected to find file at path "${SchemaDir}/${schemaName}"`,
        `Filename "${schemaName}" declared in file "${SchemaValidationFile}" under property "options"`,
      ])
    }
  }

  logInfo('schema-validation.jsonc: References no non-existent files')
}

function assertSchemaValidationJsonHasNoUnmatchedUrls() {
  const check = (
    /** @type {string[]} */ schemaUrls,
    /** @type {string} */ propertyName,
  ) => {
    for (const schemaUrl of schemaUrls) {
      const catalogUrls = Catalog.schemas.map((item) => item.url)
      if (!catalogUrls.includes(schemaUrl)) {
        printErrorAndExit(new Error(), [
          `Failed to find a "url" with value of "${schemaUrl}" in file "${CatalogFile}" under property "${propertyName}[]"`,
        ])
      }
    }
  }

  check(
    SchemaValidation.catalogEntryNoLintNameOrDescription,
    'catalogEntryNoLintNameOrDescription',
  )

  logInfo(`schema-validation.jsonc: Has no unmatched URLs`)
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
        `Did not expect to find positive test directory at "${path.join(TestPositiveDir, folderName)}"`,
        `Because filename "${schemaName}" is listed under "skiptest", it should not have any positive test files`,
      ])
    }

    if (FoldersNegativeTest.includes(folderName)) {
      printErrorAndExit(new Error(), [
        `Did not expect to find negative test directory at "${path.join(TestNegativeDir, folderName)}"`,
        `Because filename "${schemaName}" is listed under "skiptest", it should not have any negative test files`,
      ])
    }
  }

  logInfo(
    `schema-validation.jsonc: Entries under skiptest[] are not used elsewhere`,
  )
}

function assertSchemaFileHasCorrectExtensions(
  /** @type {SchemaFile} */ schema,
) {
  if (!schema.uri.endsWith('.json')) {
    printErrorAndExit(new Error(), [
      `Expected schema file "${schema.uri}" to have a ".json" file extension`,
    ])
  }
}

function assertTestFileHasCorrectExtensions(/** @type {DataFile} */ file) {
  const validExtensions = ['.json', '.yml', '.yaml', '.toml']

  if (!validExtensions.includes(path.parse(file.uri).ext)) {
    printErrorAndExit(new Error(), [
      `Expected schema file "${file.uri}" to have a valid file extension`,
      `Valid file extensions: ${JSON.stringify(validExtensions, null, 2)}`,
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
          `Schema file must not have ${bom.name} BOM: ${file.uri}`,
        ])
      }
    }
  }
}

async function assertFileHasNoDuplicatedPropertyKeys(
  /** @type {DataFile} */ file,
) {
  const fileExtension = file.uri.split('.').pop()
  if (fileExtension !== 'json') return

  // TODO: Workaround for https://github.com/prantlf/jsonlint/issues/23
  if (file.name === 'tslint.json') {
    return
  }

  try {
    jsonlint.parse(file.text, {
      ignoreBOM: false,
      ignoreComments: false,
      ignoreTrailingCommas: false,
      allowSingleQuotedStrings: false,
      allowDuplicateObjectKeys: false,
    })
  } catch (err) {
    printErrorAndExit(err, [`Failed to parse file with jsonlint: ${file.uri}`])
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
      `Schema file has invalid or missing '$schema' keyword => ${schema.name}`,
      `Valid schemas: ${JSON.stringify(schemaDialectUrls)}`,
    ])
  }

  if (!SchemaValidation.highSchemaVersion.includes(schema.name)) {
    const tooHighSchemas = SchemaDialects.filter(
      (schemaDialect) => schemaDialect.isTooHigh,
    ).map((schemaDialect) => schemaDialect.url)
    if (tooHighSchemas.includes(schema.json.$schema)) {
      printErrorAndExit(new Error(), [
        `Schema version is too high => in file ${schema.name}`,
        `Schema version '${schema.json.$schema}' is not supported by many editors and IDEs`,
        `${schema.json} must use a lower schema version.`,
      ])
    }
  }
}

async function assertSchemaHasValidIdField(/** @type {SchemaFile} */ schema) {
  let schemaId = ''
  const schemasWithDollarlessId = [
    'http://json-schema.org/draft-03/schema#',
    'http://json-schema.org/draft-04/schema#',
  ]
  if (schemasWithDollarlessId.includes(schema.json.$schema)) {
    if (schema.json.id === undefined) {
      printErrorAndExit(new Error(), [
        `Missing property 'id' for schema 'src/schemas/json/${schema.name}'`,
      ])
    }
    schemaId = schema.json.id
  } else {
    if (schema.json.$id === undefined) {
      printErrorAndExit(new Error(), [
        `Missing property '$id' for schema 'src/schemas/json/${schema.name}'`,
      ])
    }
    schemaId = schema.json.$id
  }

  if (!schemaId.startsWith('https://') && !schemaId.startsWith('http://')) {
    printErrorAndExit(new Error(), [
      schemaId,
      `Schema id/$id must begin with 'https://' or 'http://' for schema 'src/schemas/json/${schema.name}'`,
    ])
  }
}

async function assertSchemaPassesSchemaSafeLint(
  /** @type {SchemaFile} */ schema,
) {
  if (!argv.lint) {
    return
  }

  const errors = schemasafe.lint(schema.json, {
    mode: 'strong',
  })
  for (const err of errors) {
    console.log(`${schema.name}: ${err.message}`)
  }
}

async function assertSchemaHasCorrectMetadata(
  /** @type {SchemaFile} */ schema,
) {
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
    if (schema.json.$id) {
      logError(`Bad property of '$id'; expected 'id' for this schema version`)
      return
    }

    if (schema.json.id !== `https://json.schemastore.org/${schema.name}`) {
      logError(
        `Incorrect property 'id' for schema 'src/schemas/json/${schema.name}'`,
      )
      console.warn(
        `     expected value: https://json.schemastore.org/${schema.name}`,
      )
      console.warn(`     found value   : ${schema.json.id}`)
    }
  } else {
    if (schema.json.id) {
      logError(`Bad property of 'id'; expected '$id' for this schema version`)
      return
    }

    if (schema.json.$id !== `https://json.schemastore.org/${schema.name}`) {
      logError(
        `Incorrect property '$id' for schema 'src/schemas/json/${schema.name}'`,
      )
      console.warn(
        `     expected value: https://json.schemastore.org/${schema.name}`,
      )
      console.warn(`     found value   : ${schema.json.$id}`)
    }
  }
}

async function assertSchemaNoSmartQuotes(/** @type {SchemaFile} */ schema) {
  const buffer = schema.buffer
  const bufferArr = buffer.toString().split('\n')

  for (let i = 0; i < bufferArr.length; ++i) {
    const line = bufferArr[i]

    const smartQuotes = ['‘', '’', '“', '”']
    for (const quote of smartQuotes) {
      if (line.includes(quote)) {
        logError(
          `Schema file should not have a smart quote: ${schema.uri}:${++i}`,
        )
      }
    }
  }
}

async function lintTopLevelRefIsStandalone(/** @type {SchemaFile} */ schema) {
  if (schema.json.$ref?.startsWith('http')) {
    for (const [member] of Object.entries(schema.json)) {
      if (member !== '$ref') {
        printErrorAndExit(new Error(), [
          `Schemas that reference a remote schema must only have $ref as a property. Found property "${member}" for ${schema.name}`,
        ])
      }
    }
  }
}

async function printCountSchemaVersions() {
  /** @type {Map<string, number>} */
  const schemaDialectCounts = new Map(
    SchemaDialects.map((schemaDialect) => [schemaDialect.url, 0]),
  )

  await localSchemaFileAndTestFile(
    {
      schemaOnlyScan(/** @type {SchemaOld} */ schema) {
        let schemaDialect = getSchemaDialect(schema.json.$schema)
        if (schemaDialect) {
          schemaDialectCounts.set(
            schemaDialect.url,
            // @ts-expect-error
            schemaDialectCounts.get(schemaDialect.url) + 1,
          )
        }
      },
      schemaOnlyScanDone() {
        for (const schemaDialect of SchemaDialects) {
          const versionPadded = schemaDialect.draftVersion.startsWith('draft-')
            ? schemaDialect.draftVersion
            : ` ${schemaDialect.draftVersion}`

          logInfo(
            `Total schemas using ${versionPadded}: ${schemaDialectCounts.get(schemaDialect.url)}`,
          )
        }
      },
    },
    {
      fullScanAllFiles: true,
      skipReadFile: false,
    },
  )
}

async function printUrlCountsInCatalog() {
  let countScanURLExternal = 0
  let countScanURLInternal = 0

  await forEachCatalogUrl((catalogUrl) => {
    catalogUrl.startsWith(UrlSchemaStore)
      ? countScanURLInternal++
      : countScanURLExternal++
  })

  const totalCount = countScanURLExternal + countScanURLInternal
  const percentExternal = Math.round((countScanURLExternal / totalCount) * 100)
  logInfo(
    `SchemaStore URLs: ${countScanURLInternal} (${100 - percentExternal}%)`,
  )
  logInfo(`External URLs: ${countScanURLExternal} (${percentExternal}%)`)
  logInfo(`Total URLs: ${totalCount}`)
}

async function printStrictAndNotStrictAjvValidatedSchemas() {
  const /** @type {string[]} */ schemasInFullStrictMode = []
  const /** @type {string[]} */ schemasInNotStrictMode = []

  await localSchemaFileAndTestFile({ schemaOnlyScan }, { skipReadFile: false })

  printSchemas('Strict Mode', schemasInFullStrictMode)
  printSchemas('Not Strict Mode', schemasInNotStrictMode)
  logInfo(`Strict Mode: ${schemasInFullStrictMode.length} total schemas`)
  logInfo(`Not Strict Mode: ${schemasInNotStrictMode.length} total schemas`)
  logInfo(
    `All modes: ${
      schemasInFullStrictMode.length + schemasInNotStrictMode.length
    } total schemas`,
  )

  async function schemaOnlyScan(/** @type {SchemaOld} */ schema) {
    const schemaDialect = getSchemaDialect(schema.json.$schema)
    const options = getSchemaOptions(schema.name)
    const ajv = await ajvFactory({
      draftVersion: schemaDialect.draftVersion,
      fullStrictMode: true,
      unknownFormats: options.unknownFormats,
      unknownKeywords: options.unknownKeywords,
      unknownSchemas: options.unknownSchemas,
    })

    try {
      ajv.compile(schema.json)
      schemasInFullStrictMode.push(schema.name)
    } catch {
      schemasInNotStrictMode.push(schema.name)
    }
  }

  function printSchemas(
    /** @type {string} */ mode,
    /** @type {string[]}*/ schemaNames,
  ) {
    console.log('------------------------------------')
    console.log(`Schemas in ${mode} strict mode:`)
    for (const schemaName of schemaNames) {
      // Write it is JSON list format for easy copy-paste to `schema-validation.jsonc`.
      console.log(`"${schemaName}",`)
    }
  }
}

async function printDowngradableSchemaVersions() {
  logInfo('Check if a schema can use a lower "$schema" version')

  await localSchemaFileAndTestFile({ schemaOnlyScan }, { skipReadFile: false })
  logInfo(`Done.`)

  /**
   * There are no positive or negative test processes here. Only the
   * schema files are
   */
  async function schemaOnlyScan(/** @type {SchemaOld} */ schema) {
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
      logInfo(
        `Schema "${schema.name}" (${original}) can likely be downgraded to "${recommended}"`,
      )
    }
  }
}

async function printSchemasTestedInFullStrictMode() {
  const totalSchemas = (await fs.readdir(SchemaDir)).length

  const countFullStrictSchema =
    totalSchemas - SchemaValidation.ajvNotStrictMode.length
  const percent = Math.round((countFullStrictSchema / totalSchemas) * 100)
  logInfo(
    `Out of ${totalSchemas} total schemas, ${countFullStrictSchema} (${percent}%) are validated with Ajv's strict mode`,
  )
}

function printSchemasWithoutPositiveTestFiles() {
  let countMissingTest = 0

  for (const schemaName of SchemasToBeTested) {
    if (!FoldersPositiveTest.includes(schemaName.replace('.json', ''))) {
      countMissingTest++
      logInfo(`No positive tests for: ${schemaName}`)
    }
  }

  if (countMissingTest > 0) {
    const percent = Math.round(
      (countMissingTest / SchemasToBeTested.length) * 100,
    )
    console.log()
    logInfo(
      `Out of ${SchemasToBeTested.length} total schemas, ${countMissingTest} (${percent}%) do not have tests.`,
    )
  } else {
    logInfo('All schemas have positive test')
  }
}

{
  const helpMenu = `USAGE:
  node ./cli.js <taskName|functionName>

TASKS:
  new-schema: Create a new JSON schema
  lint: Run less-important checks on schemas
  check: Run all build checks
  check-remote: Run all build checks for remote schemas
  coverage: Generate code coverage for a schema
  maintenance: Run maintenance checks

EXAMPLES:
  node ./cli.js check
  `

  if (!argv._[0]) {
    console.error(helpMenu)
    console.error(`${chalk.red('Error:')} No argument given`)
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
    'check-remote': taskCheckRemote,
    coverage: taskCoverage,
    maintenance: taskMaintenance,
    build: taskCheck, // Undocumented alias.
  }
  const taskOrFn = argv._[0]
  if (taskOrFn in taskMap) {
    await taskMap[taskOrFn]()
  } else {
    eval(`${taskOrFn}()`)
  }
}
