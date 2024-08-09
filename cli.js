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

const log = {
  ok(/** @type {string} */ msg) {
    console.log(chalk.green('>>') + ' ' + msg)
  },
  error(/** @type {string} */ msg) {
    console.error(chalk.red('>>') + ' ' + msg)
  },
}

/** @type {{ _: string[], help?: boolean, lint?: boolean, SchemaName?: string }} */
const argv = /** @type {any} */ (
  minimist(process.argv.slice(2), {
    boolean: [' help', 'lint'],
  })
)

/**
 * @param {(arg0: Schema) => void} schemaOnlyScan
 */
async function remoteSchemaFile(schemaOnlyScan, showLog = true) {
  for (const { url } of Catalog.schemas) {
    // Skip local schemas.
    if (url.startsWith(UrlSchemaStore)) {
      continue
    }

    try {
      const res = await fetch(url)
      const resText = await res.text()
      if (res.status >= 200 && res.status < 300) {
        const parsed = new URL(url)
        const schema = {
          jsonName: path.basename(parsed.pathname),
          jsonObj: JSON.parse(resText),
          rawFile: '',
          urlOrFilePath: url,
          schemaScan: true,
        }

        await schemaOnlyScan(schema)
        if (showLog) {
          log.ok(url)
        }
      } else {
        if (showLog) {
          log.error(`Failed to fetch url: ${url} (status: ${res.status}`)
        }
      }
    } catch (err) {
      if (showLog) {
        printErrorAndExit(err, [`Failed to fetch url: ${url}`])
      }
    }
  }
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
 * @typedef {Object} Schema
 * @property {Buffer | string} rawFile
 * @property {JsonSchema} jsonObj
 * @property {string} jsonName
 * @property {string} urlOrFilePath
 * @property {boolean} schemaScan
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
 * @param {unknown} error
 * @param {string[]} [messages]
 * @param {string} [extraText]
 * @returns {never}
 */
function printErrorAndExit(error, messages, extraText) {
  if (Array.isArray(messages) && messages.length > 0) {
    console.warn('---')
    for (const msg of messages) {
      log.error(msg)
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
 * @typedef {Object} localSchemaFileAndTestFileParameter1
 * @property {((arg0: Schema) => void | Promise<void>) | undefined} schemaOnlyScan
 * @property {(() => void) | undefined} schemaOnlyScanDone
 * @property {((arg0: Schema) => void) | undefined} schemaForTestScan
 * @property {() => void | undefined} schemaForTestScanDone
 * @property {((arg0: Schema) => void) | undefined} positiveTestScan
 * @property {((arg0: Schema) => void) | undefined} positiveTestScanDone
 * @property {((arg0: Schema) => void) | undefined} negativeTestScan
 * @property {((arg0: Schema) => void) | undefined} negativeTestScanDone
 *
 * @typedef {Object} localSchemaFileAndTestFileParameter2
 * @property {boolean} fullScanAllFiles
 * @property {boolean} skipReadFile
 * @property {boolean} ignoreSkiptest
 * @property {string | undefined} processOnlyThisOneSchemaFile
 *
 * @param {Partial<localSchemaFileAndTestFileParameter1>} arg0
 * @param {Partial<localSchemaFileAndTestFileParameter2>} arg1
 */
async function localSchemaFileAndTestFile(
  {
    schemaOnlyScan = undefined,
    schemaOnlyScanDone = undefined,
    schemaForTestScan = undefined,
    schemaForTestScanDone = undefined,
    positiveTestScan = undefined,
    positiveTestScanDone = undefined,
    negativeTestScan = undefined,
    negativeTestScanDone = undefined,
  },
  {
    fullScanAllFiles = false,
    skipReadFile = true,
    ignoreSkiptest = false,
    processOnlyThisOneSchemaFile = undefined,
  } = {},
) {
  const schemaNameArg = argv.SchemaName
  if (processOnlyThisOneSchemaFile === undefined && schemaNameArg) {
    processOnlyThisOneSchemaFile = schemaNameArg
    const file = path.join(SchemaDir, processOnlyThisOneSchemaFile)

    if (!(await exists(file))) {
      printErrorAndExit(new Error(), [
        `Schema file ${processOnlyThisOneSchemaFile} does not exist`,
      ])
    }
  }

  /**
   * @summary Check if the present json schema file must be tested or not
   * @param {string} jsonFilename
   * @returns {boolean}
   */
  const canThisTestBeRun = (jsonFilename) => {
    if (!ignoreSkiptest && SchemaValidation.skiptest.includes(jsonFilename)) {
      return false // This test can be never process
    }
    if (fullScanAllFiles) {
      return true // All tests are always performed.
    } else {
      return true
    }
  }

  /**
   * @summary Get all the schema files via callback
   * @param {(arg0: Schema) => (void | Promise<void>)} callback The callback function
   * @param {boolean} onlySchemaScan True is a scan without test files
   */
  const scanAllSchemaFiles = async (callback, onlySchemaScan) => {
    if (!callback) {
      return
    }

    for (const schemaFileName of SchemasToBeTested) {
      if (processOnlyThisOneSchemaFile) {
        if (schemaFileName !== processOnlyThisOneSchemaFile) {
          continue
        }
      }

      // Some schema files must be ignored.
      if (!canThisTestBeRun(schemaFileName)) {
        continue
      }

      const schemaFilepath = path.join(SchemaDir, schemaFileName)
      const buffer = skipReadFile
        ? undefined
        : await fs.readFile(schemaFilepath)
      const jsonObj = JSON.parse((buffer ?? '{}').toString())

      const schema = {
        rawFile: buffer ?? '', // rawFile for BOM test
        jsonObj,
        jsonName: schemaFileName,
        urlOrFilePath: schemaFilepath,
        schemaScan: onlySchemaScan,
      }
      await callback(schema)
    }
  }

  // Scan one test folder for all the files inside it
  const scanOneTestFolder = async (
    /** @type {string} */ schemaName,
    /** @type {string} */ testDir,
    testPassScan,
    testPassScanDone,
  ) => {
    const loadTestFile = (
      /** @type {string} */ testFileNameWithPath,
      /** @type {Buffer} */ buffer,
    ) => {
      // Test files have extension '.json' or else it must be a YAML file
      const fileExtension = testFileNameWithPath.split('.').pop()
      switch (fileExtension) {
        case 'json':
          try {
            return JSON.parse(buffer.toString())
          } catch (err) {
            printErrorAndExit(err, [
              `JSON file ${testFileNameWithPath} did not parse correctly.`,
            ])
          }
          break
        case 'yaml':
        case 'yml':
          try {
            return YAML.parse(buffer.toString())
          } catch (err) {
            printErrorAndExit(err, [
              `Can't read/decode yaml file: ${testFileNameWithPath}`,
            ])
          }
          break
        case 'toml':
          try {
            // { bigint: false } or else toml variable like 'a = 3' will return as 'a = 3n'
            // This creates an error because the schema expect an integer 3 and not 3n
            return TOML.parse(buffer.toString(), {
              bigint: false,
              joiner: '\n',
            })
          } catch (err) {
            printErrorAndExit(err, [
              `Can't read/decode toml file: ${testFileNameWithPath}`,
            ])
          }
          break
        default:
          printErrorAndExit(new Error(), [
            `Unknown file extension: ${fileExtension}`,
          ])
      }
    }

    if (!testPassScan) {
      return
    }
    // remove filename '.json' extension and to create the folder name
    const folderNameAndPath = path.join(
      testDir,
      path.basename(schemaName, '.json'),
    )
    // if test folder doesn't exist then exit. Some schemas do not have a test folder.
    if (!(await exists(folderNameAndPath))) {
      return
    }

    // Read all files name inside one test folder
    const filesInsideOneTestFolder = filterIgnoredFiles(
      await fs.readdir(folderNameAndPath),
    ).map(
      // Must create a list with full path name
      (fileName) => path.join(folderNameAndPath, fileName),
    )

    if (!filesInsideOneTestFolder.length) {
      printErrorAndExit(new Error(), [
        `Found folder with no test files: ${folderNameAndPath}`,
      ])
    }

    for (const testFileFullPathName of filesInsideOneTestFolder) {
      // forbidden to add extra folder inside the specific test folder
      if (!(await fs.lstat(testFileFullPathName)).isFile()) {
        printErrorAndExit(new Error(), [
          `Found non test file inside test folder: ${testFileFullPathName}`,
        ])
      }

      const buffer = skipReadFile
        ? undefined
        : await fs.readFile(testFileFullPathName)
      const schema = {
        rawFile: buffer,
        jsonObj: buffer && loadTestFile(testFileFullPathName, buffer),
        jsonName: path.basename(testFileFullPathName),
        urlOrFilePath: testFileFullPathName,
        // This is a test folder scan process, not schema scan process
        schemaScan: false,
      }
      testPassScan(schema)
    }
    testPassScanDone?.()
  }

  // Callback only for schema file scan. No test files are process here.
  await scanAllSchemaFiles(schemaOnlyScan, true)
  schemaOnlyScanDone?.()

  // process one by one all schema + positive test folders + negative test folders
  await scanAllSchemaFiles(async (schema) => {
    // process one schema
    await schemaForTestScan?.(schema)
    // process positive and negative test folder belonging to the one schema
    const schemaName = schema.jsonName
    await scanOneTestFolder(
      schemaName,
      TestPositiveDir,
      positiveTestScan,
      positiveTestScanDone,
    )
    await scanOneTestFolder(
      schemaName,
      TestNegativeDir,
      negativeTestScan,
      negativeTestScanDone,
    )
  }, false)

  await schemaForTestScanDone?.()
}

function testSchemaFileForBOM(/** @type {Schema} */ schema) {
  const buffer = schema.rawFile
  const bomTypes = [
    { name: 'UTF-8', signature: [0xef, 0xbb, 0xbf] },
    { name: 'UTF-16 (BE)', signature: [0xfe, 0xff] },
    { name: 'UTF-16 (LE)', signature: [0xff, 0xfe] },
    { name: 'UTF-32 (BE)', signature: [0x00, 0x00, 0xff, 0xfe] },
    { name: 'UTF-32 (LE)', signature: [0xff, 0xfe, 0x00, 0x00] },
  ]

  for (const bom of bomTypes) {
    if (buffer.length >= bom.signature.length) {
      const bomFound = bom.signature.every(
        (value, index) => buffer[index] === value,
      )
      if (bomFound) {
        printErrorAndExit(new Error(), [
          `Schema file must not have ${bom.name} BOM: ${schema.urlOrFilePath}`,
        ])
      }
    }
  }
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

  const schemaForTestScan = async (/** @type {Schema} */ schema) => {
    const fullStrictMode = !SchemaValidation.ajvNotStrictMode.includes(
      schema.jsonName,
    )

    const schemaDialect = getSchemaDialect(schema.jsonObj.$schema)
    const options = getSchemaOptions(schema.jsonName)
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
      validateFn = ajv.compile(schema.jsonObj)
    } catch (err) {
      printErrorAndExit(err, [
        `${textCompile}${schema.urlOrFilePath} (${schemaVersionStr})${fullStrictModeStr}`,
      ])
    }

    totalSchemas++
    console.log()
    log.ok(
      `${textPassSchema}${schema.urlOrFilePath} (${schemaVersionStr})${fullStrictModeStr}`,
    )
  }

  const processTestFile = (
    /** @type {Schema} */ schema,
    /** @type {() => void} */ success,
    /** @type {() => void} */ failure,
  ) => {
    validateFn(schema.jsonObj) ? success() : failure()
  }

  const positiveTestScan = (/** @type {Schema} */ schema) => {
    processTestFile(
      schema,
      () => {
        log.ok(`${textPositivePassTest}${schema.urlOrFilePath}`)
      },
      () => {
        printErrorAndExit(
          new Error(),
          [
            `${textPositiveFailedTest} for schema file "${schema.urlOrFilePath}"`,
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

  const negativeTestScan = (/** @type {Schema} */ schema) => {
    processTestFile(
      schema,
      () => {
        printErrorAndExit(new Error(), [
          `${textNegativeFailedTest}${schema.urlOrFilePath}`,
          'Negative test must always fail.',
        ])
      },
      () => {
        // must show log as single line
        // const path = validate.errors[0].instancePath
        let text = ''
        text = text.concat(`${textNegativePassTest}${schema.urlOrFilePath}`)
        text = text.concat(` (Schema: ${validateFn.errors[0].schemaPath})`)
        text = text.concat(` (Test: ${validateFn.errors[0].instancePath})`)
        text = text.concat(` (Message): ${validateFn.errors[0].message})`)
        log.ok(text)
      },
    )
  }

  const schemaForTestScanDone = () => {
    console.log()
    log.ok(`Total schemas validated with Ajv: ${totalSchemas}`)
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
  await lintSchemaHasCorrectMetadata()
  await lintTopLevelRefIsStandalone()
  await lintSchemaNoSmartQuotes()
}

async function taskCheck() {
  // Check file system.
  await Promise.all([
    assertFsDirectoryStructureIsValid(),
    assertFsFilenamesHaveCorrectExtensions(),
  ])
  assertFsTestFoldersHaveAtLeastOneTestSchema()

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

  // Check schemas.
  // { fullScanAllFiles: true, skipReadFile: false } schemaOnlyScan
  await assertSchemaHasNoBom()
  await assertSchemaHasValidSchemaField()
  await assertSchemaHasValidIdField()
  await assertSchemaPassesSchemaSafeLint()

  await assertSchemaHasNoDuplicatedPropertyKeys() // { skipReadFile: false }

  await printSchemasTestedInFullStrictMode() // {}
  printSchemasWithoutPositiveTestFiles()
  await testAjv() // { skipReadFile: false }
  await printUrlCountsInCatalog()
  await printCountSchemaVersions()
}

async function taskCheckRemote() {
  await remoteAssertSchemaHasNoBom()
  await remoteTestAjv()
  await remotePrintCountSchemaVersions()
}

async function taskMaintenance() {
  console.log()
  await printDowngradableSchemaVersions()
  console.log()
  await printStrictAndNotStrictAjvValidatedSchemas()
}

async function taskCoverage() {
  const javaScriptCoverageName = 'schema.json.translated.to.js'
  const javaScriptCoverageNameWithPath = path.join(
    `${TempCoverageDir}/${javaScriptCoverageName}`,
  )

  /**
   * Translate one JSON schema file to javascript via Ajv validator.
   * And run the positive and negative test files with it.
   * @param {string} processOnlyThisOneSchemaFile The schema file that need to process
   */
  const generateCoverage = async (processOnlyThisOneSchemaFile) => {
    let jsonName
    let mainSchema
    let /** @type {string | undefined} */ mainSchemaJsonId
    let /** @type {boolean} */ isThisWithExternalSchema
    let validations

    // Compile JSON schema to javascript and write it to disk.
    const processSchemaFile = async (/** @type {Schema} */ schema) => {
      jsonName = schema.jsonName
      // Get possible options define in schema-validation.jsonc
      const { unknownFormats, unknownKeywords, unknownSchemas } =
        getSchemaOptions(schema.jsonName)

      // select the correct Ajv object for this schema
      mainSchema = schema.jsonObj
      const schemaDialect = getSchemaDialect(mainSchema.$schema)

      // External schema present to be included?
      const multipleSchema = []
      isThisWithExternalSchema = unknownSchemas.length > 0
      if (isThisWithExternalSchema) {
        // There is an external schema that need to be included.
        for (const unknownSchema of unknownSchemas) {
          multipleSchema.push(await readJsonFile(unknownSchema.toString()))
        }

        // Also add the 'root' schema
        multipleSchema.push(mainSchema)
      }

      // Get the correct Ajv version
      const ajv = await ajvFactory({
        draftVersion: schemaDialect.draftVersion,
        fullStrictMode: !SchemaValidation.ajvNotStrictMode.includes(jsonName),
        unknownFormats,
        unknownKeywords,
        options: {
          code: {
            source: true,
            esm: true,
          },
          schemas: multipleSchema,
        },
      })

      let moduleCode
      if (isThisWithExternalSchema) {
        // Multiple schemas are combine to one JavaScript file.
        // Must use the root $id/id to call the correct 'main' schema in JavaScript code
        mainSchemaJsonId =
          getSchemaDialect(mainSchema.$schema).draftVersion === 'draft-04'
            ? mainSchema.id
            : mainSchema.$id
        if (!mainSchemaJsonId) {
          printErrorAndExit(new Error(), [`Missing $id or id in ${jsonName}`])
        }
        moduleCode = AjvStandalone(ajv)
      } else {
        // Single schema
        mainSchemaJsonId = undefined
        moduleCode = AjvStandalone(ajv, ajv.compile(mainSchema))
      }

      // Prettify the JavaScript module code
      const prettierOptions = await prettier.resolveConfig(process.cwd())
      await fs.writeFile(
        javaScriptCoverageNameWithPath,
        await prettier.format(moduleCode, {
          ...prettierOptions,
          parser: 'babel',
          printWidth: 200,
        }),
      )
      // Now use this JavaScript as validation in the positive and negative test
      validations = await readJsonFile(javaScriptCoverageNameWithPath)
    }

    // Load the Javascript file from the disk and run it with the JSON test file.
    // This will generate the NodeJS coverage data in the background.
    const processTestFile = (/** @type {Schema} */ schema) => {
      // Test only for the code coverage. Not for the validity of the test.
      if (isThisWithExternalSchema) {
        // Must use the root $id/id to call the correct schema JavaScript code
        const validateRootSchema = validations[mainSchemaJsonId]
        validateRootSchema?.(schema.jsonObj)
      } else {
        // Single schema does not need $id
        validations(schema.jsonObj)
      }
    }

    await localSchemaFileAndTestFile(
      {
        schemaForTestScan: processSchemaFile,
        positiveTestScan: processTestFile,
        negativeTestScan: processTestFile,
      },
      { skipReadFile: false, processOnlyThisOneSchemaFile },
    )
  }

  const schemaNameArg = argv.SchemaName
  if (!schemaNameArg) {
    printErrorAndExit(new Error(), [
      'Must start "make" file with --SchemaName parameter.',
    ])
  }
  await generateCoverage(schemaNameArg)
  log.ok('OK')
}

async function lintSchemaHasCorrectMetadata() {
  let countScan = 0
  let totalMismatchIds = 0
  let totalIncorrectIds = 0
  await localSchemaFileAndTestFile(
    {
      schemaOnlyScan(schema) {
        countScan++

        /**
         * Old JSON Schema specification versions use the "id" key for unique
         * identifiers, rather than "$id". See for details:
         * https://json-schema.org/understanding-json-schema/basics.html#declaring-a-unique-identifier
         */
        const schemasWithDollarlessId = [
          'http://json-schema.org/draft-03/schema#',
          'http://json-schema.org/draft-04/schema#',
        ]

        if (schemasWithDollarlessId.includes(schema.jsonObj.$schema)) {
          if (schema.jsonObj.$id) {
            log.error(
              `Bad property of '$id'; expected 'id' for this schema version`,
            )
            ++totalMismatchIds
            return
          }

          if (
            schema.jsonObj.id !==
            `https://json.schemastore.org/${schema.jsonName}`
          ) {
            log.error(
              `Incorrect property 'id' for schema 'src/schemas/json/${schema.jsonName}'`,
            )
            console.warn(
              `     expected value: https://json.schemastore.org/${schema.jsonName}`,
            )
            console.warn(`     found value   : ${schema.jsonObj.id}`)
            ++totalIncorrectIds
          }
        } else {
          if (schema.jsonObj.id) {
            log.error(
              `Bad property of 'id'; expected '$id' for this schema version`,
            )
            ++totalMismatchIds
            return
          }

          if (
            schema.jsonObj.$id !==
            `https://json.schemastore.org/${schema.jsonName}`
          ) {
            log.error(
              `Incorrect property '$id' for schema 'src/schemas/json/${schema.jsonName}'`,
            )
            console.warn(
              `     expected value: https://json.schemastore.org/${schema.jsonName}`,
            )
            console.warn(`     found value   : ${schema.jsonObj.$id}`)
            ++totalIncorrectIds
          }
        }
      },
    },
    {
      fullScanAllFiles: true,
      skipReadFile: false,
    },
  )
  log.ok(`Total mismatched ids: ${totalMismatchIds}`)
  log.ok(`Total incorrect ids: ${totalIncorrectIds}`)
  log.ok(`Total files scan: ${countScan}`)
}

async function lintSchemaNoSmartQuotes() {
  let countScan = 0

  await localSchemaFileAndTestFile(
    {
      schemaOnlyScan(schema) {
        countScan++
        const buffer = schema.rawFile
        const bufferArr = buffer.toString().split('\n')

        for (let i = 0; i < bufferArr.length; ++i) {
          const line = bufferArr[i]

          const smartQuotes = ['‘', '’', '“', '”']
          for (const quote of smartQuotes) {
            if (line.includes(quote)) {
              log.error(
                `Schema file should not have a smart quote: ${
                  schema.urlOrFilePath
                }:${++i}`,
              )
            }
          }
        }
      },
    },
    { fullScanAllFiles: true, skipReadFile: false },
  )

  console.log(`Total files scan: ${countScan}`)
}

async function lintTopLevelRefIsStandalone() {
  let countScan = 0
  await localSchemaFileAndTestFile(
    {
      schemaOnlyScan(schema) {
        if (schema.jsonObj.$ref?.startsWith('http')) {
          for (const [member] of Object.entries(schema.jsonObj)) {
            if (member !== '$ref') {
              printErrorAndExit(new Error(), [
                `Schemas that reference a remote schema must only have $ref as a property. Found property "${member}" for ${schema.jsonName}`,
              ])
            }
          }
        }

        ++countScan
      },
    },
    { skipReadFile: false, ignoreSkiptest: true },
  )

  log.ok(`All urls tested OK. Total: ${countScan}`)
}

async function testAjv() {
  const x = await ajv()
  await localSchemaFileAndTestFile(
    {
      schemaForTestScan: x.schemaForTestScan,
      schemaForTestScanDone: x.schemaForTestScanDone,
      positiveTestScan: x.positiveTestScan,
      negativeTestScan: x.negativeTestScan,
    },
    { skipReadFile: false },
  )

  log.ok('All specified schemas passed')
}

async function remoteTestAjv() {
  const x = await ajv()
  let countScan = 0
  await remoteSchemaFile((testSchemaFile) => {
    x.schemaForTestScan(testSchemaFile)
    countScan++
  })

  log.ok(`Total schemas validated with Ajv: ${countScan}`)
}

async function remoteAssertSchemaHasNoBom() {
  await remoteSchemaFile(testSchemaFileForBOM, false)
}

async function remotePrintCountSchemaVersions() {
  console.info('TODO')
  // const x = showSchemaVersions()
  // await remoteSchemaFile((schema) => {
  //   x.process_data(schema)
  // }, false)
  // x.process_data_done()
}

function assertFsTestFoldersHaveAtLeastOneTestSchema() {
  const check = (/** @type {string[]} */ folderList) => {
    for (const folderName of folderList) {
      if (!SchemasToBeTested.includes(folderName + '.json')) {
        printErrorAndExit(new Error(), [
          `No schema ${folderName}.json found for test folder => ${folderName}`,
        ])
      }
    }
  }

  check(FoldersPositiveTest)
  check(FoldersNegativeTest)

  log.ok(`directories: test directories have at least one test schema`)
}

async function assertFsFilenamesHaveCorrectExtensions() {
  const schemaFileExtensions = ['.json']
  const testFileExtensions = ['.json', '.yml', '.yaml', '.toml']

  const check = (
    /** @type {Schema} */ schema,
    /** @type {string[]} */ extensions,
  ) => {
    const found = extensions.find((x) => schema.jsonName.endsWith(x))
    if (!found) {
      printErrorAndExit(new Error(), [
        `Filename must have ${extensions} extension => ${schema.urlOrFilePath}`,
      ])
    }
  }

  await localSchemaFileAndTestFile(
    {
      schemaForTestScan: (schema) => check(schema, schemaFileExtensions),
      positiveTestScan: (schema) => check(schema, testFileExtensions),
      negativeTestScan: (schema) => check(schema, testFileExtensions),
    },
    {
      fullScanAllFiles: true,
    },
  )

  log.ok(
    `directories: All schema and test filename have the correct file extension`,
  )
}

async function assertFsDirectoryStructureIsValid() {
  for (const schemaName of SchemasToBeTested) {
    if (!(await fs.lstat(path.join(SchemaDir, schemaName))).isFile()) {
      printErrorAndExit(new Error(), [
        `There can only be files in directory : ${SchemaDir} => ${schemaName}`,
      ])
    }
  }

  for (const dirname of FoldersPositiveTest) {
    if (!(await fs.lstat(path.join(TestPositiveDir, dirname))).isDirectory()) {
      printErrorAndExit(new Error(), [
        `There can only be directory's in :${TestPositiveDir} => ${dirname}`,
      ])
    }
  }

  for (const dirname of FoldersNegativeTest) {
    if (!(await fs.lstat(path.join(TestNegativeDir, dirname))).isDirectory()) {
      printErrorAndExit(new Error(), [
        `There can only be directory's in :${TestNegativeDir} => ${dirname}`,
      ])
    }
  }

  log.ok('directories: directory structure is valid')
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
    log.ok('catalog.json: Parses with jsonlint')
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
    log.ok('catalog.json: Validates against schema')
  } else {
    printErrorAndExit(
      new Error(),
      [
        `Failed to validate file "${CatalogFile}" against schema file "./${catalogSchemaFile}"`,
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

  log.ok(`catalog.json: Has no fields that break guidelines`)
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

  log.ok('catalog.json: No duplicate "fileMatch" values found')
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

  log.ok(`catalog.json: All local entries point to a schema file that exists`)
}

async function assertCatalogJsonIncludesAllSchemas() {
  const /** @type {string[]} */ allCatalogLocalJsonFiles = []

  await forEachCatalogUrl((/** @type {string} */ catalogUrl) => {
    if (catalogUrl.startsWith(UrlSchemaStore)) {
      const filename = new URL(catalogUrl).pathname.slice(1)
      allCatalogLocalJsonFiles.push(filename)
    }
  })

  await localSchemaFileAndTestFile(
    {
      schemaOnlyScan(schema) {
        // Skip testing if schema is specified in "missingCatalogUrl".
        if (SchemaValidation.missingCatalogUrl.includes(schema.jsonName)) {
          return
        }

        if (!allCatalogLocalJsonFiles.includes(schema.jsonName)) {
          printErrorAndExit(new Error(), [
            `Expected schema file "${schema.jsonName}" to have a corresponding entry in the catalog file "${CatalogFile}"`,
            `If this is intentional, ignore this error by appending to the property "missingCatalogUrl" in file "${SchemaValidationFile}"`,
          ])
        }
      },
    },
    { fullScanAllFiles: true },
  )

  log.ok(`catalog.json: All local entries exist in file total`)
}

async function assertSchemaValidationJsonValidatesAgainstJsonSchema() {
  const schemaValidationSchemaFile = './src/schema-validation.schema.json'
  const schemaValidationSchema = await readJsonFile(schemaValidationSchemaFile)

  const ajv = new AjvDraft06And07({
    strict: true,
  })
  addFormats(ajv)

  if (ajv.validate(schemaValidationSchema, SchemaValidation)) {
    log.ok('schema-validation.jsonc: Validates against schema')
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

  log.ok('schema-validation.jsonc: References no non-existent files')
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

  log.ok(`schema-validation.jsonc: Has no unmatched URLs`)
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

  log.ok(
    `schema-validation.jsonc: Entries under skiptest[] are not used elsewhere`,
  )
}

async function assertSchemaHasNoBom() {
  let countScan = 0

  await localSchemaFileAndTestFile(
    {
      schemaOnlyScan(schema) {
        countScan++
        testSchemaFileForBOM(schema)
      },
    },
    { fullScanAllFiles: true, skipReadFile: false },
  )

  log.ok(
    `no BOM file found in all schema files. Total files scan: ${countScan}`,
  )
}

async function assertSchemaHasNoDuplicatedPropertyKeys() {
  let countScan = 0
  const findDuplicatedProperty = (/** @type {Schema} */ schema) => {
    ++countScan

    // Can only test JSON files for duplicates.
    const fileExtension = schema.urlOrFilePath.split('.').pop()
    if (fileExtension !== 'json') return

    // TODO: Workaround for https://github.com/prantlf/jsonlint/issues/23
    if (schema.jsonName === 'tslint.json') {
      return
    }

    try {
      jsonlint.parse(
        Buffer.isBuffer(schema.rawFile)
          ? schema.rawFile.toString()
          : schema.rawFile,
        {
          ignoreBOM: false,
          ignoreComments: false,
          ignoreTrailingCommas: false,
          allowSingleQuotedStrings: false,
          allowDuplicateObjectKeys: false,
        },
      )
    } catch (err) {
      printErrorAndExit(err, [
        `Failed to parse file with jsonlint: ${schema.urlOrFilePath}`,
      ])
    }
  }
  await localSchemaFileAndTestFile(
    {
      schemaForTestScan: findDuplicatedProperty,
      positiveTestScan: findDuplicatedProperty,
      negativeTestScan: findDuplicatedProperty,
    },
    { skipReadFile: false },
  )
  log.ok(
    `No duplicated property key found in JSON files. Total files scan: ${countScan}`,
  )
}

async function assertSchemaHasValidSchemaField() {
  let countScan = 0

  await localSchemaFileAndTestFile(
    {
      schemaOnlyScan(schema) {
        countScan++

        const schemaDialectUrls = SchemaDialects.map(
          (schemaDialect) => schemaDialect.url,
        )
        if (!schemaDialectUrls.includes(schema.jsonObj.$schema)) {
          printErrorAndExit(new Error(), [
            `Schema file has invalid or missing '$schema' keyword => ${schema.jsonName}`,
            `Valid schemas: ${JSON.stringify(schemaDialectUrls)}`,
          ])
        }

        if (!SchemaValidation.highSchemaVersion.includes(schema.jsonName)) {
          const tooHighSchemas = SchemaDialects.filter(
            (schemaDialect) => schemaDialect.isTooHigh,
          ).map((schemaDialect) => schemaDialect.url)
          if (tooHighSchemas.includes(schema.jsonObj.$schema)) {
            printErrorAndExit(new Error(), [
              `Schema version is too high => in file ${schema.jsonName}`,
              `Schema version '${schema.jsonObj.$schema}' is not supported by many editors and IDEs`,
              `${schema.jsonName} must use a lower schema version.`,
            ])
          }
        }
      },
    },
    {
      fullScanAllFiles: true,
      skipReadFile: false,
    },
  )

  log.ok(`Total files scan: ${countScan}`)
}

async function assertSchemaHasValidIdField() {
  let countScan = 0

  await localSchemaFileAndTestFile(
    {
      schemaOnlyScan(schema) {
        countScan++

        let schemaId = ''
        const schemasWithDollarlessId = [
          'http://json-schema.org/draft-03/schema#',
          'http://json-schema.org/draft-04/schema#',
        ]
        if (schemasWithDollarlessId.includes(schema.jsonObj.$schema)) {
          if (schema.jsonObj.id === undefined) {
            printErrorAndExit(new Error(), [
              `Missing property 'id' for schema 'src/schemas/json/${schema.jsonName}'`,
            ])
          }
          schemaId = schema.jsonObj.id
        } else {
          if (schema.jsonObj.$id === undefined) {
            printErrorAndExit(new Error(), [
              `Missing property '$id' for schema 'src/schemas/json/${schema.jsonName}'`,
            ])
          }
          schemaId = schema.jsonObj.$id
        }

        if (
          !schemaId.startsWith('https://') &&
          !schemaId.startsWith('http://')
        ) {
          printErrorAndExit(new Error(), [
            schemaId,
            `Schema id/$id must begin with 'https://' or 'http://' for schema 'src/schemas/json/${schema.jsonName}'`,
          ])
        }
      },
    },
    {
      fullScanAllFiles: true,
      skipReadFile: false,
    },
  )

  log.ok(`Total files scan: ${countScan}`)
}

async function assertSchemaPassesSchemaSafeLint() {
  if (!argv.lint) {
    return
  }
  let countScan = 0
  await localSchemaFileAndTestFile(
    {
      schemaOnlyScan(schema) {
        countScan++

        const errors = schemasafe.lint(schema.jsonObj, {
          mode: 'strong',
        })
        for (const err of errors) {
          console.log(`${schema.jsonName}: ${err.message}`)
        }
      },
    },
    {
      fullScanAllFiles: true,
      skipReadFile: false,
    },
  )
  log.ok(`Total files scan: ${countScan}`)
}

async function printCountSchemaVersions() {
  /** @type {Map<string, number>} */
  const schemaDialectCounts = new Map(
    SchemaDialects.map((schemaDialect) => [schemaDialect.url, 0]),
  )

  await localSchemaFileAndTestFile(
    {
      schemaOnlyScan(/** @type {Schema} */ schema) {
        let schemaDialect = getSchemaDialect(schema.jsonObj.$schema)
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

          log.ok(
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
  log.ok(
    `SchemaStore URLs: ${countScanURLInternal} (${100 - percentExternal}%)`,
  )
  log.ok(`External URLs: ${countScanURLExternal} (${percentExternal}%)`)
  log.ok(`Total URLs: ${totalCount}`)
}

async function printStrictAndNotStrictAjvValidatedSchemas() {
  const /** @type {string[]} */ schemasInFullStrictMode = []
  const /** @type {string[]} */ schemasInNotStrictMode = []

  await localSchemaFileAndTestFile({ schemaOnlyScan }, { skipReadFile: false })

  printSchemas('Strict Mode', schemasInFullStrictMode)
  printSchemas('Not Strict Mode', schemasInNotStrictMode)
  log.ok(`Strict Mode: ${schemasInFullStrictMode.length} total schemas`)
  log.ok(`Not Strict Mode: ${schemasInNotStrictMode.length} total schemas`)
  log.ok(
    `All modes: ${
      schemasInFullStrictMode.length + schemasInNotStrictMode.length
    } total schemas`,
  )

  async function schemaOnlyScan(/** @type {Schema} */ schema) {
    const schemaDialect = getSchemaDialect(schema.jsonObj.$schema)
    const options = getSchemaOptions(schema.jsonName)
    const ajv = await ajvFactory({
      draftVersion: schemaDialect.draftVersion,
      fullStrictMode: true,
      unknownFormats: options.unknownFormats,
      unknownKeywords: options.unknownKeywords,
      unknownSchemas: options.unknownSchemas,
    })

    try {
      ajv.compile(schema.jsonObj)
      schemasInFullStrictMode.push(schema.jsonName)
    } catch {
      schemasInNotStrictMode.push(schema.jsonName)
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
  log.ok('Check if a schema can use a lower "$schema" version')

  await localSchemaFileAndTestFile({ schemaOnlyScan }, { skipReadFile: false })
  log.ok(`Done.`)

  /**
   * There are no positive or negative test processes here. Only the
   * schema files are
   */
  async function schemaOnlyScan(/** @type {Schema} */ schema) {
    const schemaDialectVersionIndex = SchemaDialects.findIndex(
      (schemaDialect) => {
        return schema.jsonObj.$schema === schemaDialect.url
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

      const options = getSchemaOptions(schema.jsonName)
      const ajv = await ajvFactory({
        draftVersion: schemaDialectToBeTested.draftVersion,
        fullStrictMode: false,
        unknownFormats: options.unknownFormats,
        unknownKeywords: options.unknownKeywords,
        unknownSchemas: options.unknownSchemas,
      })

      schema.jsonObj.$schema = schemaDialectToBeTested.url
      try {
        ajv.compile(schema.jsonObj)
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
      log.ok(
        `Schema "${schema.jsonName}" (${original}) can likely be downgraded to "${recommended}"`,
      )
    }
  }
}

async function printSchemasTestedInFullStrictMode() {
  let countSchemaScanViaAjv = 0

  await localSchemaFileAndTestFile({
    schemaOnlyScan() {
      countSchemaScanViaAjv++
    },
  })

  // If only one Ajv schema test is run, then this calculation does not work.
  if (countSchemaScanViaAjv === 1) {
    return
  }

  const countFullStrictSchema =
    countSchemaScanViaAjv - SchemaValidation.ajvNotStrictMode.length
  const percent = Math.round(
    (countFullStrictSchema / countSchemaScanViaAjv) * 100,
  )
  log.ok(
    `Out of ${countSchemaScanViaAjv} total schemas, ${countFullStrictSchema} (${percent}%) are validated with Ajv's strict mode`,
  )
}

function printSchemasWithoutPositiveTestFiles() {
  let countMissingTest = 0

  for (const schemaName of SchemasToBeTested) {
    if (!FoldersPositiveTest.includes(schemaName.replace('.json', ''))) {
      countMissingTest++
      log.ok(`No positive tests for: ${schemaName}`)
    }
  }

  if (countMissingTest > 0) {
    const percent = Math.round(
      (countMissingTest / SchemasToBeTested.length) * 100,
    )
    console.log()
    log.ok(
      `Out of ${SchemasToBeTested.length} total schemas, ${countMissingTest} (${percent}%) do not have tests.`,
    )
  } else {
    log.ok('All schemas have positive test')
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
