/// <binding AfterBuild='build' />
import path from 'node:path'
import fs from 'node:fs'
import readline from 'node:readline'
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
const temporaryCoverageDir = './temp'
const schemaDir = './src/schemas/json'
const testPositiveDir = './src/test'
const testNegativeDir = './src/negative_test'
const urlSchemaStore = 'https://json.schemastore.org/'
const catalog = readJsonFile('./src/api/json/catalog.json')
const schemaValidation = jsoncParser.parse(
  await fs.promises.readFile('./src/schema-validation.json', 'utf-8'),
)
const [schemasToBeTested, foldersPositiveTest, foldersNegativeTest] =
  await Promise.all([
    fs.promises.readdir(schemaDir),
    fs.promises.readdir(testPositiveDir),
    fs.promises.readdir(testNegativeDir),
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
  ok(/** @type {string=} */ msg = 'OK') {
    console.log(chalk.green('>>') + ' ' + msg)
  },
  error(/** @type {string=} */ msg = 'ERROR') {
    console.log(chalk.red('>>') + ' ' + msg)
  },
  writeln(/** @type {string=} */ msg = '') {
    console.log(msg)
  },
}

function readJsonFile(/** @type {string} */ filename) {
  return JSON.parse(fs.readFileSync(filename, 'utf-8'))
}

const argv = minimist(process.argv.slice(2), {
  boolean: ['help', 'lint'],
})

function skipThisFileName(/** @type {string} */ name) {
  // This macOS file must always be ignored.
  return name === '.DS_Store'
}

function getUrlFromCatalog(catalogUrl) {
  for (const schema of catalog.schemas) {
    catalogUrl(schema.url)
    const versions = schema.versions
    if (versions) {
      Object.values(versions).forEach((url) => catalogUrl(url))
    }
  }
}

/**
 * @summary Calling this will terminate the process and show the text
 * of each error message, in addition to npm's error message.
 * @param {string[]} errorText
 */
function throwWithErrorText(errorText) {
  log.writeln()
  log.writeln()
  log.writeln('################ Error message')
  for (const text of errorText) {
    log.error(text)
  }
  log.writeln('##############################')
  throw new Error('See error message above this line.')
}

/**
 * @param {CbParamFn} schemaOnlyScan
 */
async function remoteSchemaFile(schemaOnlyScan, showLog = true) {
  for (const { url } of catalog.schemas) {
    if (url.startsWith(urlSchemaStore)) {
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

        schemaOnlyScan(schema)
        if (showLog) {
          log.ok(url)
        }
      } else {
        if (showLog) {
          log.error(url, res.status)
        }
      }
    } catch (error) {
      console.error(error)
      if (showLog) {
        log.writeln('')
        log.error(url, error.name, error.message)
        log.writeln('')
      }
    }
  }
}

/**
 * @typedef {Object} JsonSchema
 * @property {string} $schema
 * @property {string} $id
 */

/**
 * @typedef {Object} Schema
 * @prop {Buffer | undefined} rawFile
 * @prop {Record<string, unknown> & JsonSchema} jsonObj
 * @prop {string} jsonName
 * @prop {string} urlOrFilePath
 * @prop {boolean} schemaScan
 */

/**
 * @callback CbParamFn
 * @param {Schema}
 */

/**
 * @typedef {Object} localSchemaFileAndTestFileParameter1
 * @prop {CbParamFn} schemaOnlyScan
 * @prop {CbParamFn} schemaOnlyScanDone
 * @prop {CbParamFn} schemaForTestScan
 * @prop {CbParamFn} schemaForTestScanDone
 * @prop {CbParamFn} positiveTestScan
 * @prop {CbParamFn} positiveTestScanDone
 * @prop {CbParamFn} negativeTestScan
 * @prop {CbParamFn} negativeTestScanDone
 */

/**
 * @typedef {Object} localSchemaFileAndTestFileParameter2
 * @prop {boolean} fullScanAllFiles
 * @prop {boolean} skipReadFile
 * @prop {boolean} ignoreSkiptest
 * @prop {string} processOnlyThisOneSchemaFile
 */

/**
 * @param {localSchemaFileAndTestFileParameter1}
 * @param {localSchemaFileAndTestFileParameter2}
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
    const file = path.join(schemaDir, processOnlyThisOneSchemaFile)
    if (!fs.existsSync(file)) {
      throwWithErrorText([
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
    if (!ignoreSkiptest && schemaValidation.skiptest.includes(jsonFilename)) {
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
    for (const schemaFileName of schemasToBeTested) {
      if (processOnlyThisOneSchemaFile) {
        if (schemaFileName !== processOnlyThisOneSchemaFile) return
      }
      const schemaFullPathName = path.join(schemaDir, schemaFileName)

      // Some schema files must be ignored.
      if (
        canThisTestBeRun(schemaFileName) &&
        !skipThisFileName(schemaFileName)
      ) {
        const buffer = skipReadFile
          ? undefined
          : fs.readFileSync(schemaFullPathName)
        let jsonObj_
        try {
          jsonObj_ = buffer ? JSON.parse(buffer.toString()) : undefined
        } catch (err) {
          throwWithErrorText([
            `JSON file ${schemaFullPathName} did not parse correctly.`,
            err,
          ])
        }
        const schema = {
          // Return the real Raw file for BOM file test rejection
          rawFile: buffer,
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
  const scanOneTestFolder = (
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
            throwWithErrorText([
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
            throwWithErrorText([
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
            throwWithErrorText([
              `Can't read/decode toml file: ${testFileNameWithPath}`,
              err,
            ])
          }
          break
        default:
          throwWithErrorText([`Unknown file extension: ${fileExtension}`])
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
    if (!fs.existsSync(folderNameAndPath)) {
      return
    }

    // Read all files name inside one test folder
    const filesInsideOneTestFolder = fs.readdirSync(folderNameAndPath).map(
      // Must create a list with full path name
      (fileName) => path.join(folderNameAndPath, fileName),
    )

    if (!filesInsideOneTestFolder.length) {
      throwWithErrorText([
        `Found folder with no test files: ${folderNameAndPath}`,
      ])
    }

    filesInsideOneTestFolder.forEach(function (testFileFullPathName) {
      // forbidden to add extra folder inside the specific test folder
      if (!fs.lstatSync(testFileFullPathName).isFile()) {
        throwWithErrorText([
          `Found non test file inside test folder: ${testFileFullPathName}`,
        ])
      }
      if (!skipThisFileName(path.basename(testFileFullPathName))) {
        const buffer = skipReadFile
          ? undefined
          : fs.readFileSync(testFileFullPathName)
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
    })
    testPassScanDone?.()
  }

  // Callback only for schema file scan. No test files are process here.
  await scanAllSchemaFiles(schemaOnlyScan, true)
  schemaOnlyScanDone?.()

  // process one by one all schema + positive test folders + negative test folders
  await scanAllSchemaFiles(async (callbackParameterFromSchema) => {
    // process one schema
    await schemaForTestScan?.(callbackParameterFromSchema)
    // process positive and negative test folder belonging to the one schema
    const schemaName = callbackParameterFromSchema.jsonName
    scanOneTestFolder(
      schemaName,
      testPositiveDir,
      positiveTestScan,
      positiveTestScanDone,
    )
    scanOneTestFolder(
      schemaName,
      testNegativeDir,
      negativeTestScan,
      negativeTestScanDone,
    )
  }, false)
  schemaForTestScanDone?.()
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
        throwWithErrorText([
          `Schema file must not have ${bom.name} BOM: ${schema.urlOrFilePath}`,
        ])
      }
    }
  }
}

/**
 * @typedef {Object} FactoryAJVParameter
 * @prop {string} schemaName
 * @prop {string[]} unknownFormatsList
 * @prop {boolean} fullStrictMode
 * @prop {boolean} standAloneCode
 * @prop {string[]} standAloneCodeWithMultipleSchema
 */

/**
 * @summary There are multiple AJV versions for each $schema version. This returns
 * the correct AJV instance
 * @param {FactoryAJVParameter} schemaName
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
 * @prop {string[]} unknownFormatsList
 * @prop {string[]} externalSchemaWithPathList
 * @prop {string[]} unknownKeywordsList
 */

/**
 * @summary Gets the option items for a particular `jsonName`
 * @param {string} jsonName
 * @returns {getOptionReturn}
 */
function getOption(jsonName) {
  const options = schemaValidation.options[jsonName]

  // collect the unknownFormat list
  const unknownFormatsList = options?.unknownFormat ?? []

  // collect the unknownKeywords list
  const unknownKeywordsList = options?.unknownKeywords ?? []

  // collect the externalSchema list
  const externalSchemaList = options?.externalSchema ?? []
  const externalSchemaWithPathList = externalSchemaList?.map(
    (schemaFileName) => {
      return path.resolve('.', schemaDir, schemaFileName)
    },
  )

  return {
    unknownFormatsList,
    unknownKeywordsList,
    externalSchemaWithPathList,
  }
}

function ajv() {
  const schemaVersion = showSchemaVersions()
  const textCompile = 'compile              | '
  const textPassSchema = 'pass schema          | '
  const textPositivePassTest = 'pass positive test   | '
  const textPositiveFailedTest = 'failed positive test | '
  const textNegativePassTest = 'pass negative test   | '
  const textNegativeFailedTest = 'failed negative test | '

  let validate
  let countSchema = 0

  const processSchemaFile = (/** @type {Schema} */ schema) => {
    let ajvSelected

    // Get possible options define in schema-validation.json
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
    const fullStrictMode = !schemaValidation.ajvNotStrictMode.includes(
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
      externalSchemaWithPathList.forEach((x) => {
        ajvSelected.addSchema(readJsonFile(x.toString()))
      })

      // What schema draft version is it?
      schemaVersionStr = versionObj ? versionObj.schemaName : 'unknown'

      // compile the schema
      validate = ajvSelected.compile(schemaJson)
    } catch (err) {
      throwWithErrorText([
        `${textCompile}${schema.urlOrFilePath} (${schemaVersionStr})${fullStrictModeStr}`,
        err,
      ])
    }
    countSchema++
    log.writeln()
    log.ok(
      `${textPassSchema}${schema.urlOrFilePath} (${schemaVersionStr})${fullStrictModeStr}`,
    )
  }

  const processTestFile = (schema, success, failure) => {
    validate(schema.jsonObj) ? success() : failure()
  }

  const processPositiveTestFile = (/** @type {Schema} */ schema) => {
    processTestFile(
      schema,
      () => {
        log.ok(`${textPositivePassTest}${schema.urlOrFilePath}`)
      },
      () => {
        throwWithErrorText([
          `${textPositiveFailedTest}${schema.urlOrFilePath}`,
          `(Schema file) keywordLocation: ${validate.errors[0].schemaPath}`,
          `(Test file) instanceLocation:  ${validate.errors[0].instancePath}`,
          `(Message)  ${validate.errors[0].message}`,
          'Error in positive test.',
        ])
      },
    )
  }

  const processNegativeTestFile = (/** @type {Schema} */ schema) => {
    processTestFile(
      schema,
      () => {
        throwWithErrorText([
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

  const processSchemaFileDone = () => {
    log.writeln()
    log.writeln(`Total schemas validated with AJV: ${countSchema}`)
    countSchema = 0
  }

  return {
    testSchemaFile: processSchemaFile,
    testSchemaFileDone: processSchemaFileDone,
    positiveTestFile: processPositiveTestFile,
    negativeTestFile: processNegativeTestFile,
  }
}

function showSchemaVersions() {
  let countSchemaVersionUnknown = 0

  const getObj_ = (schemaJson) => {
    const schemaVersion = schemaJson.$schema
    return SCHEMA_DIALECTS.find((obj) => schemaVersion === obj.url)
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
        // Suppress `JSON.parse` exceptions, leaving obj with value of `undefined`
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
  async function handleInput(schemaName) {
    if (!schemaName || schemaName.endsWith('.json')) {
      rl.question('input: ', handleInput)
      return
    }

    const schemaFile = path.join(schemaDir, schemaName + '.json')
    const testDir = path.join(testPositiveDir, schemaName)
    const testFile = path.join(testDir, `${schemaName}.json`)

    if (fs.existsSync(schemaFile)) {
      throw new Error(`Schema file already exists: ${schemaFile}`)
    }

    console.info(`Creating schema file at 'src/${schemaFile}'...`)
    console.info(`Creating positive test file at 'src/${testFile}'...`)

    await fs.promises.mkdir(path.dirname(schemaFile), { recursive: true })
    await fs.promises.writeFile(
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
    await fs.promises.mkdir(testDir, { recursive: true })
    await fs.promises.writeFile(
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

function taskLint() {
  lintSchemaHasCorrectMetadata()
  lintTopLevelRefIsStandalone()
  lintSchemaNoSmartQuotes()
}

async function taskCheck() {
  // Check filesystem
  assertDirectoryStructureIsValid()
  assertFilenamesHaveCorrectExtensions()
  assertTestFoldersHaveAtLeastOneTestSchema()

  // Check schema-validation.json
  assertSchemaValidationHasNoDuplicateLists()
  assertSchemaValidationJsonHasNoMissingSchemaFiles()
  assertSchemaValidationJsonHasNoUnmatchedUrls()
  assertSchemaValidationJsonHasValidSkipTest()

  // Check catalog.json
  await assertCatalogJsonPassesJsonLint()
  assertCatalogJsonValidatesAgainstJsonSchema()
  assertCatalogJsonHasNoDuplicateNames()
  assertCatalogJsonHasNoPoorlyWordedFields()
  assertCatalogJsonHasCorrectFileMatchPath()
  assertCatalogJsonHasNoFileMatchConflict()
  assertCatalogJsonLocalUrlsMustRefFile()
  assertCatalogJsonIncludesAllSchemas()

  // Check test schema
  assertSchemaHasNoBom()
  assertSchemaHasNoDuplicatedPropertyKeys()
  assertSchemaHasValidSchemaField()
  assertSchemaHasValidIdField()
  assertSchemaPassesSchemaSafeLint()

  printSchemasTestedInFullStrictMode()
  printSchemasWithoutPositiveTestFiles()
  testAjv()
  printUrlCountsInCatalog()
  printCountSchemaVersions()
}

async function taskCheckRemote() {
  await remoteAssertSchemaHasNoBom()
  await remoteTestAjv()
  await remotePrintCountSchemaVersions()
}

async function taskMaintenance() {
  printDowngradableSchemaVersions()
  printStrictAndNotStrictAjvValidatedSchemas()
}

async function taskCoverage() {
  const javaScriptCoverageName = 'schema.json.translated.to.js'
  const javaScriptCoverageNameWithPath = path.join(
    `${temporaryCoverageDir}/${javaScriptCoverageName}`,
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
        externalSchemaWithPathList.forEach((x) => {
          multipleSchema.push(readJsonFile(x.toString()))
        })
        // Also add the 'root' schema
        multipleSchema.push(mainSchema)
      }

      // Get the correct AJV version
      const ajvSelected = factoryAJV({
        schemaName: versionObj?.schemaName,
        unknownFormatsList,
        fullStrictMode: !schemaValidation.ajvNotStrictMode.includes(jsonName),
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
          throwWithErrorText([`Missing $id or id in ${jsonName}`])
        }
        moduleCode = AjvStandalone(ajvSelected)
      } else {
        // Single schema
        mainSchemaJsonId = undefined
        moduleCode = AjvStandalone(ajvSelected, ajvSelected.compile(mainSchema))
      }

      // Prettify the JavaScript module code
      const prettierOptions = await prettier.resolveConfig(process.cwd())
      fs.writeFileSync(
        javaScriptCoverageNameWithPath,
        prettier.format(moduleCode, {
          ...prettierOptions,
          parser: 'babel',
          printWidth: 200,
        }),
      )
      // Now use this JavaScript as validation in the positive and negative test
      validations = readJsonFile(javaScriptCoverageNameWithPath)
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
    throwWithErrorText(['Must start "make" file with --SchemaName parameter.'])
  }
  await generateCoverage(schemaNameToBeCoverage)
  log.ok('OK')
}

function lintSchemaHasCorrectMetadata() {
  let countScan = 0
  let totalMismatchIds = 0
  let totalIncorrectIds = 0
  localSchemaFileAndTestFile(
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

function lintSchemaNoSmartQuotes() {
  let countScan = 0

  localSchemaFileAndTestFile(
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

  log.writeln(`Total files scan: ${countScan}`)
}

function lintTopLevelRefIsStandalone() {
  let countScan = 0
  localSchemaFileAndTestFile(
    {
      schemaOnlyScan(schema) {
        if (schema.jsonObj.$ref?.startsWith('http')) {
          for (const [member] of Object.entries(schema.jsonObj)) {
            if (member !== '$ref') {
              throwWithErrorText([
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

function testAjv() {
  const x = ajv()
  localSchemaFileAndTestFile(
    {
      schemaForTestScan: x.testSchemaFile,
      positiveTestScan: x.positiveTestFile,
      negativeTestScan: x.negativeTestFile,
      schemaForTestScanDone: x.testSchemaFileDone,
    },
    { skipReadFile: false },
  )
  log.ok('local AJV schema passed')
}

async function remoteTestAjv() {
  const x = ajv()
  let countScan = 0
  await remoteSchemaFile((testSchemaFile) => {
    x.testSchemaFile(testSchemaFile)
    countScan++
  })
  log.writeln()
  log.writeln(`Total schemas validated with AJV: ${countScan}`)
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

async function assertCatalogJsonPassesJsonLint() {
  jsonlint.parse(
    await fs.promises.readFile('./src/api/json/catalog.json', 'utf-8'),
    {
      ignoreBOM: false,
      ignoreComments: false,
      ignoreTrailingCommas: false,
      allowSingleQuotedStrings: false,
      allowDuplicateObjectKeys: false,
    },
  )
}

function assertCatalogJsonValidatesAgainstJsonSchema() {
  const catalogSchema = readJsonFile(
    path.join(schemaDir, 'schema-catalog.json'),
  )
  const ajvInstance = factoryAJV({ schemaName: 'draft-04' })
  if (ajvInstance.validate(catalogSchema, catalog)) {
    log.ok('catalog.json OK')
  } else {
    throwWithErrorText([
      `(Schema file) keywordLocation: ${ajvInstance.errors[0].schemaPath}`,
      `(Catalog file) instanceLocation: ${ajvInstance.errors[0].instancePath}`,
      `(message) instanceLocation: ${ajvInstance.errors[0].message}`,
      '"Catalog ERROR"',
    ])
  }
}

function assertCatalogJsonHasNoDuplicateNames() {
  /** @type {string[]} */
  const schemaNames = catalog.schemas.map((entry) => entry.name)
  /** @type {string[]} */
  const duplicateSchemaNames = []

  for (const schemaName of schemaNames) {
    const matches = schemaNames.filter((item) => item === schemaName)
    if (matches.length > 1 && !duplicateSchemaNames.includes(schemaName)) {
      duplicateSchemaNames.push(schemaName)
    }
  }

  if (duplicateSchemaNames.length > 0) {
    throwWithErrorText([
      `Found duplicates: ${JSON.stringify(duplicateSchemaNames)}`,
    ])
  }
}

function assertCatalogJsonHasNoPoorlyWordedFields() {
  let countScan = 0

  for (const entry of catalog.schemas) {
    if (
      schemaValidation.catalogEntryNoLintNameOrDescription.includes(entry.url)
    ) {
      continue
    }

    const schemaName = new URL(entry.url).pathname.slice(1)

    for (const property of ['name', 'description']) {
      if (
        /$[,. \t-]/u.test(entry?.[property]) ||
        /[,. \t-]$/u.test(entry?.[property])
      ) {
        ++countScan

        throwWithErrorText([
          `Catalog entry .${property}: Should not start or end with punctuation or whitespace (${schemaName})`,
        ])
      }
    }

    for (const property of ['name', 'description']) {
      if (entry?.[property]?.toLowerCase()?.includes('schema')) {
        ++countScan

        throwWithErrorText([
          `Catalog entry .${property}: Should not contain the string 'schema'. In most cases, this word is extraneous and the meaning is implied (${schemaName})`,
        ])
      }
    }

    for (const property of ['name', 'description']) {
      if (entry?.[property]?.toLowerCase()?.includes('\n')) {
        ++countScan

        throwWithErrorText([
          `Catalog entry .${property}: Should not contain a newline character. In editors like VSCode, the newline is not rendered. (${schemaName})`,
        ])
      }
    }
  }

  log.writeln(`Total found files: ${countScan}`)
}

function assertCatalogJsonHasCorrectFileMatchPath() {
  for (const schema of catalog.schemas) {
    schema.fileMatch?.forEach((fileMatchItem) => {
      if (fileMatchItem.includes('/')) {
        // A folder must start with **/
        if (!fileMatchItem.startsWith('**/')) {
          throwWithErrorText([
            `fileMatch with directory must start with "**/" => ${fileMatchItem}`,
          ])
        }
      }
    })
  }
  log.ok('fileMatch path OK')
}

function assertCatalogJsonHasNoFileMatchConflict() {
  const fileMatchConflict = schemaValidation.fileMatchConflict
  let fileMatchCollection = []
  // Collect all the "fileMatch" and put it in fileMatchCollection[]
  for (const schema of catalog.schemas) {
    const fileMatchArray = schema.fileMatch
    if (fileMatchArray) {
      // Check if this is already present in the "fileMatchConflict" list. If so then remove it from filtered[]
      const filtered = fileMatchArray.filter((fileMatch) => {
        return !fileMatchConflict.includes(fileMatch)
      })
      // Check if fileMatch is already present in the fileMatchCollection[]
      filtered.forEach((fileMatch) => {
        if (fileMatchCollection.includes(fileMatch)) {
          throwWithErrorText([`Duplicate fileMatch found => ${fileMatch}`])
        }
      })
      fileMatchCollection = fileMatchCollection.concat(filtered)
    }
  }
  log.ok('No new fileMatch conflict detected.')
}

function assertCatalogJsonLocalUrlsMustRefFile() {
  const urlRecommendation = 'https://json.schemastore.org/<schemaName>.json'
  let countScan = 0

  getUrlFromCatalog((catalogUrl) => {
    const SchemaStoreHost = 'json.schemastore.org'
    // URL host that does not have SchemaStoreHost is an external schema.local_assert_catalog.json_local_url_must_ref_file
    const URLcheck = new URL(catalogUrl)
    if (!SchemaStoreHost.includes(URLcheck.host)) {
      // This is an external schema.
      return
    }
    countScan++
    // Check if local URLs have .json extension
    const filenameMustBeAtThisUrlDepthPosition = 3
    const filename = catalogUrl.split('/')[filenameMustBeAtThisUrlDepthPosition]
    if (!filename?.endsWith('.json')) {
      throwWithErrorText([
        `Wrong: ${catalogUrl} Missing ".json" extension.`,
        `Must be in this format: ${urlRecommendation}`,
      ])
    }
    // Check if schema file exist or not.
    if (fs.existsSync(path.resolve('.', schemaDir, filename)) === false) {
      throwWithErrorText([
        `The catalog have this URL: ${catalogUrl}`,
        `But there is no schema file present: ${filename}`,
      ])
    }
  })
  log.ok(`All local url tested OK. Total: ${countScan}`)
}

function assertCatalogJsonIncludesAllSchemas() {
  let countScan = 0
  const allCatalogLocalJsonFiles = []

  // Read all the JSON file name from catalog and add it to allCatalogLocalJsonFiles[]
  getUrlFromCatalog((catalogUrl) => {
    // No need to validate the local URL correctness. It is already done in "local_assert_catalog.json_local_url_must_ref_file"
    // Only scan for local schema.
    if (catalogUrl.startsWith(urlSchemaStore)) {
      const filename = catalogUrl.split('/').pop()
      allCatalogLocalJsonFiles.push(filename)
    }
  })

  // Check if allCatalogLocalJsonFiles[] have the actual schema filename.
  const schemaFileCompare = (x) => {
    // skip testing if present in "missingCatalogUrl"
    if (!schemaValidation.missingCatalogUrl.includes(x.jsonName)) {
      countScan++
      const found = allCatalogLocalJsonFiles.includes(x.jsonName)
      if (!found) {
        throwWithErrorText([
          'Schema file name must be present in the catalog URL.',
          `${x.jsonName} must be present in src/api/json/catalog.json`,
        ])
      }
    }
  }
  // Get all the JSON files for AJV
  localSchemaFileAndTestFile(
    { schemaOnlyScan: schemaFileCompare },
    { fullScanAllFiles: true },
  )
  log.ok(`All local schema files have URL link in catalog. Total: ${countScan}`)
}

function assertSchemaValidationHasNoDuplicateLists() {
  function checkForDuplicateInList(list, listName) {
    if (list) {
      if (new Set(list).size !== list.length) {
        throwWithErrorText([`Duplicate item found in ${listName}`])
      }
    }
  }
  checkForDuplicateInList(
    schemaValidation.ajvNotStrictMode,
    'ajvNotStrictMode[]',
  )
  checkForDuplicateInList(schemaValidation.skiptest, 'skiptest[]')
  checkForDuplicateInList(
    schemaValidation.missingCatalogUrl,
    'missingCatalogUrl[]',
  )
  checkForDuplicateInList(
    schemaValidation.catalogEntryNoLintNameOrDescription,
    'catalogEntryNoLintNameOrDescription[]',
  )
  checkForDuplicateInList(
    schemaValidation.fileMatchConflict,
    'fileMatchConflict[]',
  )
  checkForDuplicateInList(
    schemaValidation.highSchemaVersion,
    'highSchemaVersion[]',
  )

  // Check for duplicate in options[]
  const checkList = []
  for (const schemaName in schemaValidation.options) {
    if (checkList.includes(schemaName)) {
      throwWithErrorText([
        `Duplicate schema name found in options[] schema-validation.json => ${schemaName}`,
      ])
    }
    // Check for all values inside one option object
    const optionValues = schemaValidation.options[schemaName]
    checkForDuplicateInList(
      optionValues?.unknownKeywords,
      `${schemaName} unknownKeywords[]`,
    )
    checkForDuplicateInList(
      optionValues?.unknownFormat,
      `${schemaName} unknownFormat[]`,
    )
    checkForDuplicateInList(
      optionValues?.externalSchema,
      `${schemaName} externalSchema[]`,
    )
    checkList.push(schemaName)
  }

  log.ok('OK')
}

function assertSchemaValidationJsonHasNoMissingSchemaFiles() {
  let countSchemaValidationItems = 0
  const x = (list) => {
    list.forEach((schemaName) => {
      if (schemaName.endsWith('.json')) {
        countSchemaValidationItems++
        if (!schemasToBeTested.includes(schemaName)) {
          throwWithErrorText([
            `No schema ${schemaName} found in schema folder => ${schemaDir}`,
          ])
        }
      }
    })
  }
  x(schemaValidation.ajvNotStrictMode)
  x(schemaValidation.skiptest)
  x(schemaValidation.missingCatalogUrl)
  x(schemaValidation.highSchemaVersion)

  for (const schemaName in schemaValidation.options) {
    if (schemaName !== 'readme_example.json') {
      countSchemaValidationItems++
      if (!schemasToBeTested.includes(schemaName)) {
        throwWithErrorText([
          `No schema ${schemaName} found in schema folder => ${schemaDir}`,
        ])
      }
    }
  }
  log.ok(
    `Total schema-validation.json items check: ${countSchemaValidationItems}`,
  )
}

function assertSchemaValidationJsonHasNoUnmatchedUrls() {
  let totalItems = 0

  const x = (/** @type {string[]} */ schemaUrls) => {
    schemaUrls.forEach((schemaUrl) => {
      ++totalItems

      const catalogUrls = catalog.schemas.map((item) => item.url)
      if (!catalogUrls.includes(schemaUrl)) {
        throwWithErrorText([
          `No schema with URL '${schemaUrl}' found in catalog.json`,
        ])
      }
    })
  }

  x(schemaValidation.catalogEntryNoLintNameOrDescription)

  log.ok(`Total schema-validation.json items checked: ${totalItems}`)
}

function assertSchemaValidationJsonHasValidSkipTest() {
  let countSchemaValidationItems = 0
  const x = (list, listName) => {
    list.forEach((schemaName) => {
      if (schemaName.endsWith('.json')) {
        countSchemaValidationItems++
        if (schemaValidation.skiptest.includes(schemaName)) {
          throwWithErrorText([
            `Disabled/skiptest[] schema: ${schemaName} found in => ${listName}[]`,
          ])
        }
      }
    })
  }
  x(schemaValidation.ajvNotStrictMode, 'ajvNotStrictMode')
  x(schemaValidation.missingCatalogUrl, 'missingCatalogUrl')
  x(schemaValidation.highSchemaVersion, 'highSchemaVersion')

  for (const schemaName in schemaValidation.options) {
    if (schemaName !== 'readme_example.json') {
      countSchemaValidationItems++
      if (schemaValidation.skiptest.includes(schemaName)) {
        throwWithErrorText([
          `Disabled/skiptest[] schema: ${schemaName} found in => options[]`,
        ])
      }
    }
  }

  // Test folder must not exist if defined in skiptest[]
  schemaValidation.skiptest.forEach((schemaName) => {
    countSchemaValidationItems++

    const folderName = schemaName.replace('.json', '')

    if (foldersPositiveTest.includes(folderName)) {
      throwWithErrorText([
        `Disabled/skiptest[] schema: ${schemaName} cannot have positive test folder`,
      ])
    }
    if (foldersNegativeTest.includes(folderName)) {
      throwWithErrorText([
        `Disabled/skiptest[] schema: ${schemaName} cannot have  negative test folder`,
      ])
    }
  })
  log.ok(
    `Total schema-validation.json items check: ${countSchemaValidationItems}`,
  )
}

function assertTestFoldersHaveAtLeastOneTestSchema() {
  let countTestFolders = 0
  const x = (listFolders) => {
    listFolders.forEach((folderName) => {
      if (!skipThisFileName(folderName)) {
        countTestFolders++
        if (!schemasToBeTested.includes(folderName + '.json')) {
          throwWithErrorText([
            `No schema ${folderName}.json found for test folder => ${folderName}`,
          ])
        }
      }
    })
  }
  x(foldersPositiveTest)
  x(foldersNegativeTest)
  log.ok(`Total test folders: ${countTestFolders}`)
}

function assertSchemaHasNoBom() {
  let countScan = 0

  localSchemaFileAndTestFile(
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

function assertSchemaHasNoDuplicatedPropertyKeys() {
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
      jsonlint.parse(schema.rawFile, {
        ignoreBOM: false,
        ignoreComments: false,
        ignoreTrailingCommas: false,
        allowSingleQuotedStrings: false,
        allowDuplicateObjectKeys: false,
      })
    } catch (err) {
      throwWithErrorText([`Test file: ${schema.urlOrFilePath}`, err])
    }
  }
  localSchemaFileAndTestFile(
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

function assertSchemaHasValidSchemaField() {
  let countScan = 0

  localSchemaFileAndTestFile(
    {
      schemaOnlyScan(schema) {
        countScan++

        const validSchemas = SCHEMA_DIALECTS.map(
          (schemaDialect) => schemaDialect.url,
        )
        if (!validSchemas.includes(schema.jsonObj.$schema)) {
          throwWithErrorText([
            `Schema file has invalid or missing '$schema' keyword => ${schema.jsonName}`,
            `Valid schemas: ${JSON.stringify(validSchemas)}`,
          ])
        }

        if (!schemaValidation.highSchemaVersion.includes(schema.jsonName)) {
          const tooHighSchemas = SCHEMA_DIALECTS.filter(
            (schemaDialect) => schemaDialect.isTooHigh,
          ).map((schemaDialect) => schemaDialect.url)
          if (tooHighSchemas.includes(schema.jsonObj.$schema)) {
            throwWithErrorText([
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

function assertSchemaHasValidIdField() {
  let countScan = 0

  localSchemaFileAndTestFile(
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
            throwWithErrorText([
              `Missing property 'id' for schema 'src/schemas/json/${schema.jsonName}'`,
            ])
          }
          schemaId = schema.jsonObj.id
        } else {
          if (schema.jsonObj.$id === undefined) {
            throwWithErrorText([
              `Missing property '$id' for schema 'src/schemas/json/${schema.jsonName}'`,
            ])
          }
          schemaId = schema.jsonObj.$id
        }

        if (
          !schemaId.startsWith('https://') &&
          !schemaId.startsWith('http://')
        ) {
          throwWithErrorText([
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

function assertSchemaPassesSchemaSafeLint() {
  if (!argv.lint) {
    return
  }
  let countScan = 0
  localSchemaFileAndTestFile(
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

function assertFilenamesHaveCorrectExtensions() {
  const schemaFileExtension = ['.json']
  const testFileExtension = ['.json', '.yml', '.yaml', '.toml']
  let countScan = 0
  const x = (data, fileExtensionList) => {
    countScan++
    const found = fileExtensionList.find((x) => data.jsonName.endsWith(x))
    if (!found) {
      throwWithErrorText([
        `Filename must have ${fileExtensionList} extension => ${data.urlOrFilePath}`,
      ])
    }
  }
  localSchemaFileAndTestFile(
    {
      schemaForTestScan: (schema) => x(schema, schemaFileExtension),
      positiveTestScan: (schema) => x(schema, testFileExtension),
      negativeTestScan: (schema) => x(schema, testFileExtension),
    },
    {
      fullScanAllFiles: true,
    },
  )
  log.ok(
    `All schema and test filename have the correct file extension. Total files scan: ${countScan}`,
  )
}

function assertDirectoryStructureIsValid() {
  schemasToBeTested.forEach((name) => {
    if (
      !skipThisFileName(name) &&
      !fs.lstatSync(path.join(schemaDir, name)).isFile()
    ) {
      throwWithErrorText([
        `There can only be files in directory : ${schemaDir} => ${name}`,
      ])
    }
  })

  foldersPositiveTest.forEach((name) => {
    if (
      !skipThisFileName(name) &&
      !fs.lstatSync(path.join(testPositiveDir, name)).isDirectory()
    ) {
      throwWithErrorText([
        `There can only be directory's in :${testPositiveDir} => ${name}`,
      ])
    }
  })

  foldersNegativeTest.forEach((name) => {
    if (
      !skipThisFileName(name) &&
      !fs.lstatSync(path.join(testNegativeDir, name)).isDirectory()
    ) {
      throwWithErrorText([
        `There can only be directory's in :${testNegativeDir} => ${name}`,
      ])
    }
  })
  log.ok('OK')
}

function printCountSchemaVersions() {
  const x = showSchemaVersions()
  localSchemaFileAndTestFile(
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
    catalogUrl.startsWith(urlSchemaStore)
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

function printStrictAndNotStrictAjvValidatedSchemas() {
  const schemaVersion = showSchemaVersions()
  const schemaInFullStrictMode = []
  const schemaInNotStrictMode = []
  const checkIfThisSchemaIsAlreadyInStrictMode = (
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
    externalSchemaWithPathList.forEach((x) => {
      ajvSelected.addSchema(readJsonFile(x.toString()))
    })

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
    log.writeln('------------------------------------')
    log.writeln(`Schemas in ${mode} strict mode:`)
    list.forEach((schemaName) => {
      // Write it is JSON list format. For easy copy to schema-validation.json
      log.writeln(`"${schemaName}",`)
    })
    log.ok(`Total schemas check ${mode} strict mode: ${list.length}`)
  }

  localSchemaFileAndTestFile(
    {
      schemaOnlyScan: checkIfThisSchemaIsAlreadyInStrictMode,
    },
    { skipReadFile: false },
  )

  listSchema('Full', schemaInFullStrictMode)
  listSchema('Not', schemaInNotStrictMode)
  log.writeln()
  log.writeln('------------------------------------')
  log.ok(
    `Total all schemas check: ${
      schemaInFullStrictMode.length + schemaInNotStrictMode.length
    }`,
  )
}

function printDowngradableSchemaVersions() {
  let countScan = 0

  /**
   * @param {string} schemaJson
   * @param {string} schemaName
   * @param {getOptionReturn} option
   */
  const validateViaAjv = (schemaJson, schemaName, option) => {
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
      option.externalSchemaWithPathList.forEach((x) => {
        ajvSelected.addSchema(readJsonFile(x.toString()))
      })

      ajvSelected.compile(schemaJson)
      return true
    } catch {
      return false
    }
  }

  // There are no positive or negative test processes here.
  // Only the schema files are tested.
  const testLowerSchemaVersion = (/** @type {Schema} */ schema) => {
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
      result = validateViaAjv(
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

  log.writeln()
  log.ok(
    'Check if a lower $schema version will also pass the schema validation test',
  )
  localSchemaFileAndTestFile(
    { schemaOnlyScan: testLowerSchemaVersion },
    { skipReadFile: false },
  )
  log.writeln()
  log.ok(`Total files scan: ${countScan}`)
}

function printSchemasTestedInFullStrictMode() {
  let countSchemaScanViaAJV = 0
  localSchemaFileAndTestFile({
    schemaOnlyScan() {
      countSchemaScanViaAJV++
    },
  })
  // If only ONE AJV schema test is run then this calculation does not work.
  if (countSchemaScanViaAJV !== 1) {
    const countFullStrictSchema =
      countSchemaScanViaAJV - schemaValidation.ajvNotStrictMode.length
    const percent = (countFullStrictSchema / countSchemaScanViaAJV) * 100
    log.ok(
      'Schema in full strict mode to prevent any unexpected behaviours or silently ignored mistakes in user schemas.',
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
  schemasToBeTested.forEach((schemaFileName) => {
    if (!foldersPositiveTest.includes(schemaFileName.replace('.json', ''))) {
      countMissingTest++
      log.ok(`(No positive test file present): ${schemaFileName}`)
    }
  })
  if (countMissingTest > 0) {
    const percent = (countMissingTest / schemasToBeTested.length) * 100
    log.writeln()
    log.writeln(`${Math.round(percent)}% of schemas do not have tests.`)
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
