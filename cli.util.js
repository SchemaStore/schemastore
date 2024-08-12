import smtpAddressParser from 'smtp-address-parser'
import * as uriJs from 'uri-js/dist/index.js'
import schemes from 'schemes'
// Trailing slash loads npm module instead of built-in
import punycodePkg from 'punycode/punycode.js'

const { toASCII } = punycodePkg

/**
 * The npm package "ajv-formats-draft2019" is no longer maintained. It also
 * uses unmaintained dependencies. Furthermore, it itself and its dependencies
 * use the now-deprecated "punycode" built-in module, which prints an annoying
 * warning message to the console on import. To remedy this issue, copy and
 * maintain the code here.
 */
export function ajvFormatsDraft2019(ajv, options = {}) {
  const ajv2019Formats = ajv2019FormatsFactory()
  const allFormats = Object.keys(ajv2019Formats)
  let formatsToInstall = allFormats

  if (options.formats) {
    if (!Array.isArray(options.formats))
      throw new Error('options.formats must be an array')
    formatsToInstall = options.formats
  }

  allFormats
    .filter((format) => formatsToInstall.includes(format))
    .forEach((key) => {
      ajv.addFormat(key, ajv2019Formats[key])
    })

  return ajv
}

function ajv2019FormatsFactory() {
  const hostnameRegex =
    /^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*\.?$/i

  function validate(address) {
    try {
      smtpAddressParser.parse(address)
      return true
    } catch {
      return false
    }
  }

  return {
    iri(value) {
      const iri = uriJs.parse(value)
      if (iri.scheme === 'mailto' && iri.to.every(validate)) {
        return true
      }
      if (
        (iri.reference === 'absolute' || iri.reference === 'uri') &&
        schemes.allByName[iri.scheme]
      ) {
        return true
      }
      return false
    },
    // Regex from https://stackoverflow.com/questions/32044846/regex-for-iso-8601-durations
    duration:
      /^P(?!$)(\d+(?:\.\d+)?Y)?(\d+(?:\.\d+)?M)?(\d+(?:\.\d+)?W)?(\d+(?:\.\d+)?D)?(T(?=\d)(\d+(?:\.\d+)?H)?(\d+(?:\.\d+)?M)?(\d+(?:\.\d+)?S)?)?$/,
    'idn-email'(value) {
      try {
        smtpAddressParser.parse(value)
        return true
      } catch {
        return false
      }
    },
    'idn-hostname'(value) {
      const hostname = toASCII(value)
      return (
        hostname.replace(/\.$/, '').length <= 253 &&
        hostnameRegex.test(hostname)
      )
    },
    'iri-reference'(value) {
      const iri = uriJs.parse(value)
      // All valid IRIs are valid IRI-references
      if (iri.scheme === 'mailto' && iri.to.every(validate)) {
        return true
      }

      if (
        iri.reference === 'absolute' &&
        iri.path !== undefined &&
        schemes.allByName[iri.scheme]
      ) {
        return true
      }

      // Check for valid IRI-reference

      // If there is a scheme, it must be valid
      if (iri.scheme && !schemes.allByName[iri.scheme]) {
        return false
      }

      // Check there's a path and for a proper type of reference
      return (
        iri.path !== undefined &&
        (iri.reference === 'relative' ||
          iri.reference === 'same-document' ||
          iri.reference === 'uri')
      )
    },
  }
}
