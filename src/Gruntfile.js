/// <binding AfterBuild='build' />

const pt = require("path");
const fs = require('fs');
const catalog = require('./api/json/catalog.json');
const schemaV4JSON = require('./schemas/json/schema-draft-v4.json');
const schemaValidation = require('./schema-validation.json');
const schemaDir = "schemas/json"
const testPositiveDir = "test"
const testNegativeDir = "negative_test"
const schemasToBeTested = fs.readdirSync(schemaDir);
const foldersPositiveTest = fs.readdirSync(testPositiveDir);
const foldersNegativeTest = fs.readdirSync(testNegativeDir);
const countSchemasType = [
  {schemaName: "2020-12", schemaStr: "json-schema.org/draft/2020-12/schema", totalCount: 0, active: true},
  {schemaName: "2019-09", schemaStr: "json-schema.org/draft/2019-09/schema", totalCount: 0, active: true},
  {schemaName: "draft-07", schemaStr: "json-schema.org/draft-07/schema", totalCount: 0, active: true},
  {schemaName: "draft-06", schemaStr: "json-schema.org/draft-06/schema", totalCount: 0, active: true},
  {schemaName: "draft-04", schemaStr: "json-schema.org/draft-04/schema", totalCount: 0, active: true},
  {schemaName: "draft-03", schemaStr: "json-schema.org/draft-03/schema", totalCount: 0, active: false},
  {schemaName: "draft without version", schemaStr: "json-schema.org/schema", totalCount: 0, active: false}
];

module.exports = function (grunt) {
  "use strict";

  grunt.file.preserveBOM = false;
  grunt.initConfig({

    tv4: {
      options: {
        schemas: {
          "http://json-schema.org/draft-04/schema#": grunt.file.readJSON("schemas/json/schema-draft-v4.json"),
          "https://json.schemastore.org/jsonld": grunt.file.readJSON("schemas/json/jsonld.json"),
          "https://json.schemastore.org/schema-org-thing": grunt.file.readJSON("schemas/json/schema-org-thing.json"),
          "http://json.schemastore.org/xunit.runner.schema": grunt.file.readJSON("schemas/json/xunit.runner.schema.json"),
          "https://json.schemastore.org/feed-1": grunt.file.readJSON("schemas/json/feed-1.json"),
        }
      }
    },

    http: {
      //composer: {
      //    options: { url: "https://raw.githubusercontent.com/composer/composer/master/res/composer-schema.json" },
      //    dest: "schemas/json/composer.json"
      //},
      swagger20: {
        options: { url: "https://raw.githubusercontent.com/swagger-api/swagger-spec/master/schemas/v2.0/schema.json" },
        dest: "schemas/json/swagger-2.0.json"
      },
      resume: {
        options: { url: "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json" },
        dest: "schemas/json/resume.json"
      },
      jsonld: {
        options: { url: "https://raw.githubusercontent.com/json-ld/json-ld.org/master/schemas/jsonld-schema.json" },
        dest: "schemas/json/jsonld.json"
      },
      ninjs_v13: {
        options: { url: "https://www.iptc.org/std/ninjs/ninjs-schema_1.3.json" },
        dest: "schemas/json/ninjs-1.3.json"
      },
      ninjs_v12: {
        options: { url: "https://www.iptc.org/std/ninjs/ninjs-schema_1.2.json" },
        dest: "schemas/json/ninjs-1.2.json"
      },
      ninjs_v11: {
        options: { url: "https://www.iptc.org/std/ninjs/ninjs-schema_1.1.json" },
        dest: "schemas/json/ninjs-1.1.json"
      },
      ninjs_v10: {
        options: { url: "https://www.iptc.org/std/ninjs/ninjs-schema_1.0.json" },
        dest: "schemas/json/ninjs-1.0.json"
      },
      xunit_v23: {
        options: { url: "https://raw.githubusercontent.com/xunit/xunit/gh-pages/schema/v2.3/xunit.runner.schema.json" },
        dest: "schemas/json/xunit.runner.schema.json"
      }
    },
  });

  function skipThisFileName(name){
    // This macOS file must always be ignored.
    return name === ".DS_Store";
  }

  function getUrlFromCatalog(catalogUrl) {
    for (const schema of catalog["schemas"]) {
      catalogUrl(schema["url"]);
      const versions = schema["versions"];
      if (versions) {
        for (const prop in versions) {
          if (versions.hasOwnProperty(prop)) {
            catalogUrl(versions[prop]);
          }
        }
      }
    }
  }

  async function remoteSchemaFile(schema_1_PassScan, showLog= true){
    const got = require("got");
    const schemas = catalog["schemas"];
    const url_ = require("url");

    for( const {url} of schemas ){
      if(url.startsWith("https://json.schemastore.org")){
        // Skip local schema
        continue;
      }
      try {
        const response = await got(url);
        if (response["statusCode"] === 200) {
          const parsed = url_.parse(url);
          const callbackParameter = {
            jsonName: pt.basename(parsed.pathname),
            rawFile: response["rawBody"],
            urlOrFilePath: url,
            schemaScan: true
          }
          schema_1_PassScan(callbackParameter);
          if (showLog) {
            grunt.log.ok(url);
          }
        }else{
          if (showLog) {
            grunt.log.error(url, response["statusCode"]);
          }
        }
      } catch (error) {
        if (showLog) {
          grunt.log.writeln('')
          grunt.log.error(url, error.name, error.message);
          grunt.log.writeln('')
        }
      }
    }
  }

  function localSchemaFileAndTestFile(
      {
        schema_1_PassScan = undefined,
        schema_1_PassScanDone = undefined,
        schema_2_PassScan = undefined,
        positiveTest_1_PassScan = undefined,
        positiveTest_1_PassScanDone = undefined,
        negativeTest_1_PassScan = undefined,
        negativeTest_1_PassScanDone = undefined,
        schema_without_positive_test = undefined
      },
      {
        fullScanAllFiles = false,
        tv4OnlyMode = false,
        logTestFolder = true
      } = {}) {

    let callbackParameter = {
      jsonName: undefined,
      rawFile: undefined,
      urlOrFilePath: undefined,
      schemaScan: true
    }

    /**
     * @summary Check if the present json schema file must be tested or not
     * @param {string} jsonFilename
     * @returns {boolean}
     */
    const canThisTestBeRun = (jsonFilename) => {
      let result = true;
      if (schemaValidation["skiptest"].includes(jsonFilename)) {
        return false; // This test can never be process
      }

      // Schema must be run for tv4 or schemasafe.
      if (fullScanAllFiles === false) {
        if (schemaValidation["tv4test"].includes(jsonFilename)) {
          // This file is NOT full compliance. Should be run only by tv4 validator
          if (tv4OnlyMode === false) {
            result = false;
          }
        } else {
          // This file is full compliance. Can NOT be process by tv4 validator
          if (tv4OnlyMode === true) {
            // this file can not be process by tv4.
            result = false;
          }
        }
      }
      return result;
    }

    const runTestFolder = (testDir, folderName, schema_PassScan, test_PassScan, test_PassScanDone) => {
      // If it's a file, ignore and continue. We only care about folders.
      if (fs.lstatSync(pt.join(testDir, folderName)).isFile()) {
        return;
      }

      if (skipThisFileName(folderName)) {
        return;
      }

      if (canThisTestBeRun(`${folderName}.json`) === false) {
        return;
      }

      if (tv4OnlyMode === false && logTestFolder === true) {
        // tv4 already have it own console output take care of.
        grunt.log.writeln(``);
        grunt.log.writeln(`test folder   : ${folderName}`);
      }

      const files = fs.readdirSync(pt.join(testDir, folderName)).map(
          // Must create a full path
          (fileName) => pt.join(testDir, folderName, fileName)
      );

      if (!files.length) {
        throw new Error(`Found folder with no test files: ${folderName}`);
      }

      const schemaFileWithPath = `schemas/json/${folderName}.json`;
      if (schema_PassScan) {
        callbackParameter = {
          // Return the real Raw file for BOM file test rejection
          rawFile: fs.readFileSync(schemaFileWithPath),
          jsonName: pt.basename(schemaFileWithPath),
          urlOrFilePath: schemaFileWithPath,
          schemaScan: false
        }
        schema_PassScan(callbackParameter);
      }

      if (test_PassScan) {
        // Test file may have BOM. But this must be strip for the next process
        grunt.file.preserveBOM = false; // Strip file from BOM
        files.forEach(function (file) {
          // must ignore BOM in test
          callbackParameter = {
            rawFile: grunt.file.read(file),
            jsonName: pt.basename(file.toString()),
            urlOrFilePath: file,
            schemaScan: false
          }
          test_PassScan(callbackParameter);
        });
        if (test_PassScanDone) {
          test_PassScanDone();
        }
      }
    }

    // process callback for the schema_without_positive_test
    if (schema_without_positive_test) {
      // Show only test folder percentage if in test folder scan mode.
      const notCovered = schemasToBeTested.filter(schemaName => {
        const folderName = schemaName.replace("\.json", "");
        return !foldersPositiveTest.includes(folderName);
      });

      notCovered.forEach((schema_file_name) => {
        if (!skipThisFileName(schema_file_name)) {
          schema_without_positive_test({jsonName: schema_file_name});
        }
      });

      if (notCovered.length > 0) {
        const percent = (notCovered.length / schemasToBeTested.length) * 100;
        grunt.log.writeln();
        grunt.log.writeln(`${Math.round(percent)}% of schemas do not have tests or have malformed test folders`);
      }
    }

    // Verify each schema file
    schemasToBeTested.forEach((schema_file_name) => {
      const schema_full_path_name = pt.join(schemaDir, schema_file_name);

      // If not a file, ignore and continue. We only care about files.
      if (!fs.lstatSync(schema_full_path_name).isFile()) {
        return;
      }

      if (skipThisFileName(schema_file_name)) {
        return;
      }

      if (canThisTestBeRun(schema_file_name) === false) {
        return;
      }

      callbackParameter = {
        // Return the real Raw file for BOM file test rejection
        rawFile: fs.readFileSync(schema_full_path_name),
        jsonName: pt.basename(schema_full_path_name),
        urlOrFilePath: schema_full_path_name,
        schemaScan: true
      }
      if (schema_1_PassScan) {
        schema_1_PassScan(callbackParameter);
      }
      if (schema_2_PassScan) {
        schema_2_PassScan(callbackParameter);
      }
    });

    if (schema_1_PassScanDone) {
      schema_1_PassScanDone();
    }

    // Do not scan the test folder if there are no one to process the data
    if (positiveTest_1_PassScan) {
      // Now run all positive test in each test folder
      foldersPositiveTest.forEach((folderName) => {
        runTestFolder(testPositiveDir, folderName, schema_2_PassScan, positiveTest_1_PassScan, positiveTest_1_PassScanDone);
      });
    }

    // Do not scan the test folder if there are no one to process the data
    //  and tv4 don't have negative test
    if (negativeTest_1_PassScan && (tv4OnlyMode === false)) {
      // Now run all negative test in each test folder
      foldersNegativeTest.forEach((folderName) => {
        runTestFolder(testNegativeDir, folderName, schema_2_PassScan, negativeTest_1_PassScan, negativeTest_1_PassScanDone);
      });
    }
  }

  function testSchemaFileForBOM(callbackParameter) {
    // JSON schema file must not have any BOM type
    const buffer = callbackParameter.rawFile;
    const bomTypes = [
      {name: "UTF-8", signature: [0xEF, 0xBB, 0xBF]},
      {name: "UTF-16 (BE)", signature: [0xFE, 0xFF]},
      {name: "UTF-16 (LE)", signature: [0xFF, 0xFE]},
      {name: "UTF-32 (BE)", signature: [0x00, 0x00, 0xFF, 0xFE]},
      {name: "UTF-32 (LE)", signature: [0xFF, 0xFE, 0x00, 0x00]}
    ];

    for (const bom of bomTypes) {
      if (buffer.length >= bom.signature.length) {
        const bomFound = bom.signature.every((value, index) => buffer[index] === value)
        if (bomFound) {
          throw new Error(`Schema file must not have ${bom.name} BOM: ${callbackParameter.urlOrFilePath}`);
        }
      }
    }
  }

  function tv4() {
    let schemaPath = undefined;
    let schemaName = undefined;
    let testSchemaPath = [];
    let testListPath = [];

    const processSchemaFile = (callbackParameter) => {
      if (callbackParameter.schemaScan === true) {
        // Must later be process it, all at once in processSchemaFileDone()
        testSchemaPath.push(callbackParameter.urlOrFilePath);
      } else {
        // This is a test scan. Copy schema path for the next test file process.
        schemaName = callbackParameter.jsonName;
        schemaPath = callbackParameter.urlOrFilePath;
        testListPath = [];
      }
    }

    const processSchemaFileDone = () => {
      // Process the scan of all the schema files at once
      if (testSchemaPath.length === 0) {
        // tv4 task can never be empty. It will give error. Work around just rescan schema-catalog.json
        testSchemaPath.push("./schemas/json/schema-catalog.json");
      }
        const valid = "Schemas";
        grunt.config.set("tv4." + valid, {
          options: {
            root: schemaV4JSON,
            banUnknown: false
          },
          src: [testSchemaPath]
        });
      }

    const processTestFile = (callbackParameter) => {
      // Add all the test list path of one test group together.
      //  this will be process later at processTestFileDone()
      testListPath.push(callbackParameter.urlOrFilePath);
    }

    const processTestFileDone = () => {
      // Process one test group 'in a folder' at once
      const valid = schemaName.replace(/\./g, "\\.");
      grunt.config.set("tv4." + valid, {
        options: {
          root: grunt.file.readJSON(schemaPath),
          banUnknown: false
        },
        src: [testListPath]
      });
    }

    return {
      testSchemaFile: processSchemaFile,
      testSchemaFileDone: processSchemaFileDone,
      testTestFile: processTestFile,
      testTestFileDone: processTestFileDone
    }
  }

  function schemasafe(){
    const { validator } = require('@exodus/schemasafe')
    const schema_version = show_schema_versions();
    const textValidate = "validate    | ";
    const textPassSchema         = "pass schema          | ";
    const textPositivePassTest   = "pass positive test   | ";
    const textPositiveFailedTest = "failed positive test | ";
    const textNegativePassTest   = "pass negative test   | ";
    const textNegativeFailedTest = "failed negative test | ";

    let validate = undefined;
    let selectedParserModeString = "(default mode) ";
    let countSchema = 0;
    let schemas = [];

    const fillExternalSchemaArray = () => {
      const ExternalSchema = schemaValidation["externalschema"];
      for( const schema_file_name of ExternalSchema){
        if(!schema_file_name.endsWith(".json")){
          // must skip comment in the list
          continue;
        }
        const schema_full_path_name = `./schemas/json/${schema_file_name}`;
        schemas.push(require(schema_full_path_name));
      }
      // Check for missing root "id"/"$id"
      grunt.log.writeln("Check ref to external schema list");
      validator(JSON.parse("{}") , {schemas})
      grunt.log.ok("Check ref to external schema list. => OK");
      grunt.log.writeln();
    }

    const processSchemaFile = (callbackParameter) => {
      // mode can be 'strong' | lax | default
      let mode = 'default';
      let formatItems = undefined;
      let allowUnusedKeywords = false;
      selectedParserModeString = "(default mode)  ";

      if(schemaValidation["strongmode"].includes(callbackParameter.jsonName)){
        mode = 'strong';
        selectedParserModeString = "(strong mode)  ";
      }else{
        if(schemaValidation["laxmodeAllowUnusedKeywords"].includes(callbackParameter.jsonName)){
          allowUnusedKeywords = true;
          selectedParserModeString = "(lax mode)      ";
        }
      }

      // process unknownFormat
      schemaValidation["unknownFormat"].some((item) => {
        if (item.hasOwnProperty(callbackParameter.jsonName)) {
          // This schema have format that are not supported by schemasafe
          formatItems = {};
          // Create new properties in formatItems{}
          item[callbackParameter.jsonName].forEach((x) => {
            // All the string input from format are always true. There is no string validation here.
            formatItems[x] = () => true;
          })
          // Found the correct item. Stop processing the 'some' loop.
          return true;
        }
        return false;
      });

      // Start validate the JSON schema
      let schemaJson;
      try {
        schemaJson = JSON.parse(callbackParameter.rawFile);
        validate = validator(schemaJson, {
          schemas,
          mode,
          allowUnusedKeywords,
          includeErrors: true,
          requireSchema: true,
          formats: formatItems
        });
      } catch (e) {
        grunt.log.error(`${selectedParserModeString}${textValidate}${callbackParameter.urlOrFilePath}`);
        throw new Error(e);
      }
      countSchema++;
      // Get the schema draft version.
      let schemaVersionStr = "unknown"
      const obj = schema_version.getObj(schemaJson);
      if(obj){
        schemaVersionStr = obj.schemaName;
      }
      grunt.log.ok(`${selectedParserModeString}${textPassSchema}${callbackParameter.urlOrFilePath} (${schemaVersionStr})`);
    }

    const processPositiveTestFile = (callbackParameter) => {
      let json;
      try {
        json = JSON.parse(callbackParameter.rawFile);
      }catch (e) {
        grunt.log.error(`Error in test: ${callbackParameter.urlOrFilePath}`)
        throw new Error(e);
      }

      if (validate(json)) {
        grunt.log.ok(selectedParserModeString + textPositivePassTest + callbackParameter.urlOrFilePath);
      } else {
        grunt.log.error(selectedParserModeString + textPositiveFailedTest + callbackParameter.urlOrFilePath);
        grunt.log.error("(Schema file) keywordLocation: " + validate.errors[0].keywordLocation);
        grunt.log.error("(Test file) instanceLocation: " + validate.errors[0].instanceLocation);
        throw new Error(`Error in positive test.`);
      }
    }

    const processNegativeTestFile = (callbackParameter) => {
      let json;
      try {
        json = JSON.parse(callbackParameter.rawFile);
      }catch (e) {
        grunt.log.error(`Error in test: ${callbackParameter.urlOrFilePath}`)
        throw new Error(e);
      }

      if (validate(json)) {
        grunt.log.error(selectedParserModeString + textNegativeFailedTest + callbackParameter.urlOrFilePath);
        throw new Error(`Negative test must always fail.`);
      } else {
        grunt.log.ok(selectedParserModeString
            + textNegativePassTest
            + callbackParameter.urlOrFilePath
            + " (Schema: "
            + validate.errors[0].keywordLocation
            + ") (Test: "
            + validate.errors[0].instanceLocation
            + ")"
        );
      }
    }


    const processSchemaFileDone = () => {
      grunt.log.writeln();
      grunt.log.writeln("Total schemas validated with schemasafe: " + countSchema.toString());
      countSchema = 0;
    }

    fillExternalSchemaArray();
    return {
      testSchemaFile: processSchemaFile,
      testSchemaFileDone: processSchemaFileDone,
      positiveTestFile: processPositiveTestFile,
      negativeTestFile: processNegativeTestFile
    }
  }

  grunt.registerTask("local_tv4_only_for_non_compliance_schema", "Dynamically load local schema file for validation with /test/", function () {
    const x = tv4();
    localSchemaFileAndTestFile({
      schema_2_PassScan: x.testSchemaFile,
      schema_1_PassScanDone: x.testSchemaFileDone,
      positiveTest_1_PassScan: x.testTestFile,
      positiveTest_1_PassScanDone: x.testTestFileDone
    }, {tv4OnlyMode: true});
    // The tv4 task is actually run after this registerTask()
  })

  grunt.registerTask("local_schemasafe_test", "Dynamically load local schema file for validation with /test/", function () {
    const x = schemasafe();
    localSchemaFileAndTestFile({
      schema_2_PassScan: x.testSchemaFile,
      positiveTest_1_PassScan: x.positiveTestFile,
      negativeTest_1_PassScan: x.negativeTestFile,
      schema_1_PassScanDone: x.testSchemaFileDone
    });
    grunt.log.writeln()
    grunt.log.ok("local schema passed");
  })

  grunt.registerTask("remote_schemasafe_test", "Dynamically load external schema file for validation", async function () {
    const done = this.async();
    const x = schemasafe();
    await remoteSchemaFile(x.testSchemaFile);
    done();
  })

  grunt.registerTask("local_bom", "Dynamically load local schema file for BOM validation", function () {
    let countScan = 0;
    const x = (data) => {
      countScan++;
      testSchemaFileForBOM(data);
    }
    localSchemaFileAndTestFile({schema_1_PassScan: x}, {fullScanAllFiles: true});
    grunt.log.ok("no BOM file found in all schema files. Total files scan: " + countScan);
  })

  grunt.registerTask("remote_bom", "Dynamically load remote schema file for BOM validation", async function () {
    const done = this.async();
    await remoteSchemaFile(testSchemaFileForBOM, false);
    done();
  })

  grunt.registerTask("local_catalog", "Catalog validation", function () {
    const {validator} = require('@exodus/schemasafe');
    const catalogSchema = require("./schemas/json/schema-catalog.json");

    const validate = validator(catalogSchema, {includeErrors: true});
    if (validate(catalog)) {
      grunt.log.ok("catalog.json OK");
    } else {
      grunt.log.error("(Schema file) keywordLocation: " + validate.errors[0].keywordLocation);
      grunt.log.error("(Test file) instanceLocation: " + validate.errors[0].instanceLocation);
      throw new Error(`"Catalog ERROR"`);
    }
  })

  grunt.registerTask("local_find-duplicated-property-keys", "Dynamically load local test file for validation", function () {
    const findDuplicatedPropertyKeys = require('find-duplicated-property-keys')
    let countScan = 0;
    const findDuplicatedProperty = (callbackParameter) => {
      countScan++;
      const result = findDuplicatedPropertyKeys(callbackParameter.rawFile);
      if(result.length > 0){
        grunt.log.error('Duplicated key found in: ' + callbackParameter.urlOrFilePath);
        for( const issue of result ){
          grunt.log.error(issue["key"] + ' <= This duplicate key is found. occurrence :' + issue["occurrence"].toString());
        }
        throw new Error(`Error in test: find-duplicated-property-keys`);
      }
    }
    localSchemaFileAndTestFile( {positiveTest_1_PassScan : findDuplicatedProperty}, {logTestFolder : false});
    grunt.log.ok('No duplicated property key found in test files. Total files scan: ' + countScan);
  })

  grunt.registerTask("local_url-present-in-catalog", "local url must reference to a file", function () {
    const httpsPath = "https://json.schemastore.org"
    const schemaPath = './schemas/json/'
    let countScan = 0;

    getUrlFromCatalog(catalogUrl => {
      if (catalogUrl.startsWith(httpsPath)) {
        countScan++;
        let filename = catalogUrl.split('/').pop();
        filename = filename.endsWith(".json") ? filename : filename.concat(".json");
        if (fs.existsSync(schemaPath.concat(filename)) === false) {
          throw new Error("Schema file not found: URL: " + catalogUrl);
        }
      }
    });
    grunt.log.ok('All local url tested OK. Total: ' + countScan);
  })

  grunt.registerTask("local_schema-present-in-catalog-list", "local schema must have a url reference in catalog list", function () {
    const httpsPath = "https://json.schemastore.org"
    let countScan = 0;
    let allCatalogLocalJsonFiles = [];

    // Read all the JSON file name from catalog and add it to allCatalogLocalJsonFiles[]
    getUrlFromCatalog(catalogUrl => {
      if (catalogUrl.startsWith(httpsPath)) {
        let filename = catalogUrl.split('/').pop();
        filename = filename.endsWith(".json") ? filename : filename.concat(".json");
        allCatalogLocalJsonFiles.push(filename);
      }
    })

    // Check if allCatalogLocalJsonFiles[] have the actual schema filename.
    const schemaFileCompare = (x) => {
      // skip testing if present in "missingcatalogurl"
      if (!schemaValidation["missingcatalogurl"].includes(x.jsonName)) {
        countScan++;
        const found = allCatalogLocalJsonFiles.includes(x.jsonName)
        if (!found) {
          throw new Error("No filename URL found in the catalog => " + x.jsonName);
        }
      }
    }
    // Get all the json file for schemasafe and tv4
    localSchemaFileAndTestFile({schema_1_PassScan: schemaFileCompare}, {fullScanAllFiles: true});
    grunt.log.ok('All local schema files have URL link in catalog. Total:' + countScan);
  })

  grunt.registerTask("local_catalog-fileMatch-conflict", "note: app.json and *app.json conflicting will not be detected", function () {
    const fileMatchConflict = schemaValidation["fileMatchConflict"];
    let fileMatchCollection = [];
    // Collect all the "fileMatch" and put it in fileMatchCollection[]
    for (const schema of catalog["schemas"]) {
      const fileMatchArray = schema["fileMatch"];
      if (fileMatchArray) {
        // Check if this is already present in the "fileMatchConflict" list. If so then remove it from filtered[]
        const filtered = fileMatchArray.filter(fileMatch => {
          return !fileMatchConflict.includes(fileMatch);
        });
        // Check if fileMatch is already present in the fileMatchCollection[]
        filtered.forEach(fileMatch => {
          if (fileMatchCollection.includes(fileMatch)) {
            throw new Error("Duplicate fileMatch found => " + fileMatch);
          }
        });
        fileMatchCollection = fileMatchCollection.concat(filtered);
      }
    }
    grunt.log.ok('No new fileMatch conflict detected.');
  })

  grunt.registerTask("local_filename_with_json_extension", "Dynamically check local schema/test file for filename extension", function () {
    let countScan = 0;
    const x = (data) => {
      countScan++;
      if (!data.jsonName.endsWith(".json")) {
        throw new Error("Filename must have .json extension => " + data.urlOrFilePath);
      }
    }
    localSchemaFileAndTestFile(
        {
          schema_1_PassScan: x,
          positiveTest_1_PassScan: x,
          negativeTest_1_PassScan: x
        }, {
          fullScanAllFiles: true,
          logTestFolder: false
        });
    grunt.log.ok("All schema and test filename have .json extension. Total files scan: " + countScan);
  })

  grunt.registerTask("local_search_for_schema_without_positive_test_files", "Dynamically check local schema if positive test files are present", function () {
    let countScan = 0;
    const x = (data) => {
      countScan++;
      grunt.log.ok("(No positive test file present): " + data.jsonName);
    }
    localSchemaFileAndTestFile({schema_without_positive_test: x});
    grunt.log.ok("Schemas that have no positive test files. Total files: " + countScan);
  })

  grunt.registerTask("local_validate_directory_structure", "Dynamically check if schema and test directory structure are valid", function () {
    schemasToBeTested.forEach((name) => {
      if (!skipThisFileName(name) && !fs.lstatSync(pt.join(schemaDir, name)).isFile()) {
        throw new Error("There can only be files in directory :" + schemaDir + " => " + name);
      }
    });

    foldersPositiveTest.forEach((name) => {
      if (!skipThisFileName(name) && !fs.lstatSync(pt.join(testPositiveDir, name)).isDirectory()) {
        throw new Error("There can only be directory's in :" + testPositiveDir + " => " + name);
      }
    });

    foldersNegativeTest.forEach((name) => {
      if (!skipThisFileName(name) && !fs.lstatSync(pt.join(testNegativeDir, name)).isDirectory()) {
        throw new Error("There can only be directory's in :" + testNegativeDir + " => " + name);
      }
    });
    grunt.log.ok("OK");
  })

  grunt.registerTask("local_test_downgrade_schema_version", "Dynamically check local schema version is not to high", function () {
    const {validator} = require('@exodus/schemasafe');
    const tv4 = require('tv4');
    let countSchemas = countSchemasType;
    let countScan = 0;

    const validateViaSchemasafe = (schemaJson) => {
      try {
        validator(schemaJson, {
          mode: "default",
          requireSchema: true,
        });
        return true;
      } catch (e) {
        return false;
      }
    }

    const validateViaTv4 = (schemaJson) => {
      try {
        return tv4.validate(schemaJson, schemaV4JSON, true, true);
      } catch (e) {
        return false;
      }
    }

    // There are no positive or negative test processes here.
    // Only the schema files are tested.
    const testLowerSchemaVersion = (callbackParameter) => {
      countScan++;
      // skip schema with unused keyword
      if (schemaValidation["laxmodeAllowUnusedKeywords"].includes(callbackParameter.jsonName)) {
        return;
      }
      let wrong_$id_usage = false;
      let versionIndexOriginal = 0;
      let schemaVersionToBeTested = countSchemas[versionIndexOriginal];
      let schemaJson = JSON.parse(callbackParameter.rawFile);

      if (!("$schema" in schemaJson)) {
        // There is no $schema present in the file.
        return;
      }

      // get the present schema_version
      const schemaVersion = schemaJson["$schema"]
      for (const [index, value] of countSchemas.entries()) {
        if (schemaVersion.includes(value.schemaStr)) {
          versionIndexOriginal = index;
          break;
        }
      }

      // start testing each schema version in a while loop.
      let result = false;
      let recommendedIndex = versionIndexOriginal;
      let versionIndexToBeTested = versionIndexOriginal;
      do {
        // keep trying to use the next lower schema version from the countSchemas[]
        versionIndexToBeTested++;
        schemaVersionToBeTested = countSchemas[versionIndexToBeTested];
        if (!schemaVersionToBeTested.active) {
          // Can not use this schema version. And there are no more 'active' list item left.
          break;
        }

        if(schemaVersionToBeTested.schemaName === 'draft-06'){
          // Not interested in downgrading to "draft-06". Skip this one.
          result = true;
          continue;
        }

        // update the schema with a new alternative $schema version
        schemaJson["$schema"] = `https://${schemaVersionToBeTested.schemaStr}`;
        // Test this new updated schema.
        result = validateViaSchemasafe(schemaJson);
        if (result && schemaVersionToBeTested.schemaName === "draft-04") {
          // draft-04 must also pass the tv-4 validator.
          const detected_$id = "$id" in schemaJson;
          if(detected_$id){
            // replace draft-06:'$id' with draft-04:'id'
            schemaJson["id"] = schemaJson["$id"];
            delete schemaJson["$id"];
          }
          result = validateViaTv4(schemaJson);
          wrong_$id_usage = result && detected_$id;
        }
        if (result) {
          // It pass the test. So this is the new recommended index
          recommendedIndex = versionIndexToBeTested;
        }
        // keep in the loop till it fail the validation process.
      } while (result);

      if (recommendedIndex !== versionIndexOriginal) {
        // found a different schema version that also work.
        const original = countSchemas[versionIndexOriginal].schemaName;
        const recommended = countSchemas[recommendedIndex].schemaName;
        const wrong_$id_usage_str = wrong_$id_usage ? "(also need to change $id to id)" : "";
        grunt.log.ok(`${callbackParameter.jsonName} (${original}) is also valid with (${recommended})${wrong_$id_usage_str}`);
      }
    }

    grunt.log.writeln();
    grunt.log.ok("Check if a lower $schema version will also pass the schema validation test");
    localSchemaFileAndTestFile({schema_1_PassScan: testLowerSchemaVersion});
    grunt.log.writeln();
    grunt.log.ok(`Total files scan: ${countScan}`);
  })

  function show_schema_versions(){
    let countSchemas = countSchemasType;
    let countSchemaVersionUnknown = 0;

    const getObj_ = (schemaJson) => {
      if ("$schema" in schemaJson) {
        const schemaVersion = schemaJson["$schema"]
        for (let obj of countSchemas) {
          if (schemaVersion.includes(obj.schemaStr)) {
            return obj;
          }
        }
      }
      // Can not find the $schema version.
      return undefined;
    }

    return {
      getObj : getObj_,
      process_data: (callbackParameter) =>{
        let obj;
        try {
          obj = getObj_(JSON.parse(callbackParameter.rawFile));
        }catch(e){
          // suppress possible JSON.parse exception. It will be process as obj = undefined
        }
        if(obj){
          obj.totalCount++;
        }else{
          countSchemaVersionUnknown++;
          grunt.log.error(`$schema is unknown in the file: ${callbackParameter.urlOrFilePath}`);
        }
      },
      process_data_done: () =>{
        // Show the all the schema version count.
        for (const obj of countSchemas) {
          grunt.log.ok(`Schemas using (${obj.schemaName}) Total files: ${obj.totalCount}`);
        }
        grunt.log.ok(`$schema unknown. Total files: ${countSchemaVersionUnknown}`);
      }
    }
  }

  grunt.registerTask("local_count_schema_versions", "Dynamically check local schema for schema version count", function () {
    const x = show_schema_versions();
    localSchemaFileAndTestFile({
          schema_1_PassScan: x.process_data,
          schema_1_PassScanDone: x.process_data_done
        },
        {
          fullScanAllFiles: true
        });
  })

  grunt.registerTask("remote_count_schema_versions", "Dynamically load remote schema file for schema version count", async function () {
    const done = this.async();
    const x = show_schema_versions();
    await remoteSchemaFile((callbackParameter) => {x.process_data(callbackParameter)}, false);
    x.process_data_done();
    done();
  })

  grunt.registerTask("local_check_for_wrong_id", "Dynamically load schema file for schema id check", function () {
    const schema_version = show_schema_versions();
    let countScan = 0;
    localSchemaFileAndTestFile({
          schema_1_PassScan: function (callbackParameter) {
            countScan++;
            const schemaJson = JSON.parse(callbackParameter.rawFile);
            const obj = schema_version.getObj(schemaJson);
            if (obj) {
              if ((obj.schemaName === "draft-04") && ("$id" in schemaJson)) {
                grunt.log.error(`Forbidden $id in draft-04 (${callbackParameter.jsonName})`);
              }
            }
          }
        },
        {
          fullScanAllFiles: true
        });
    grunt.log.writeln();
    grunt.log.ok(`Total files scan: ${countScan}`);
  })

  function hasBOM(buf) {
    return buf.length > 2 && buf[0] == 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  }

  function parseJSON(text) {
    try {
      return {
        json: JSON.parse(text),
      };
    } catch(err) {
      return {
        error: err.message,
      };
    }
  }

  const rawGithubPrefix = "https://raw.githubusercontent.com/";

  function isRawGithubURL(url) {
    return url.startsWith(rawGithubPrefix);
  }

  // extract repo, branch and path from a raw github url
  // returns false if not a raw github url
  function parseRawGithubURL(url) {
    if (isRawGithubURL(url)) {
      const [project, repo, branch, ...path] =
        url
          .substr(rawGithubPrefix.length)
          .split("/");
      return {
        repo: `https://github.com/${project}/${repo}`,
        base: `${project}/${repo}`,
        branch,
        path: path.join("/"),
      }
    }
    return false;
  }

  const util = require('util');
  const exec = util.promisify(require('child_process').exec);

  // heuristic to find valid version tag
  // disregard versions that are marked as special
  // require at least a number
  function validVersion(version) {
    const invalid =
      /alpha|beta|next|rc|tag|pre|\^/i.test(version)
      || !/\d+/.test(version);
    return !invalid;
  }

  // extract tags that might represent versions and return most recent
  // returns false none found
  async function githubNewestRelease(githubRepo) {
    const cmd = `git ls-remote --tags ${githubRepo}`;

    const result = await exec(cmd);
    const stdout = result.stdout.trim();
    if (stdout === "") {
      return false;
    }
    const refs =
      stdout
        .split("\n")
        .map(line =>
          line
            .split("\t")[1]
            .split("/")[2]
        );

    // sort refs using "natural" ordering (so that it works with versions)
    var collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: "base"
    });
    refs.sort(collator.compare);
    const refsDescending =
      refs
        .reverse()
        .filter(version => validVersion(version));
    if (refsDescending.length > 0) {
      return refsDescending[0];
    }
    return false;
  }

  // git default branch (master/main)
  async function githubDefaultBranch(githubRepo) {
    const cmd = `git ls-remote --symref ${githubRepo} HEAD`;
    const prefix = "ref: refs/heads/";

    const result = await exec(cmd);
    const stdout = result.stdout.trim();
    const rows =
      stdout
        .split("\n")
        .map(line => line.split("\t"));
    for(const row of rows) {
      if (row[0].startsWith(prefix)) {
        return row[0].substr(prefix.length);
      }
    }
    throw new exception("unable to determine default branch");
  }

  // construct raw github url to newest version
  async function rawGithubVersionedURL(url) {
    const urlParts = parseRawGithubURL(url);
    const newestVersion = await githubNewestRelease(urlParts.repo);
    let branch = newestVersion;
    if (branch === false) {
      branch = await githubDefaultBranch(urlParts.repo);
    }
    return {
      repo: urlParts.repo,
      branch,
      rawURL: `${rawGithubPrefix}${urlParts.base}/${branch}/${urlParts.path}`,
    }
  }

  // Async task structure: https://gruntjs.com/creating-tasks
  grunt.registerTask("validate_links", "Check if links return 200 and valid json", async function () {
    // Force task into async mode and grab a handle to the "done" function.
    const done = this.async();

    const catalogFileName = "api/json/catalog.json";
    const catalog = grunt.file.readJSON(catalogFileName);
    const got = require("got");

    for (let {url} of catalog.schemas) {
      if (isRawGithubURL(url)) {
        const {repo, branch, rawURL} = await rawGithubVersionedURL(url);
        if (url != rawURL) {
          grunt.log.error("repo", repo, "branch", branch, "url should be", rawURL);
          // test if the advised url works
          url = rawURL;
        }
      }

      try {
        const body = await got(url);
        if (body.statusCode != 200) {
          grunt.log.error(url, body.statusCode);
          continue;
        }
        if (hasBOM(body.rawBody)) {
          grunt.log.error(url, "contains UTF-8 BOM");
        }
        const result = parseJSON(body.rawBody.toString('utf8'))
        if (result.error) {
          grunt.log.error(url, result.error);
        }
      } catch(err) {
        grunt.log.error(url, err.message);
      }
    }

    done();
  });

  grunt.registerTask("local_test",
      [
        "local_validate_directory_structure",
        "local_filename_with_json_extension",
        "local_catalog",
        "local_catalog-fileMatch-conflict",
        "local_url-present-in-catalog",
        "local_schema-present-in-catalog-list",
        "local_bom",
        "local_find-duplicated-property-keys",
        "local_count_schema_versions",
        "local_search_for_schema_without_positive_test_files",
        "local_tv4_only_for_non_compliance_schema",
        "tv4",
        "local_schemasafe_test"
      ]);
  grunt.registerTask("remote_test", ["remote_count_schema_versions", "remote_bom", "remote_schemasafe_test"]);
  grunt.registerTask("default", ["http", "local_test"]);
  grunt.registerTask("local_maintenance", ["local_check_for_wrong_id", "local_test_downgrade_schema_version"]);


  grunt.loadNpmTasks("grunt-tv4");
  grunt.loadNpmTasks("grunt-http");
};
