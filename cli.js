/// <binding AfterBuild='build' />
// @ts-check
import path from 'node:path'
import fs from 'node:fs/promises'
import readline from 'node:readline'
import util from 'node:util'

import addFormats from 'ajv-formats'
import ajvFormatsDraft2019 from 'ajv-formats-draft2019'
import AjvDraft04 from 'ajv-draft-04'
import AjvDraft06And07 from 'ajv'
import Ajv2019 from 'ajv/dist/2019.js'
import Ajv2020 from 'ajv/dist/2020.js'
import AjvStandalone from 'ajv/dist/standalone/index.js'
import TOML from '@ltd/j-toml'
import YAML from 'yaml'
import schemasafe from '@exodus/schemasafe'
import prettier from 'prettier'
import fetch from 'node-fetch'
import jsonlint from '@prantlf/jsonlint'
import * as jsoncParser from 'jsonc-parser'
import chalk from 'chalk'
import minimist from 'minimist'

const AjvDraft06SchemaJson = readJsonFile(
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
const [SchemasToBeTested, FoldersPositiveTest, FoldersNegativeTest] =
  await Promise.all([
    fs.readdir(SchemaDir),
    fs.readdir(TestPositiveDir),
    fs.readdir(TestNegativeDir),
  ])

// prettier-ignore
const SCHEMA_DIALECTS = [
  { schemaName: '2020-12', url: 'https://json-schema.org/draft/2020-12/schema', isActive: true, isTooHigh: true },
  { schemaName: '2019-09', url: 'https://json-schema.org/draft/2019-09/schema', isActive: true, isTooHigh: true },
  { schemaName: 'draft-07', url: 'http://json-schema.org/draft-07/schema#', isActive: true, isTooHigh: false },
  { schemaName: 'draft-06', url: 'http://json-schema.org/draft-06/schema#', isActive: false, isTooHigh: false },
  { schemaName: 'draft-04', url: 'http://json-schema.org/draft-04/schema#', isActive: false, isTooHigh: false },
  { schemaName: 'draft-03', url: 'http://json-schema.org/draft-03/schema#', isActive: false, isTooHigh: false },
]

const log = {
  ok(/** @type {string | undefined} */ msg = 'OK') {
    console.log(chalk.green('>>') + ' ' + msg)
  },
  error(
    /** @type {string | undefined} */ msg = 'ERROR',
    /** @type {Error | undefined} */ error,
  ) {
    console.error(chalk.red('>>') + ' ' + msg)
    if (error) {
      console.error(error)
    }
  },
}

const argv = minimist(process.argv.slice(2), {
  boolean: ['help', 'lint'],
})

/**
 * @param {CbParamFn} schemaOnlyScan
 */
async function remoteSchemaFile(schemaOnlyScan, showLog = true) {
  for (const { url } of Catalog.schemas) {
    if (url.startsWith(UrlSchemaStore)) {
      // Skip local schemas
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
    } catch (error) {
      if (showLog) {
        console.log('')
        log.error(`Failed to fetch url: ${url}`, error)
        console.log('')
      }
    }
  }
}

/**
 * @typedef {Object} JsonSchemaAny
 * @property {string} $schema
 * @property {string | undefined} $ref
 */
/**
 * @typedef {Object} JsonSchemaDraft04
 * @property {undefined} $id
 * @property {string} id
 */

/**
 * @typedef {Object} JsonSchemaDraft07
 * @property {string} $id
 * @property {undefined} id
 */

/**
 * @typedef {JsonSchemaAny & (JsonSchemaDraft04 | JsonSchemaDraft07)} JsonSchema
 */

/**
 * @typedef {Object} SchemaValidationJsonOption
 * @property {string[]} unknownFormat
 * @property {string[]} unknownKeywords
 * @property {string[]} externalSchema
 */

/**
 * @typedef {Object} CatalogJsonEntry
 * @property {string} name
 * @property {string} description
 * @property {string[]} fileMatch
 * @property {string} url
 */

/**
 * @typedef {Object} CatalogJson
 * @property {CatalogJsonEntry[]} schemas
 */

/**
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

function skipThisFileName(/** @type {string} */ name) {
  // This macOS file must always be ignored.
  return name === '.DS_Store'
}

function getUrlFromCatalog(catalogUrl) {
  for (const catalogEntry of Catalog.schemas) {
    catalogUrl(catalogEntry.url)
    const versions = catalogEntry.versions
    if (versions) {
      Object.values(versions).forEach((url) => catalogUrl(url))
    }
  }
}

/**
 * @summary Calling this will terminate the process and show the text
 * of each error message, in addition to npm's error message.
 * @param {string[]} errorMessages
 * @param {string=} errorString
 * @returns {never}
 */
function printErrorMessagesAndExit(errorMessages, errorString) {
  if (errorMessages.length > 0) {
    console.warn('---')
    log.error('Error Message:')
    for (const text of errorMessages) {
      log.error(text)
    }
  }

  if (errorString) {
    process.stderr.write(errorString)
    process.stderr.write('\n')
  }

  console.warn('---')
  const err = new Error()
  err.name = 'Trace:'
  process.stderr.write((err.stack ?? '').toString())
  process.stderr.write('\n')
  process.exit(1)
}

/**
 * @callback CbParamFn
 * @param {Schema} schema
 * @returns {void}
 */

/**
 * @typedef {Object} localSchemaFileAndTestFileParameter1
 * @property {CbParamFn | undefined} schemaOnlyScan
 * @property {CbParamFn | undefined} schemaOnlyScanDone
 * @property {CbParamFn | undefined} schemaForTestScan
 * @property {CbParamFn | undefined} schemaForTestScanDone
 * @property {CbParamFn | undefined} positiveTestScan
 * @property {CbParamFn | undefined} positiveTestScanDone
 * @property {CbParamFn | undefined} negativeTestScan
 * @property {CbParamFn | undefined} negativeTestScanDone
 */

/**
 * @typedef {Object} localSchemaFileAndTestFileParameter2
 * @property {boolean} fullScanAllFiles
 * @property {boolean} skipReadFile
 * @property {boolean} ignoreSkiptest
 * @property {string | undefined} processOnlyThisOneSchemaFile
 */

/**
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
  const schemaNameOption = argv.SchemaName
  if (processOnlyThisOneSchemaFile === undefined && schemaNameOption) {
    processOnlyThisOneSchemaFile = schemaNameOption
    const file = path.join(SchemaDir, processOnlyThisOneSchemaFile)

    if (!(await exists(file))) {
      printErrorMessagesAndExit([
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
   * @param callback The callback function(schema)
   * @param {boolean} onlySchemaScan True = a scan without test files.
   */
  const scanAllSchemaFiles = async (callback, onlySchemaScan) => {
    if (!callback) {
      return
    }
    // Process all the schema files one by one via callback.
    for (const schemaFileName of SchemasToBeTested) {
      if (processOnlyThisOneSchemaFile) {
        if (schemaFileName !== processOnlyThisOneSchemaFile) {
          continue
        }
      }
      const schemaFullPathName = path.join(SchemaDir, schemaFileName)

      // Some schema files must be ignored.
      if (
        canThisTestBeRun(schemaFileName) &&
        !skipThisFileName(schemaFileName)
      ) {
        const buffer = skipReadFile
          ? undefined
          : await fs.readFile(schemaFullPathName)
        let jsonObj_
        try {
          jsonObj_ = buffer ? JSON.parse(buffer.toString()) : undefined
        } catch (err) {
          printErrorMessagesAndExit([
            `JSON file ${schemaFullPathName} did not parse correctly.`,
            err,
          ])
        }
        const schema = {
          // Return the real Raw file for BOM file test rejection
          rawFile: buffer ?? '',
          jsonObj: jsonObj_,
          jsonName: path.basename(schemaFullPathName),
          urlOrFilePath: schemaFullPathName,
          schemaScan: onlySchemaScan,
        }
        await callback(schema)
      }
    }
  }

  // Scan one test folder for all the files inside it
  const scanOneTestFolder = async (
    schemaName,
    testDir,
    testPassScan,
    testPassScanDone,
  ) => {
    const loadTestFile = (testFileNameWithPath, buffer) => {
      // Test files have extension '.json' or else it must be a YAML file
      const fileExtension = testFileNameWithPath.split('.').pop()
      switch (fileExtension) {
        case 'json':
          try {
            return JSON.parse(buffer.toString())
          } catch (err) {
            printErrorMessagesAndExit([
              `JSON file ${testFileNameWithPath} did not parse correctly.`,
              err,
            ])
          }
          break
        case 'yaml':
        case 'yml':
          try {
            return YAML.parse(buffer.toString())
          } catch (err) {
            printErrorMessagesAndExit([
              `Can't read/decode yaml file: ${testFileNameWithPath}`,
              err,
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
            printErrorMessagesAndExit([
              `Can't read/decode toml file: ${testFileNameWithPath}`,
              err,
            ])
          }
          break
        default:
          printErrorMessagesAndExit([
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
    const filesInsideOneTestFolder = (await fs.readdir(folderNameAndPath)).map(
      // Must create a list with full path name
      (fileName) => path.join(folderNameAndPath, fileName),
    )

    if (!filesInsideOneTestFolder.length) {
      printErrorMessagesAndExit([
        `Found folder with no test files: ${folderNameAndPath}`,
      ])
    }

    for (const testFileFullPathName of filesInsideOneTestFolder) {
      // forbidden to add extra folder inside the specific test folder
      if (!(await fs.lstat(testFileFullPathName)).isFile()) {
        printErrorMessagesAndExit([
          `Found non test file inside test folder: ${testFileFullPathName}`,
        ])
      }
      if (!skipThisFileName(path.basename(testFileFullPathName))) {
        const buffer = skipReadFile
          ? undefined
          : await fs.readFile(testFileFullPathName)
        const schema = {
          rawFile: buffer,
          jsonObj: skipReadFile
            ? undefined
            : loadTestFile(testFileFullPathName, buffer),
          jsonName: path.basename(testFileFullPathName),
          urlOrFilePath: testFileFullPathName,
          // This is a test folder scan process, not schema scan process
          schemaScan: false,
        }
        testPassScan(schema)
      }
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

/**
 * @param {Schema} schema
 */
function testSchemaFileForBOM(schema) {
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
        printErrorMessagesAndExit([
          `Schema file must not have ${bom.name} BOM: ${schema.urlOrFilePath}`,
        ])
      }
    }
  }
}

/**
 * @typedef {Object} FactoryAJVParameter
 * @property {string} schemaName
 * @property {string[]} unknownFormatsList
 * @property {boolean} fullStrictMode
 * @property {boolean} standAloneCode
 * @property {string[]} standAloneCodeWithMultipleSchema
 */

/**
 * @summary There are multiple AJV versions for each $schema version. This returns
 * the correct AJV instance
 * @param {Partial<FactoryAJVParameter>} arg0
 * @returns {Object}
 */
function factoryAJV({
  schemaName,
  unknownFormatsList = [],
  fullStrictMode = true,
  standAloneCode = false,
  standAloneCodeWithMultipleSchema = [],
} = {}) {
  // some AJV default setting are [true, false or log]
  // Some options are default: 'log'
  // 'log' will generate a lot of noise in the build log. So make it true or false.
  // Hiding the issue log also does not solve anything.
  // These option items that are not strict must be reduces in the future.
  const ajvOptionsNotStrictMode = {
    strictTypes: false, // recommended : true
    strictTuples: false, // recommended : true
    allowMatchingProperties: true, // recommended : false
  }
  const ajvOptionsStrictMode = {
    strict: true,
  }
  const ajvOptions = fullStrictMode
    ? ajvOptionsStrictMode
    : ajvOptionsNotStrictMode

  // Stand-alone code need some special options parameters
  if (standAloneCode) {
    ajvOptions.code = { source: true }
    if (standAloneCodeWithMultipleSchema.length) {
      ajvOptions.schemas = standAloneCodeWithMultipleSchema
    }
  }

  let ajvSelected
  // There are multiple AJV version for each $schema version.
  // Create the correct one.
  switch (schemaName) {
    case 'draft-04':
      ajvSelected = new AjvDraft04(ajvOptions)
      break
    case 'draft-06':
    case 'draft-07':
      ajvSelected = new AjvDraft06And07(ajvOptions)
      if (schemaName === 'draft-06') {
        ajvSelected.addMetaSchema(AjvDraft06SchemaJson)
      } else {
        // 'draft-07' have additional format
        ajvFormatsDraft2019(ajvSelected)
      }
      break
    case '2019-09':
      ajvSelected = new Ajv2019(ajvOptions)
      ajvFormatsDraft2019(ajvSelected)
      break
    case '2020-12':
      ajvSelected = new Ajv2020(ajvOptions)
      ajvFormatsDraft2019(ajvSelected)
      break
    default:
      ajvSelected = new AjvDraft04(ajvOptions)
  }

  // addFormats() and addFormat() to the latest AJV version
  addFormats(ajvSelected)
  unknownFormatsList.forEach((x) => {
    ajvSelected.addFormat(x, true)
  })
  return ajvSelected
}

/**
 * @typedef {Object} getOptionReturn
 * @property {string[]} unknownFormatsList
 * @property {string[]} externalSchemaWithPathList
 * @property {string[]} unknownKeywordsList
 */

/**
 * @summary Gets the option items for a particular `jsonName`
 * @param {string} jsonName
 * @returns {getOptionReturn}
 */
function getOption(jsonName) {
  const options = SchemaValidation.options[jsonName]

  // collect the unknownFormat list
  const unknownFormatsList = options?.unknownFormat ?? []

  // collect the unknownKeywords list
  const unknownKeywordsList = options?.unknownKeywords ?? []

  // collect the externalSchema list
  const externalSchemaList = options?.externalSchema ?? []
  const externalSchemaWithPathList = externalSchemaList?.map(
    (schemaFileName) => {
      return path.resolve('.', SchemaDir, schemaFileName)
    },
  )

  return {
    unknownFormatsList,
    unknownKeywordsList,
    externalSchemaWithPathList,
  }
}

async function ajv() {
  const schemaVersion = showSchemaVersions()
  const textCompile = 'compile              | '
  const textPassSchema = 'pass schema          | '
  const textPositivePassTest = 'pass positive test   | '
  const textPositiveFailedTest = 'Failed positive test | '
  const textNegativePassTest = 'pass negative test   | '
  const textNegativeFailedTest = 'Failed negative test | '

  let validate
  let countSchema = 0

  const schemaForTestScan = async (/** @type {Schema} */ schema) => {
    let ajvSelected

    // Get possible options defined in schema-validation.json
    const {
      unknownFormatsList,
      unknownKeywordsList,
      externalSchemaWithPathList,
    } = getOption(schema.jsonName)

    // Start validate the JSON schema
    let schemaJson
    let versionObj
    let schemaVersionStr = 'unknown'
    // const fullStrictMode = schemaValidation.ajvFullStrictMode.includes(schema.jsonName)
    // The SchemaStore default mode is full Strict Mode. Not in the list => full strict mode
    const fullStrictMode = !SchemaValidation.ajvNotStrictMode.includes(
      schema.jsonName,
    )
    const fullStrictModeStr = fullStrictMode
      ? '(FullStrictMode)'
      : '(NotStrictMode)'
    try {
      // select the correct AJV object for this schema
      schemaJson = schema.jsonObj
      versionObj = schemaVersion.getObj(schemaJson)

      // Get the correct AJV version
      ajvSelected = factoryAJV({
        schemaName: versionObj?.schemaName,
        unknownFormatsList,
        fullStrictMode,
      })

      // AJV must ignore these keywords
      unknownKeywordsList?.forEach((x) => {
        ajvSelected.addKeyword(x)
      })

      // Add external schema to AJV
      for (const x of externalSchemaWithPathList) {
        ajvSelected.addSchema(await readJsonFile(x.toString()))
      }

      // What schema draft version is it?
      schemaVersionStr = versionObj ? versionObj.schemaName : 'unknown'

      // compile the schema
      validate = ajvSelected.compile(schemaJson)
    } catch (err) {
      printErrorMessagesAndExit([
        `${textCompile}${schema.urlOrFilePath} (${schemaVersionStr})${fullStrictModeStr}`,
        err,
      ])
    }
    countSchema++
    console.log()
    log.ok(
      `${textPassSchema}${schema.urlOrFilePath} (${schemaVersionStr})${fullStrictModeStr}`,
    )
  }

  const processTestFile = (schema, success, failure) => {
    validate(schema.jsonObj) ? success() : failure()
  }

  const positiveTestScan = (/** @type {Schema} */ schema) => {
    processTestFile(
      schema,
      () => {
        log.ok(`${textPositivePassTest}${schema.urlOrFilePath}`)
      },
      () => {
        printErrorMessagesAndExit(
          [
            `${textPositiveFailedTest} for schema file "${schema.urlOrFilePath}"`,
            `Showing first error out of ${validate.errors?.length ?? '?'} total error(s)`,
          ],
          util.formatWithOptions(
            { colors: true },
            '%O',
            validate.errors?.[0] ?? '???',
          ),
        )
      },
    )
  }

  const negativeTestScan = (/** @type {Schema} */ schema) => {
    processTestFile(
      schema,
      () => {
        printErrorMessagesAndExit([
          `${textNegativeFailedTest}${schema.urlOrFilePath}`,
          'Negative test must always fail.',
        ])
      },
      () => {
        // must show log as single line
        // const path = validate.errors[0].instancePath
        let text = ''
        text = text.concat(`${textNegativePassTest}${schema.urlOrFilePath}`)
        text = text.concat(` (Schema: ${validate.errors[0].schemaPath})`)
        text = text.concat(` (Test: ${validate.errors[0].instancePath})`)
        text = text.concat(` (Message): ${validate.errors[0].message})`)
        log.ok(text)
      },
    )
  }

  const schemaForTestScanDone = () => {
    console.log()
    console.log(`Total schemas validated with AJV: ${countSchema}`)
    countSchema = 0
  }

  return {
    schemaForTestScan,
    schemaForTestScanDone,
    positiveTestScan,
    negativeTestScan,
  }
}

function showSchemaVersions() {
  let countSchemaVersionUnknown = 0

  const getObj_ = (schemaJson) => {
    const schemaVersion = schemaJson.$schema
    const obj = SCHEMA_DIALECTS.find((obj) => schemaVersion === obj.url)
    if (!obj) {
      throw new Error('Failed getObj_')
    }
    return obj
  }

  /** @type {Map<string, number>} */
  const schemaDialectCounts = new Map(
    SCHEMA_DIALECTS.map((schemaDialect) => [schemaDialect.url, 0]),
  )

  return {
    getObj: getObj_,
    process_data: (/** @type {Schema} */ schema) => {
      let obj
      try {
        obj = getObj_(schema.jsonObj)
      } catch {
        // Suppress `JSON.parse` exceptions, leaving obj with value of `undefined`.
      }

      if (obj) {
        schemaDialectCounts.set(obj.url, schemaDialectCounts.get(obj.url) + 1)
      } else {
        countSchemaVersionUnknown++
        log.error(`$schema is unknown in the file: ${schema.urlOrFilePath}`)
      }
    },
    process_data_done: () => {
      // Show the all the schema version count.
      for (const obj of SCHEMA_DIALECTS) {
        log.ok(
          `Schemas using (${
            obj.schemaName
          }) Total files: ${schemaDialectCounts.get(obj.url)}`,
        )
      }
      log.ok(`$schema unknown. Total files: ${countSchemaVersionUnknown}`)
    },
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
  assertCatalogJsonLocalUrlsMustRefFile()
  await assertCatalogJsonIncludesAllSchemas()

  // Check schema-validation.json.
  await assertSchemaValidationJsonValidatesAgainstJsonSchema()
  assertSchemaValidationJsonReferencesNoNonexistentFiles()
  assertSchemaValidationJsonHasNoUnmatchedUrls()
  assertSchemaValidationJsonHasValidSkipTest()

  // Check schemas.
  await assertSchemaHasNoBom()
  await assertSchemaHasNoDuplicatedPropertyKeys()
  await assertSchemaHasValidSchemaField()
  await assertSchemaHasValidIdField()
  await assertSchemaPassesSchemaSafeLint()

  await printSchemasTestedInFullStrictMode()
  printSchemasWithoutPositiveTestFiles()
  await testAjv()
  printUrlCountsInCatalog()
  await printCountSchemaVersions()
}

async function taskCheckRemote() {
  await remoteAssertSchemaHasNoBom()
  await remoteTestAjv()
  await remotePrintCountSchemaVersions()
}

async function taskMaintenance() {
  await printDowngradableSchemaVersions()
  await printStrictAndNotStrictAjvValidatedSchemas()
}

async function taskCoverage() {
  const javaScriptCoverageName = 'schema.json.translated.to.js'
  const javaScriptCoverageNameWithPath = path.join(
    `${TempCoverageDir}/${javaScriptCoverageName}`,
  )

  /**
   * Translate one JSON schema file to javascript via AJV validator.
   * And run the positive and negative test files with it.
   * @param {string} processOnlyThisOneSchemaFile The schema file that need to process
   */
  const generateCoverage = async (processOnlyThisOneSchemaFile) => {
    const schemaVersion = showSchemaVersions()
    let jsonName
    let mainSchema
    let mainSchemaJsonId
    let isThisWithExternalSchema
    let validations

    // Compile JSON schema to javascript and write it to disk.
    const processSchemaFile = async (/** @type {Schema} */ schema) => {
      jsonName = schema.jsonName
      // Get possible options define in schema-validation.json
      const {
        unknownFormatsList,
        unknownKeywordsList,
        externalSchemaWithPathList,
      } = getOption(schema.jsonName)

      // select the correct AJV object for this schema
      mainSchema = schema.jsonObj
      const versionObj = schemaVersion.getObj(mainSchema)

      // External schema present to be included?
      const multipleSchema = []
      isThisWithExternalSchema = externalSchemaWithPathList.length > 0
      if (isThisWithExternalSchema) {
        // There is an external schema that need to be included.
        for (const x of externalSchemaWithPathList) {
          multipleSchema.push(await readJsonFile(x.toString()))
        }

        // Also add the 'root' schema
        multipleSchema.push(mainSchema)
      }

      // Get the correct AJV version
      const ajvSelected = factoryAJV({
        schemaName: versionObj?.schemaName,
        unknownFormatsList,
        fullStrictMode: !SchemaValidation.ajvNotStrictMode.includes(jsonName),
        standAloneCode: true,
        standAloneCodeWithMultipleSchema: multipleSchema,
      })

      // AJV must ignore these keywords
      unknownKeywordsList?.forEach((x) => {
        ajvSelected.addKeyword(x)
      })

      let moduleCode
      if (isThisWithExternalSchema) {
        // Multiple schemas are combine to one JavaScript file.
        // Must use the root $id/id to call the correct 'main' schema in JavaScript code
        mainSchemaJsonId =
          schemaVersion.getObj(mainSchema).schemaName === 'draft-04'
            ? mainSchema.id
            : mainSchema.$id
        if (!mainSchemaJsonId) {
          printErrorMessagesAndExit([`Missing $id or id in ${jsonName}`])
        }
        moduleCode = AjvStandalone(ajvSelected)
      } else {
        // Single schema
        mainSchemaJsonId = undefined
        moduleCode = AjvStandalone(ajvSelected, ajvSelected.compile(mainSchema))
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

  const schemaNameToBeCoverage = argv.SchemaName
  if (!schemaNameToBeCoverage) {
    printErrorMessagesAndExit([
      'Must start "make" file with --SchemaName parameter.',
    ])
  }
  await generateCoverage(schemaNameToBeCoverage)
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
              printErrorMessagesAndExit([
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

  log.ok('local AJV schema passed')
}

async function remoteTestAjv() {
  const x = await ajv()
  let countScan = 0
  await remoteSchemaFile((testSchemaFile) => {
    x.testSchemaFile(testSchemaFile)
    countScan++
  })
  console.log()
  console.log(`Total schemas validated with AJV: ${countScan}`)
}

async function remoteAssertSchemaHasNoBom() {
  await remoteSchemaFile(testSchemaFileForBOM, false)
}

async function remotePrintCountSchemaVersions() {
  const x = showSchemaVersions()
  await remoteSchemaFile((schema) => {
    x.process_data(schema)
  }, false)
  x.process_data_done()
}

function assertFsTestFoldersHaveAtLeastOneTestSchema() {
  const check = (/** @type {string[]} */ folderList) => {
    for (const folderName of folderList) {
      if (skipThisFileName(folderName)) {
        continue
      }

      if (!SchemasToBeTested.includes(folderName + '.json')) {
        printErrorMessagesAndExit([
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
      printErrorMessagesAndExit([
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
    if (
      !skipThisFileName(schemaName) &&
      !(await fs.lstat(path.join(SchemaDir, schemaName))).isFile()
    ) {
      printErrorMessagesAndExit([
        `There can only be files in directory : ${SchemaDir} => ${schemaName}`,
      ])
    }
  }

  for (const dirname of FoldersPositiveTest) {
    if (
      !skipThisFileName(dirname) &&
      !(await fs.lstat(path.join(TestPositiveDir, dirname))).isDirectory()
    ) {
      printErrorMessagesAndExit([
        `There can only be directory's in :${TestPositiveDir} => ${dirname}`,
      ])
    }
  }

  for (const dirname of FoldersNegativeTest) {
    if (
      !skipThisFileName(dirname) &&
      !(await fs.lstat(path.join(TestNegativeDir, dirname))).isDirectory()
    ) {
      printErrorMessagesAndExit([
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
    printErrorMessagesAndExit(
      [`Failed strict jsonlint parse of file "${CatalogFile}"`],
      err.toString(),
    )
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
    printErrorMessagesAndExit(
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
      printErrorMessagesAndExit([
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

    for (const property of ['name', 'description']) {
      if (
        /$[,. \t-]/u.test(catalogEntry?.[property]) ||
        /[,. \t-]$/u.test(catalogEntry?.[property])
      ) {
        printErrorMessagesAndExit([
          `Expected the "name" or "description" properties of catalog entries to not end with characters ",.<space><tab>-"`,
          `The invalid entry has a "url" of "${catalogEntry.url}" in file "${CatalogFile}"`,
        ])
      }
    }

    for (const property of ['name', 'description']) {
      if (catalogEntry?.[property]?.toLowerCase()?.includes('schema')) {
        printErrorMessagesAndExit([
          `Expected the "name" or "description" properties of catalog entries to not include the word "schema"`,
          `All files are already schemas, so its meaning is implied`,
          `If the JSON schema is actually a meta-schema (or some other exception applies), ignore this error by appending to the property "catalogEntryNoLintNameOrDescription" in file "${SchemaValidationFile}"`,
          `The invalid entry has a "url" of "${catalogEntry.url}" in file "${CatalogFile}"`,
        ])
      }
    }

    for (const property of ['name', 'description']) {
      if (catalogEntry?.[property]?.toLowerCase()?.includes('\n')) {
        printErrorMessagesAndExit([
          `Expected the "name" or "description" properties of catalog entries to not include a newline character"`,
          `The invalid entry has a "url" of "${catalogEntry.url}" in file "${CatalogFile}"`,
        ])
      }
    }

    for (const fileGlob of catalogEntry.fileMatch ?? []) {
      if (fileGlob.includes('/')) {
        // A folder must start with **/
        if (!fileGlob.startsWith('**/')) {
          printErrorMessagesAndExit([
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
  const allFileMatches = []

  for (const catalogEntry of Catalog.schemas) {
    for (const fileGlob of catalogEntry.fileMatch ?? []) {
      // Ignore globs that are OK to conflict for backwards compatibility.
      if (SchemaValidation.fileMatchConflict.includes(fileGlob)) {
        continue
      }

      if (allFileMatches.includes(fileGlob)) {
        printErrorMessagesAndExit([
          `Expected "fileMatch" value of "${fileGlob}" to be unique across all "fileMatch" properties in file "${CatalogFile}"`,
        ])
      }

      allFileMatches.push(fileGlob)
    }
  }

  log.ok('catalog.json: No duplicate "fileMatch" values found')
}

function assertCatalogJsonLocalUrlsMustRefFile() {
  getUrlFromCatalog((/** @type {string} */ catalogUrl) => {
    // Skip external schemas from check.
    if (!catalogUrl.startsWith(UrlSchemaStore)) {
      return
    }

    const filename = new URL(catalogUrl).pathname.slice(1)

    // Check that local URLs have end in .json
    if (!filename.endsWith('.json')) {
      printErrorMessagesAndExit([
        `Expected catalog entries for local files to have a "url" that ends in ".json"`,
        `The invalid entry has a "url" of "${catalogUrl}" in file "${CatalogFile}"`,
      ])
    }

    // Check if schema file exist or not.
    if (!exists(path.join(SchemaDir, filename))) {
      printErrorMessagesAndExit([
        `Expected schema file to exist at "${path.join(SchemaDir, filename)}", but no file found`,
        `Schema file path inferred from catalog entry with a "url" of "${catalogUrl}" in file "${CatalogFile}"`,
      ])
    }
  })

  log.ok(`catalog.json: All local entries point to a schema file that exists`)
}

async function assertCatalogJsonIncludesAllSchemas() {
  const allCatalogLocalJsonFiles = []

  getUrlFromCatalog((/** @type {string} */ catalogUrl) => {
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
          printErrorMessagesAndExit([
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
    log.ok('schema-validation.json: Validates against schema')
  } else {
    printErrorMessagesAndExit(
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
        printErrorMessagesAndExit([
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
      printErrorMessagesAndExit([
        `Expected to find file at path "${SchemaDir}/${schemaName}"`,
        `Filename "${schemaName}" declared in file "${SchemaValidationFile}" under property "options"`,
      ])
    }
  }

  log.ok('schema-validation.json: References no non-existent files')
}

function assertSchemaValidationJsonHasNoUnmatchedUrls() {
  const check = (
    /** @type {string[]} */ schemaUrls,
    /** @type {string} */ propertyName,
  ) => {
    for (const schemaUrl of schemaUrls) {
      const catalogUrls = Catalog.schemas.map((item) => item.url)
      if (!catalogUrls.includes(schemaUrl)) {
        printErrorMessagesAndExit([
          `Failed to find a "url" with value of "${schemaUrl}" in file "${CatalogFile}" under property "${propertyName}[]"`,
        ])
      }
    }
  }

  check(
    SchemaValidation.catalogEntryNoLintNameOrDescription,
    'catalogEntryNoLintNameOrDescription',
  )

  log.ok(`schema-validation.json: Has no unmatched URLs`)
}

function assertSchemaValidationJsonHasValidSkipTest() {
  const check = (
    /** @type {string[]} */ schemaNames,
    /** @type {string} */ propertyName,
  ) => {
    for (const schemaName of schemaNames) {
      if (SchemaValidation.skiptest.includes(schemaName)) {
        printErrorMessagesAndExit([
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
      printErrorMessagesAndExit([
        `Did not expect to find filename "${schemaName}" in file "${SchemaValidationFile}" under property "options"`,
        `Because filename "${schemaName}" is listed under "skiptest", it should not be referenced anywhere else in the file`,
      ])
    }
  }

  // Test folder must not exist if defined in skiptest[]
  for (const schemaName of SchemaValidation.skiptest) {
    const folderName = schemaName.replace(/\.json$/, '')

    if (FoldersPositiveTest.includes(folderName)) {
      printErrorMessagesAndExit([
        `Did not expect to find positive test directory at "${path.join(TestPositiveDir, folderName)}"`,
        `Because filename "${schemaName}" is listed under "skiptest", it should not have any positive test files`,
      ])
    }

    if (FoldersNegativeTest.includes(folderName)) {
      printErrorMessagesAndExit([
        `Did not expect to find negative test directory at "${path.join(TestNegativeDir, folderName)}"`,
        `Because filename "${schemaName}" is listed under "skiptest", it should not have any negative test files`,
      ])
    }
  }

  log.ok(
    `schema-validation.json: Entries under skiptest[] are not used elsewhere`,
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
      printErrorMessagesAndExit([`Test file: ${schema.urlOrFilePath}`, err])
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

        const validSchemas = SCHEMA_DIALECTS.map(
          (schemaDialect) => schemaDialect.url,
        )
        if (!validSchemas.includes(schema.jsonObj.$schema)) {
          printErrorMessagesAndExit([
            `Schema file has invalid or missing '$schema' keyword => ${schema.jsonName}`,
            `Valid schemas: ${JSON.stringify(validSchemas)}`,
          ])
        }

        if (!SchemaValidation.highSchemaVersion.includes(schema.jsonName)) {
          const tooHighSchemas = SCHEMA_DIALECTS.filter(
            (schemaDialect) => schemaDialect.isTooHigh,
          ).map((schemaDialect) => schemaDialect.url)
          if (tooHighSchemas.includes(schema.jsonObj.$schema)) {
            printErrorMessagesAndExit([
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
            printErrorMessagesAndExit([
              `Missing property 'id' for schema 'src/schemas/json/${schema.jsonName}'`,
            ])
          }
          schemaId = schema.jsonObj.id
        } else {
          if (schema.jsonObj.$id === undefined) {
            printErrorMessagesAndExit([
              `Missing property '$id' for schema 'src/schemas/json/${schema.jsonName}'`,
            ])
          }
          schemaId = schema.jsonObj.$id
        }

        if (
          !schemaId.startsWith('https://') &&
          !schemaId.startsWith('http://')
        ) {
          printErrorMessagesAndExit([
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
        for (const e of errors) {
          console.log(`${schema.jsonName}: ${e.message}`)
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
  const x = showSchemaVersions()
  await localSchemaFileAndTestFile(
    {
      schemaOnlyScan: x.process_data,
      schemaOnlyScanDone: x.process_data_done,
    },
    {
      fullScanAllFiles: true,
      skipReadFile: false,
    },
  )
}

function printUrlCountsInCatalog() {
  let countScanURLExternal = 0
  let countScanURLInternal = 0
  getUrlFromCatalog((catalogUrl) => {
    catalogUrl.startsWith(UrlSchemaStore)
      ? countScanURLInternal++
      : countScanURLExternal++
  })
  const totalCount = countScanURLExternal + countScanURLInternal
  const percentExternal = (countScanURLExternal / totalCount) * 100
  log.ok(`${countScanURLInternal} SchemaStore URL`)
  log.ok(
    `${countScanURLExternal} External URL (${Math.round(percentExternal)}%)`,
  )
  log.ok(`${totalCount} Total URL`)
}

async function printStrictAndNotStrictAjvValidatedSchemas() {
  const schemaVersion = showSchemaVersions()
  const schemaInFullStrictMode = []
  const schemaInNotStrictMode = []
  const checkIfThisSchemaIsAlreadyInStrictMode = async (
    /** @type {Schema} */ schema,
  ) => {
    const schemaJsonName = schema.jsonName
    const {
      unknownFormatsList,
      unknownKeywordsList,
      externalSchemaWithPathList,
    } = getOption(schemaJsonName)

    // select the correct AJV object for this schema
    const mainSchema = schema.jsonObj
    const versionObj = schemaVersion.getObj(mainSchema)

    // Get the correct AJV version
    const ajvSelected = factoryAJV({
      schemaName: versionObj?.schemaName,
      unknownFormatsList,
      fullStrictMode: true,
    })

    // AJV must ignore these keywords
    unknownKeywordsList?.forEach((x) => {
      ajvSelected.addKeyword(x)
    })

    // Add external schema to AJV
    for (const x of externalSchemaWithPathList) {
      ajvSelected.addSchema(await readJsonFile(x.toString()))
    }

    try {
      ajvSelected.compile(mainSchema)
    } catch {
      // failed to compile in strict mode.
      schemaInNotStrictMode.push(schemaJsonName)
      return
    }
    schemaInFullStrictMode.push(schemaJsonName)
  }

  const listSchema = (mode, list) => {
    console.log('------------------------------------')
    console.log(`Schemas in ${mode} strict mode:`)
    for (const schemaName of list) {
      // Write it is JSON list format. For easy copy to schema-validation.json
      console.log(`"${schemaName}",`)
    }
    log.ok(`Total schemas check ${mode} strict mode: ${list.length}`)
  }

  await localSchemaFileAndTestFile(
    {
      schemaOnlyScan: checkIfThisSchemaIsAlreadyInStrictMode,
    },
    { skipReadFile: false },
  )

  listSchema('Full', schemaInFullStrictMode)
  listSchema('Not', schemaInNotStrictMode)
  console.log()
  console.log('------------------------------------')
  log.ok(
    `Total all schemas check: ${
      schemaInFullStrictMode.length + schemaInNotStrictMode.length
    }`,
  )
}

async function printDowngradableSchemaVersions() {
  let countScan = 0

  /**
   * @param {string} schemaJson
   * @param {string} schemaName
   * @param {getOptionReturn} option
   */
  const validateViaAjv = async (schemaJson, schemaName, option) => {
    try {
      const ajvSelected = factoryAJV({
        schemaName,
        unknownFormatsList: option.unknownFormatsList,
        fullStrictMode: false,
      })

      // AJV must ignore these keywords
      option.unknownKeywordsList?.forEach((x) => {
        ajvSelected.addKeyword(x)
      })

      // Add external schema to AJV
      for (const x of option.externalSchemaWithPathList) {
        ajvSelected.addSchema(await readJsonFile(x.toString()))
      }

      ajvSelected.compile(schemaJson)
      return true
    } catch {
      return false
    }
  }

  // There are no positive or negative test processes here.
  // Only the schema files are tested.
  const testLowerSchemaVersion = async (/** @type {Schema} */ schema) => {
    countScan++
    let versionIndexOriginal = 0
    const schemaJson = schema.jsonObj

    const option = getOption(schema.jsonName)

    // get the present schema_version
    const schemaVersion = schemaJson.$schema
    for (const [index, value] of SCHEMA_DIALECTS.entries()) {
      if (schemaVersion === value.url) {
        versionIndexOriginal = index
        break
      }
    }

    // start testing each schema version in a while loop.
    let result = false
    let recommendedIndex = versionIndexOriginal
    let versionIndexToBeTested = versionIndexOriginal
    do {
      // keep trying to use the next lower schema version from the countSchemas[]
      versionIndexToBeTested++
      const schemaVersionToBeTested = SCHEMA_DIALECTS[versionIndexToBeTested]
      if (!schemaVersionToBeTested?.isActive) {
        // Can not use this schema version. And there are no more 'isActive' list item left.
        break
      }

      // update the schema with a new alternative $schema version
      schemaJson.$schema = schemaVersionToBeTested.url
      // Test this new updated schema with AJV
      result = await validateViaAjv(
        schemaJson,
        schemaVersionToBeTested.schemaName,
        option,
      )

      if (result) {
        // It passes the test. So this is the new recommended index
        recommendedIndex = versionIndexToBeTested
      }
      // keep in the loop till it fail the validation process.
    } while (result)

    if (recommendedIndex !== versionIndexOriginal) {
      // found a different schema version that also work.
      const original = SCHEMA_DIALECTS[versionIndexOriginal].schemaName
      const recommended = SCHEMA_DIALECTS[recommendedIndex].schemaName
      log.ok(
        `${schema.jsonName} (${original}) is also valid with (${recommended})`,
      )
    }
  }

  console.log()
  log.ok(
    'Check if a lower $schema version will also pass the schema validation test',
  )
  await localSchemaFileAndTestFile(
    { schemaOnlyScan: testLowerSchemaVersion },
    { skipReadFile: false },
  )
  console.log()
  log.ok(`Total files scan: ${countScan}`)
}

async function printSchemasTestedInFullStrictMode() {
  let countSchemaScanViaAJV = 0
  await localSchemaFileAndTestFile({
    schemaOnlyScan() {
      countSchemaScanViaAJV++
    },
  })

  // If only ONE AJV schema test is run then this calculation does not work.
  if (countSchemaScanViaAJV !== 1) {
    const countFullStrictSchema =
      countSchemaScanViaAJV - SchemaValidation.ajvNotStrictMode.length
    const percent = (countFullStrictSchema / countSchemaScanViaAJV) * 100
    log.ok(
      'Schema in full strict mode to prevent any unexpected behaviors or silently ignored mistakes in user schemas.',
    )
    log.ok(
      `${countFullStrictSchema} of ${countSchemaScanViaAJV} (${Math.round(
        percent,
      )}%)`,
    )
  }
}

function printSchemasWithoutPositiveTestFiles() {
  let countMissingTest = 0
  // Check if each schemasToBeTested[] items is present in foldersPositiveTest[]
  for (const schemaName of SchemasToBeTested) {
    if (!FoldersPositiveTest.includes(schemaName.replace('.json', ''))) {
      countMissingTest++
      log.ok(`(No positive test file present): ${schemaName}`)
    }
  }
  if (countMissingTest > 0) {
    const percent = (countMissingTest / SchemasToBeTested.length) * 100
    console.log()
    console.log(`${Math.round(percent)}% of schemas do not have tests.`)
    log.ok(
      `Schemas that have no positive test files. Total files: ${countMissingTest}`,
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

  const taskMapping = {
    'new-schema': taskNewSchema,
    lint: taskLint,
    check: taskCheck,
    'check-remote': taskCheckRemote,
    coverage: taskCoverage,
    maintenance: taskMaintenance,
    build: taskCheck, // Undocumented alias.
  }
  const taskOrFn = argv._[0]
  if (taskOrFn in taskMapping) {
    await taskMapping[taskOrFn]()
  } else {
    eval(`${taskOrFn}()`)
  }
}
