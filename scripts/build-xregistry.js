// @ts-check

/**
 * XRegistry Build Script
 *
 * This script generates an xRegistry-compliant schema registry from the SchemaStore catalog.json
 * file. It implements the Schema Registry Service specification (version 1.0-rc1).
 *
 * Key features:
 * 1. Purges all existing files from the target directory at start
 * 2. Determines the default version by sorting lexically and marking the greatest one as default
 * 3. Moves the "format" attribute to the top level instead of in meta
 * 4. Only references schemas with "schemauri" and doesn't embed them
 * 5. Properly organizes schemas into schema groups based on URL sources
 */

import { promises as fs } from 'fs'
import path, { dirname } from 'path'
import crypto from 'crypto'
import semver from 'semver'
import { fileURLToPath } from 'url'
import fetch from 'node-fetch'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const SOURCE_CATALOG = path.join(__dirname, '../src/api/json/catalog.json')
const TARGET_DIR = './src/api/registry'
const REGISTRY_ROOT = '/api/registry'
const SCHEMAGROUPS_DIR = path.join(TARGET_DIR, 'schemagroups')

// File system helpers
/**
 * Checks if a file or directory exists.
 * @param {string} filepath - The path to check.
 * @returns {Promise<boolean>} - True if the file exists, false otherwise.
 */
async function exists(filepath) {
  return fs
    .stat(filepath)
    .then(() => true)
    .catch((err) => {
      if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
        return false
      } else {
        throw err
      }
    })
}

/**
 * Ensures a directory exists, creating it if necessary.
 * @param {string} dirPath - The directory path.
 */
async function ensureDirectory(dirPath) {
  if (!(await exists(dirPath))) {
    await fs.mkdir(dirPath, { recursive: true })
  }
}

/**
 * Reads a JSON file and parses its content.
 * @param {string} filename - The file to read.
 * @returns {Promise<any>} - The parsed JSON content.
 */
async function readJsonFile(filename) {
  const data = await fs.readFile(filename, 'utf-8')
  return JSON.parse(data)
}

/**
 * Writes data to a JSON file.
 * @param {string} filename - The file to write to.
 * @param {any} data - The data to write.
 */
async function writeJsonFile(filename, data) {
  await fs.writeFile(filename, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * Extracts the domain from a URL.
 * @param {string} url - The URL to parse.
 * @returns {string} - The extracted domain.
 */
function extractDomain(url) {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.hostname
  } catch (error) {
    // If URL parsing fails, use a placeholder
    return 'unknown-source'
  }
}

/**
 * Groups schemas by their domain.
 * @param {Array<{ url: string }>} schemas - The schemas to group.
 * @returns {Record<string, Array<{ url: string }>>} - The grouped schemas.
 */
function groupByDomain(schemas) {
  const grouped = /** @type {Record<string, Array<{ url: string }>>} */ ({})

  for (const schema of schemas) {
    const domain = extractDomain(schema.url)
    if (!grouped[domain]) {
      grouped[domain] = []
    }
    grouped[domain].push(schema)
  }

  return grouped
}

/**
 * Determines the schema format by fetching the schema and reading its $schema URI.
 * @param {string} schemaUrl - The schema URL.
 * @returns {Promise<string>} - The schema format (e.g., JsonSchema/draft-07).
 */
async function getSchemaFormat(schemaUrl) {
  try {
    const res = await fetch(schemaUrl)
    /** @type {any} */
    const data = await res.json()
    const schemaUri = data.$schema || ''
    const draftMatch = /draft-(\d+)[-\w]*/i.exec(schemaUri)
    if (draftMatch) {
      return `JsonSchema/draft-${draftMatch[1]}`
    }
    return 'JsonSchema'
  } catch {
    return 'JsonSchema'
  }
}

/**
 * Sanitizes a name by replacing invalid characters with underscores.
 * @param {string} name - The name to sanitize.
 * @returns {string} - The sanitized name.
 */
function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_')
}

/**
 * @typedef {Object} SchemaVersion
 * @property {string} schemauri
 * @property {string} description
 * @property {string} format
 * @property {boolean} [isdefault]
 * @property {string} url
 * @property {Object} [metaattributes]
 *
 * @typedef {Object} Schema
 * @property {Record<string, SchemaVersion>} versions
 *
 * @typedef {Object} SchemaGroup
 * @property {Record<string, Schema>} schemas
 */

/** @type {{ [key:string]: any }} */
const schemagroups = {}

/**
 * Normalizes and validates versions using semver.
 * @param {string[]} versions - An array of version strings.
 * @returns {Array<{ version: string, isdefault: boolean }>} - A sorted array of valid version objects.
 */
function normalizeVersions(versions) {
  const sortedVersions = versions
    .map((version) => ({ version, parsed: semver.parse(version) }))
    .filter(({ parsed }) => parsed !== null) // Remove invalid versions
    .sort((a, b) => {
      if (a.parsed && b.parsed) {
        return semver.compare(a.parsed, b.parsed)
      }
      return 0
    })
    .map(({ version }) => version)

  const versionObjects = sortedVersions.map((version, index) => ({
    version,
    isdefault: index === sortedVersions.length - 1,
  }))

  return versionObjects
}

// Main build functions
async function purgeTargetDirectory() {
  if (await exists(TARGET_DIR)) {
    const files = await fs.readdir(TARGET_DIR)
    for (const file of files) {
      const filePath = path.join(TARGET_DIR, file)
      try {
        const stats = await fs.stat(filePath)
        if (stats.isDirectory()) {
          await fs.rm(filePath, { recursive: true, force: true })
        } else {
          await fs.unlink(filePath)
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error(`Failed to remove ${filePath}:`, error.message)
        } else {
          console.error(`Failed to remove ${filePath}:`, error)
        }
      }
    }
  }
}

async function buildXRegistry() {
  console.info('Starting xRegistry build...')
  await purgeTargetDirectory()
  console.info('Target directory purged.')
  // Ensure target directory exists
  await ensureDirectory(TARGET_DIR)

  // Read catalog
  const catalog = await readJsonFile(SOURCE_CATALOG)
  const totalSchemas = catalog.schemas.length
  let processedSchemas = 0

  // Build grouping in memory
  for (const schema of catalog.schemas) {
    processedSchemas++
    console.info(
      `Processing schema ${processedSchemas}/${totalSchemas}: ${schema.url}`,
    )
    const url = schema.url
    console.info(`Determining schema format for ${url}...`)
    // Map json.schemastore.org domain to schemastore.org
    let domain = extractDomain(url)
    if (domain === 'json.schemastore.org') {
      domain = 'schemastore.org'
    }

    const validDomainRegex = /^[a-zA-Z0-9_][a-zA-Z0-9_.\-~@]{0,127}$/
    if (!validDomainRegex.test(domain)) {
      domain = domain.replace(/[^a-zA-Z0-9_.\-~@]/g, '_')
      if (!/^[a-zA-Z0-9_]/.test(domain[0])) {
        domain = '_' + domain.substring(1)
      }
    }

    const lowerDomain = domain.toLowerCase()
    let domainConflict = false
    for (const existingDomain in schemagroups) {
      if (
        existingDomain.toLowerCase() === lowerDomain &&
        existingDomain !== domain
      ) {
        console.error(
          `Schema ${schema.url} rejected due to domain casing conflict: found "${domain}" but registry already contains "${existingDomain}".`,
        )
        domainConflict = true
        break
      }
    }
    if (domainConflict) continue

    // derive precise format by inspecting the schema's $schema URI
    const format = await getSchemaFormat(url)
    console.info(`Determined format ${format} for schema ${url}`)

    // Derive schema id from filename, fallback to name
    const filename = path.basename(new URL(url).pathname)
    const candidateIds = []
    if (!filename.toLowerCase().startsWith('schema.')) {
      const nameWithoutExtension = filename.replace(/\.[^/.]+$/, '')
      if (nameWithoutExtension.length > 0) {
        candidateIds.push(nameWithoutExtension)
      }
    }
    const name = sanitizeName(schema.name)
    if (name && name.length > 0) {
      candidateIds.push(name)
    }

    if (!candidateIds.length) {
      console.error(
        `Schema ${schema.url} has no valid name or filename to derive schema id.`,
      )
      continue
    }

    let id = null
    let idConflict = false
    for (const candidate of candidateIds) {
      id = candidate
      idConflict = false

      // Ensure the candidate id is valid
      const validIdRegex = /^[a-zA-Z0-9_][a-zA-Z0-9_.\-~@]{0,127}$/
      if (!validIdRegex.test(id)) {
        id = id.replace(/[^a-zA-Z0-9_.\-~@]/g, '_')
        if (!/^[a-zA-Z0-9_]/.test(id[0])) {
          id = '_' + id.substring(1)
        }
      }

      // Check for ID conflicts
      for (const existingDomain in schemagroups) {
        const group = schemagroups[existingDomain]
        if (group.schemas) {
          for (const existingId in group.schemas) {
            if (
              existingId.toLowerCase() === id.toLowerCase() &&
              existingId !== id
            ) {
              console.error(
                `Schema ${schema.url} candidate id "${id}" rejected due to schema id casing conflict: found conflicting id "${existingId}".`,
              )
              idConflict = true
              break
            }
          }
        }
      }
      if (!idConflict) break
    }
    if (idConflict) break

    // Initialize schema group entry if missing
    if (!schemagroups[domain]) {
      /** @type {any} */
      schemagroups[domain] = { schemas: {} }
    }
    if (!schemagroups[domain].schemas[id]) {
      // initialize schema entry with metadata from catalog
      /** @type {any} */
      schemagroups[domain].schemas[id] = {
        name: schema.name || id,
        description: schema.description || '',
        filematch: Array.isArray(schema.fileMatch) ? schema.fileMatch : [],
        versions: {},
      }
    }

    const version = schema.version || '1.0.0'
    // Prepare version entry without default flag
    schemagroups[domain].schemas[id].versions[version] = {
      schemauri: url,
      description: schema.description,
      format,
      url,
      // store meta for created and source
      metaattributes: { created: new Date().toISOString(), source: url },
    }
  }

  // Build single-file registry JSON with flattened structure
  console.info('Building single-file registry output...')
  /** @type {{ [key:string]: any }} */
  const registry = { schemagroups: {} }
  for (const [domain, group] of Object.entries(schemagroups)) {
    /** @type {{ [key:string]: any }} */
    const grp = { schemas: {} }
    for (const [schemaId, schemaObj] of Object.entries(group.schemas)) {
      // Determine sorted versions and build version dictionary
      const versionList = normalizeVersions(Object.keys(schemaObj.versions))
      /** @type {{ [key:string]: any }} */
      const versionsDict = {}
      /** @type {any} */
      const schemaAny = schemaObj
      let prevVer
      for (const { version, isdefault } of versionList) {
        const v = schemaObj.versions[version]
        /** @type {{ [key:string]: any }} */
        const entry = { schemauri: v.schemauri, isdefault }
        if (prevVer) {
          entry.ancestor = prevVer
        }
        versionsDict[version] = entry
        prevVer = version
      }
      // Use format from first version
      const fmt = schemaObj.versions[versionList[0].version].format
      grp.schemas[schemaId] = {
        name: schemaAny.name,
        description: schemaAny.description,
        format: fmt,
        filematch: schemaAny.filematch,
        versions: versionsDict,
      }
    }
    /** @type {{ [key:string]: any }} */
    registry.schemagroups[domain] = grp
  }
  await writeJsonFile(path.join(TARGET_DIR, 'registry.json'), registry)
  console.info('Single-file registry build completed.')
}

// Execute the build
buildXRegistry()

export { buildXRegistry }
