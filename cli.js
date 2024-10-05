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
// import spectralCore from '@stoplight/spectral-core'
// import Parsers from '@stoplight/spectral-parsers'
// import spectralRuntime from '@stoplight/spectral-runtime' // eslint-disable-line n/no-extraneous-import
// import { bundleAndLoadRuleset } from '@stoplight/spectral-ruleset-bundler/with-loader'
import schemasafe from '@exodus/schemasafe'
import TOML from 'smol-toml'
import YAML from 'yaml'
import jsonlint from '@prantlf/jsonlint'
import * as jsoncParser from 'jsonc-parser'
import ora from 'ora'
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

/** @type {{ _: string[], help?: boolean, SchemaName?: string, 'schema-name'?: string, 'unstable-check-with'?: string }} */
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
 * @property {string[]} fileMatch
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
 * @typedef {Object} ForEachTestFile
 * @property {(arg0: SchemaFile) => Promise<any>} [onSchemaFile]
 * @property {(arg0: SchemaFile, arg1: DataFile, data: any) => Promise<void>} [onPositiveTestFile]
 * @property {(arg0: SchemaFile, arg1: DataFile, data: any) => Promise<void>} [onNegativeTestFile]
 * @property {(arg0: SchemaFile) => Promise<void>} [afterSchemaFile]
 */
async function forEachFile(/** @type {ForEachTestFile} */ obj) {
  for (const dirent1 of await fs.readdir(SchemaDir, { withFileTypes: true })) {
    const schemaName = dirent1.name
    const schemaId = schemaName.replace('.json', '')

    if (argv['schema-name'] && argv['schema-name'] !== schemaName) {
      continue
    }

    if (SchemaValidation.skiptest.includes(schemaName)) {
      continue
    }

    const schemaPath = path.join(SchemaDir, schemaName)
    const schema = await toSchemaFile(schemaPath)
    const data = await obj?.onSchemaFile?.(schema)

    if (obj?.onPositiveTestFile) {
      const positiveTestDir = path.join(TestPositiveDir, schemaId)
      if (await exists(positiveTestDir)) {
        for (const testfile of await fs.readdir(positiveTestDir)) {
          const testfilePath = path.join(TestPositiveDir, schemaId, testfile)
          let file = await toTestFile(testfilePath)
          await obj.onPositiveTestFile(schema, file, data)
        }
      }
    }

    if (obj?.onNegativeTestFile) {
      const negativeTestDir = path.join(TestNegativeDir, schemaId)
      if (await exists(negativeTestDir)) {
        for (const testfile of await fs.readdir(negativeTestDir)) {
          const testfilePath = path.join(TestNegativeDir, schemaId, testfile)
          let file = await toTestFile(testfilePath)
          await obj.onNegativeTestFile(schema, file, data)
        }
      }
    }

    await obj?.afterSchemaFile?.(schema)
  }

  async function toTestFile(/** @type {string} */ testfilePath) {
    const buffer = await fs.readFile(testfilePath)
    const text = buffer.toString()
    return {
      buffer,
      text,
      json: await readDataFile({ filepath: testfilePath, text }),
      path: testfilePath,
    }
  }
}

async function toSchemaFile(/** @type {string} */ schemaPath) {
  const buffer = await fs.readFile(schemaPath)
  const text = buffer.toString()
  return {
    buffer,
    text,
    json: await readDataFile({ filepath: schemaPath, text }),
    name: path.basename(schemaPath),
    path: schemaPath,
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
        printErrorAndExit(err, [`Failed to parse JSON file "${obj.filepath}"`])
      }
      break
    case '.yaml':
    case '.yml':
      try {
        return YAML.parse(obj.text)
      } catch (err) {
        printErrorAndExit(err, [`Failed to parse YAML file "${obj.filepath}"`])
      }
      break
    case '.toml':
      try {
        return TOML.parse(obj.text)
      } catch (err) {
        printErrorAndExit(err, [`Failed to parse TOML file "${obj.filepath}"`])
      }
      break
    default:
      printErrorAndExit(new Error(), [
        `Unable to handle file extension "${fileExtension}" for file "${obj.filepath}"`,
      ])
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
  process.stderr.write(error instanceof Error ? (error?.stack ?? '') : '')
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
  for (const unknownKeyword of unknownKeywords) {
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
  await forEachFile({
    async onSchemaFile(schema) {
      await assertSchemaHasCorrectMetadata(schema)
      await assertTopLevelRefIsStandalone(schema)
      await assertSchemaNoSmartQuotes(schema)

      console.info(
        `Running ${chalk.bold('SchemaSafe validation')} on file: ${schema.path}`,
      )

      const errors = schemasafe.lint(schema.json, {
        mode: 'strong',
        extraFormats: false,
        schemas: {},
      })

      for (const err of errors) {
        console.log(`${schema.name}: ${err.message}`)
      }
    },
  })

  // await forEachFile({
  //   async onSchemaFile(schema) {
  //     console.info(
  //       `Running ${chalk.bold('Spectral validation')} on file: ${schema.path}`,
  //     )
  //
  //     const doc = new spectralCore.Document(
  //       schema.text,
  //       Parsers.Json,
  //       schema.name,
  //     )
  //     const spectral = new spectralCore.Spectral()
  //
  //     const schemaDialect = getSchemaDialect(schema.json.$schema)
  //
  //     let spectralFile
  //     if (schemaDialect.draftVersion === 'draft-04') {
  //       spectralFile = 'config/.spectral-draft04.yaml'
  //     } else if (schemaDialect.draftVersion === 'draft-06') {
  //       spectralFile = 'config/.spectral-draft06.yaml'
  //     } else if (schemaDialect.draftVersion === 'draft-07') {
  //       spectralFile = 'config/.spectral-draft07.yaml'
  //     } else {
  //       throw new Error(
  //         `Unsupported schema version: ${schemaDialect.draftVersion}`,
  //       )
  //     }
  //
  //     spectral.setRuleset(
  //       await bundleAndLoadRuleset(path.join(process.cwd(), spectralFile), {
  //         fs: fsCb,
  //         fetch: spectralRuntime.fetch,
  //       }),
  //     )
  //
  //     const result = await spectral.run(doc)
  //     if (result.length > 0) {
  //       console.log(result)
  //     }
  //   },
  // })
}

async function taskCheck() {
  console.info(`===== VALIDATE PRECONDITIONS =====`)
  await assertFileSystemIsValid()

  // Check catalog.json.
  await assertFileValidatesAgainstSchema(
    CatalogFile,
    path.join(SchemaDir, 'schema-catalog.json'),
  )
  await assertFilePassesJsonLint(CatalogFile)
  assertCatalogJsonHasNoDuplicateNames()
  assertCatalogJsonHasNoBadFields()
  assertCatalogJsonHasNoFileMatchConflict()
  await assertCatalogJsonLocalUrlsMustRefFile()
  await assertCatalogJsonIncludesAllSchemas()

  // Check schema-validation.jsonc.
  await assertFileValidatesAgainstSchema(
    SchemaValidationFile,
    './src/schema-validation.schema.json',
  )
  await assertFilePassesJsonLint(SchemaValidationFile, {
    ignoreComments: true,
  })
  await assertSchemaValidationJsonReferencesNoNonexistentFiles()
  assertSchemaValidationJsonHasValidSkipTest()

  // Run pre-checks (checks before JSON Schema validation) on all files
  console.info(`===== VALIDATE SCHEMAS =====`)
  const spinner = ora().start()
  await forEachFile({
    async onSchemaFile(schema) {
      spinner.text = `Running pre-check on file: ${schema.path}`

      assertFileHasNoBom(schema)
      assertFileHasCorrectExtensions(schema.path, ['.json'])
      await assertFileHasNoDuplicatedPropertyKeys(schema)
      await assertSchemaHasValidIdField(schema)
      await assertSchemaHasValidSchemaField(schema)
    },
    async onPositiveTestFile(file) {
      assertFileHasNoBom(file)
      assertFileHasCorrectExtensions(file.path, [
        '.json',
        '.yml',
        '.yaml',
        '.toml',
      ])
      await assertFileHasNoDuplicatedPropertyKeys(file)
    },
    async onNegativeTestFile(file) {
      assertFileHasNoBom(file)
      assertFileHasCorrectExtensions(file.path, [
        '.json',
        '.yml',
        '.yaml',
        '.toml',
      ])
      await assertFileHasNoDuplicatedPropertyKeys(file)
    },
  })
  spinner.stop()
  console.info(`✔️ Schemas: All pre-checks succeeded`)

  // Run tests against JSON schemas
  spinner.start('Testing schema with Ajv')
  await forEachFile({
    async onSchemaFile(schemaFile) {
      spinner.text = `Running Ajv validation test on file: ${schemaFile.path}`

      const isFullStrictMode = !SchemaValidation.ajvNotStrictMode.includes(
        schemaFile.name,
      )
      const schemaDialect = getSchemaDialect(schemaFile.json.$schema)
      const options = getSchemaOptions(schemaFile.name)
      const ajv = await ajvFactory({
        draftVersion: schemaDialect.draftVersion,
        fullStrictMode: isFullStrictMode,
        unknownFormats: options.unknownFormats,
        unknownKeywords: options.unknownKeywords,
        unknownSchemas: options.unknownSchemas,
      })

      let validateFn
      try {
        validateFn = ajv.compile(schemaFile.json)
      } catch (err) {
        spinner.fail()
        printErrorAndExit(err, [
          `Failed to compile schema file ${schemaFile.path}`,
        ])
      }

      return {
        validateFn,
      }
    },
    async onPositiveTestFile(schemaFile, testFile, data) {
      const validate = data.validateFn
      if (!validate(testFile.json)) {
        spinner.fail()
        printErrorAndExit(
          validate.err,
          [
            `Schema validation failed ./${testFile.path}`,
            `Showing first error out of ${validate.errors?.length ?? '?'} total error(s)`,
          ],
          util.formatWithOptions(
            { colors: true },
            '%O',
            validate.errors?.[0] ?? '???',
          ),
        )
      }
    },
    async onNegativeTestFile(schemaFile, testFile, data) {
      const validate = data.validateFn
      if (validate(testFile.json)) {
        spinner.fail()
        printErrorAndExit(new Error(), [
          `Schema validation succeeded but was supposed to fail ./${testFile.path}`,
          `For schema ${schemaFile.path}`,
        ])
      }
    },
  })
  spinner.stop()
  console.info(`✔️ Schemas: All Ajv validation tests succeeded`)

  // Print information.
  console.info(`===== REPORT =====`)
  await printSimpleStatistics()
  await printCountSchemaVersions()
}

async function taskCheckStrict() {
  const spinner = ora().start()
  spinner.start('Testing schema with unofficial draft-07 strict metaschema')

  const ajv = await ajvFactory({
    draftVersion: 'draft-07',
    fullStrictMode: false,
  })
  const metaSchemaFile = await toSchemaFile(
    './src/schemas/json/metaschema-draft-07-unofficial-strict.json',
  )
  let validateFn
  try {
    validateFn = ajv.compile(metaSchemaFile.json)
  } catch (err) {
    spinner.fail()
    printErrorAndExit(err, [
      `Failed to compile schema file ${metaSchemaFile.path}`,
    ])
  }

  await forEachFile({
    async onSchemaFile(schemaFile) {
      spinner.text = `Running Ajv with unofficial draft-07 strict metaschema on file: ${schemaFile.path}`

      const validate = validateFn
      if (!validate(schemaFile.json)) {
        spinner.fail()
        printErrorAndExit(
          validate.err,
          [
            `Schema validation failed ./${schemaFile.path}`,
            `Showing first error out of ${validate.errors?.length ?? '?'} total error(s)`,
          ],
          util.formatWithOptions(
            { colors: true },
            '%O',
            validate.errors?.[0] ?? '???',
          ),
        )
      }
    },
  })
  spinner.stop()
  console.info(
    `✔️ Schemas: All unofficial draft-07 strict metaschema validation tests succeeded`,
  )

  // Print information.
  console.info(`===== REPORT =====`)
  await printSimpleStatistics()
  await printCountSchemaVersions()
}

async function taskCheckRemote() {
  console.info('TODO')
}

async function taskReport() {
  await printSchemaReport()
}

async function taskMaintenance() {
  await printDowngradableSchemaVersions()
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
        printErrorAndExit(new Error(), [
          `Expected "fileMatch" value of "${fileGlob}" to be unique across all "fileMatch" properties in file "${CatalogFile}"`,
        ])
      }

      allFileMatches.push(fileGlob)
    }
  }

  console.info('✔️ catalog.json has no duplicate "fileMatch" values')
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

  console.info(`✔️ catalog.json has no invalid schema URLs`)
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

  console.info(`✔️ catalog.json has all local entries that exist in file total`)
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

  console.info(`✔️ schema-validation.jsonc has no invalid skiptest[] entries`)
}

function assertFileHasCorrectExtensions(
  /** @type {string} */ pathname,
  /** @type {string[]} */ allowedExtensions,
) {
  if (!allowedExtensions.includes(path.parse(pathname).ext)) {
    printErrorAndExit(new Error(), [
      `Expected schema file "${pathname}" to have a valid file extension`,
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
          `File must not have ${bom.name} BOM: ${file.path}`,
        ])
      }
    }
  }
}

async function assertFilePassesJsonLint(
  /** @type {string} */ filepath,
  /** @type {Record<string, unknown>} */ options,
) {
  try {
    jsonlint.parse(await fs.readFile(filepath, 'utf-8'), {
      ignoreBOM: false,
      ignoreComments: false,
      ignoreTrailingCommas: false,
      allowSingleQuotedStrings: false,
      allowDuplicateObjectKeys: false,
      ...options,
    })
    console.info(`✔️ ${path.basename(filepath)} validates with jsonlint`)
  } catch (err) {
    printErrorAndExit(err, [
      `Failed strict jsonlint parse of file "${path.basename(filepath)}"`,
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
    printErrorAndExit(
      new Error(),
      [
        `Failed to validate file "${path.basename(filepath)}" against schema file "${schemaFilepath}"`,
        `Showing first error out of ${ajv.errors?.length ?? '?'} total error(s)`,
      ],
      util.formatWithOptions({ colors: true }, '%O', ajv.errors?.[0] ?? '???'),
    )
  }
}

async function assertFileHasNoDuplicatedPropertyKeys(
  /** @type {DataFile} */ file,
) {
  const fileExtension = file.path.split('.').pop()
  if (fileExtension !== 'json') return

  try {
    jsonlint.parse(file.text, {
      ignoreBOM: false,
      ignoreComments: false,
      ignoreTrailingCommas: false,
      allowSingleQuotedStrings: false,
      allowDuplicateObjectKeys: false,
    })
  } catch (err) {
    printErrorAndExit(err, [`Failed to parse file with jsonlint: ${file.path}`])
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
      printErrorAndExit(new Error(), [
        `Expected to find correct metadata on schema file "${schema.path}"`,
        `Bad property of '$id'; expected 'id' for this schema version`,
      ])
    }

    if (schema.json.id !== `https://json.schemastore.org/${schema.name}`) {
      printErrorAndExit(new Error(), [
        `Expected to find correct metadata on schema file "${schema.path}"`,
        `Incorrect property 'id' for schema 'src/schemas/json/${schema.name}'`,
        `Expected value of "https://json.schemastore.org/${schema.name}"`,
        `Found value of "${schema.json.id}"`,
      ])
    }
  } else {
    if (schema.json.id) {
      printErrorAndExit(new Error(), [
        `Expected to find correct metadata on schema file "${schema.path}"`,
        `Bad property of 'id'; expected '$id' for this schema version`,
      ])
    }

    if (schema.json.$id !== `https://json.schemastore.org/${schema.name}`) {
      printErrorAndExit(new Error(), [
        `Expected to find correct metadata on schema file "${schema.path}"`,
        `Incorrect property '$id' for schema 'src/schemas/json/${schema.name}'`,
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

    const smartQuotes = ['‘', '’', '“', '”']
    for (const quote of smartQuotes) {
      if (line.includes(quote)) {
        printErrorAndExit(new Error(), [
          `Schema file should not have a smart quote: ${schema.path}:${++i}`,
        ])
      }
    }
  }
}

async function assertTopLevelRefIsStandalone(/** @type {SchemaFile} */ schema) {
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

async function printSchemaReport() {
  // `bowtie validate --implementation go-gojsonschema ./src/schemas/json/ava.json ./src/test/ava/ava.config.json`
  console.log('TODO')
}

async function printCountSchemaVersions() {
  /** @type {Map<string, number>} */
  const schemaDialectCounts = new Map(
    SchemaDialects.map((schemaDialect) => [schemaDialect.url, 0]),
  )

  await forEachFile({
    async onSchemaFile(/** @type {SchemaFile} */ schema) {
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

  for (const schemaDialect of SchemaDialects) {
    const versionPadded = schemaDialect.draftVersion.startsWith('draft-')
      ? schemaDialect.draftVersion
      : ` ${schemaDialect.draftVersion}`

    console.info(
      `Total schemas using ${versionPadded}: ${schemaDialectCounts.get(schemaDialect.url)}`,
    )
  }
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
  let totalSchemas = 0
  let validatingInStrictMode = 0
  let missingPositiveTests = 0
  let missingNegativeTests = 0

  for (const schemaName of SchemasToBeTested) {
    if (SchemaValidation.skiptest.includes(schemaName)) {
      continue
    }

    totalSchemas += 1

    if (SchemaValidation.ajvNotStrictMode.includes(schemaName)) {
      validatingInStrictMode += 1
    }

    if (!FoldersPositiveTest.includes(schemaName.replace('.json', ''))) {
      missingPositiveTests += 1
    }

    if (!FoldersNegativeTest.includes(schemaName.replace('.json', ''))) {
      missingNegativeTests += 1
    }
  }

  const strictModePercent = Math.round(
    (validatingInStrictMode / totalSchemas) * 100,
  )
  const positivePercent = Math.round(
    (missingPositiveTests / totalSchemas) * 100,
  )
  const negativePercent = Math.round(
    (missingNegativeTests / totalSchemas) * 100,
  )

  console.info(
    `Out of ${totalSchemas} total schemas, ${validatingInStrictMode} (${strictModePercent}%) are validated with Ajv's strict mode`,
  )
  console.info(
    `Out of ${totalSchemas} total schemas, ${missingPositiveTests} (${positivePercent}%) do not have tests.`,
  )
  console.info(
    `Out of ${totalSchemas} total schemas, ${missingNegativeTests} (${negativePercent}%) do not have negative tests.`,
  )

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
    console.info(
      `SchemaStore URLs: ${countScanURLInternal} (${100 - percentExternal}%)`,
    )
    console.info(`External URLs: ${countScanURLExternal} (${percentExternal}%)`)
    console.info(`Total URLs: ${totalCount}`)
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
        process.stdout.write(`WARNING: Please use the "check" task instead of "build". The "build" task will be removed.\n`)
    }

    await taskMap[taskOrFn]()
  } else {
    eval(`${taskOrFn}()`)
  }
}
