/// <binding AfterBuild='build' />

const pt = require("path");

/**
 * @summary tests if an entry is a folder
 * @param {(string|import("fs").Dirent)} entry
 * @returns {boolean}
 */
const isFile = (entry) => /.+(?=\.[a-zA-Z]+$)/.test(entry);

/**
 * @summary joins file path parts
 * @param {string} base
 * @param {string} path
 */
const toPath = (base, path) =>

  /**
   * @param {string} fileName
   * @returns {string}
   */
  (fileName) => pt.join(base, path, fileName);


module.exports = function (grunt) {
  "use strict";

  grunt.file.preserveBOM = false;
  grunt.initConfig({

    tv4: {

      // Deprecated -> now use "local_catalog"
      // catalog: {
      //   options: {
      //     root: grunt.file.readJSON("schemas/json/schema-catalog.json")
      //   },
      //   src: ["api/json/catalog.json"]
      // },

      // Deprecated -> now use "local_tv4_only_for_non_compliance_schema"
      // schemas: {
      //   options: {
      //     banUnknown: false,
      //     root: grunt.file.readJSON("schemas/json/schema-draft-v4.json")
      //   },
      //   src: ["schemas/json/*.json", "!schemas/json/ninjs-1.0.json"] // ninjs 1.0 is draft v3
      // },
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

    watch: {
      tv4: {
        files: ["test/**/*.json", "schemas/json/*.json"],
        tasks: ["setup", "tv4"]
      },
      gruntfile: {
        files: "gruntfile.js"
      },
      options: {
        spawn: false,
        event: ["changed"]
      }
    }
  });

  // "setup" is deprecated -> now use "local_tv4_only_for_non_compliance_schema"
  grunt.registerTask("setup", "Dynamically load schema validation based on the files and folders in /test/", function () {
    var fs = require('fs');

    var testDir = "test";
    var schemas = fs.readdirSync("schemas/json");

    var folders = fs.readdirSync(testDir);
//    var tv4 = {};

    const notCovered = schemas.filter(schemaName => {
      const folderName = schemaName.replace("\.json","");
      return !folders.includes(folderName.replace("_", "."));
    });

    if(notCovered.length) {
      const percent = (notCovered.length / schemas.length) * 100;
      console.log(`${parseInt(percent)}% of schemas do not have tests or have malformed test folders`);
    }

    // schemas.forEach(function (schema) {
    //   var name = schema.replace(".json", "");
    //   tv4[name] = {};
    //   tv4[name].files = [];
    // });

    folders.forEach(function (folder) {

      // If it's a file, ignore and continue. We only care about folders.
      if (isFile(folder)) {
        return;
      }

      // If it's the .DS_Store folder from macOS, ignore and continue.
      if (folder == ".DS_Store") {
        return;
      }

      const toTestFilePath = toPath(testDir, folder);

      const name = folder.replace("_", ".");

      const schema = grunt.file.readJSON(`schemas/json/${name}.json`);

      const files = fs.readdirSync(pt.join(testDir, folder)).map(toTestFilePath);

      if(!files.length) {
        throw new Error(`Found folder with no test files: ${folder}`);
      }

      const valid = folder.replace(/\./g, "\\.");

      grunt.config.set("tv4." + valid, {
        options: {
          root: schema,
          banUnknown: false
        },
        src: files
      });

      //tv4[name].files = files;

      //// Write the config to disk so it can be consumed by the browser based test infrastru
      //fs.writeFileSync("test/tests.json", JSON.stringify(tv4));
    });
  });

  function getUrlFromCatalog(catalogUrl) {
    const catalog = require('./api/json/catalog.json');
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

  async function remoteSchemaFile(schema_1_PassScan){
    const got = require("got");
    const catalog = require('./api/json/catalog.json');
    const schemas = catalog["schemas"];
    const url_ = require("url");
    const path = require("path");

    for( const {url} of schemas ){
      if(url.startsWith("https://json.schemastore.org") ||
          url.startsWith("http://json.schemastore.org")){
        // Skip local schema
        continue;
      }
      try {
        const response = await got(url);
        if (response["statusCode"] === 200) {
          const parsed = url_.parse(url);
          const callbackParameter = {
            jsonName: path.basename(parsed.pathname),
            rawFile: response["rawBody"],
            urlOrFilePath: url,
            schemaScan: true
          }
          schema_1_PassScan(callbackParameter);
          grunt.log.ok(url);
        }else{
          grunt.log.error(url, response["statusCode"]);
        }
      } catch (error) {
        grunt.log.writeln('')
        grunt.log.error(url, error.name, error.message);
        grunt.log.writeln('')
      }
    }
  }

  function localSchemaFileAndTestFile(
      {
        schema_1_PassScan = undefined,
        schema_1_PassScanDone = undefined,
        schema_2_PassScan = undefined,
        test_1_PassScan = undefined,
        test_1_PassScanDone = undefined,
      },
      {
        fullScanAllFiles = false,
        tv4OnlyMode = false,
        logTestFolder = true
      } = {}) {
    // The structure is copy and paste from the tv4 function
    const path = require("path");
    const fs = require('fs');
    const schemaValidation = grunt.file.readJSON('schema-validation.json');
    const testDir = "test";
    const schemas = fs.readdirSync("schemas/json");
    const folders = fs.readdirSync(testDir);
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

    // Do not scan the test folder if there are no one to process the data
    const skipTestFolder = (test_1_PassScan === undefined);

    if (tv4OnlyMode === true) {
      // tv4 need to scan the schemaValidation list only
      fullScanAllFiles = false;
    }

    if (skipTestFolder === false && logTestFolder === true ) {
      // Show only test folder percentage if in test folder scan mode.
      const notCovered = schemas.filter(schemaName => {
        const folderName = schemaName.replace("\.json", "");
        return !folders.includes(folderName.replace("_", "."));
      });

      if (notCovered.length) {
        const percent = (notCovered.length / schemas.length) * 100;
        grunt.log.writeln(`${Math.round(percent)}% of schemas do not have tests or have malformed test folders`);
      }
    }

    // Verify each schema file
    schemas.forEach((schema_file_name) => {

      const schema_full_path_name = `schemas/json/${schema_file_name}`

      // If not a file, ignore and continue. We only care about files.
      if (!isFile(schema_full_path_name)) {
        return;
      }

      // If it's the .DS_Store folder from macOS, ignore and continue.
      if (schema_file_name === ".DS_Store") {
        return;
      }

      if (canThisTestBeRun(schema_file_name) === false) {
        return;
      }

      callbackParameter = {
        // Return the real Raw file for BOM file test rejection
        rawFile: fs.readFileSync(schema_full_path_name),
        jsonName: path.basename(schema_full_path_name),
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

    if (skipTestFolder === true) {
      return
    }

    // Now run all test in each test folder
    folders.forEach((folder) => {
      // If it's a file, ignore and continue. We only care about folders.
      if (isFile(folder)) {
        return;
      }

      // If it's the .DS_Store folder from macOS, ignore and continue.
      if (folder === ".DS_Store") {
        return;
      }

      if (canThisTestBeRun(`${folder}.json`) === false) {
        return;
      }

      if (tv4OnlyMode === false && logTestFolder === true) {
        // tv4 already have it own console output take care of.
        grunt.log.writeln(``);
        grunt.log.writeln(`test folder   : ${folder}`);
      }

      const toTestFilePath = toPath(testDir, folder);
      const name = folder.replace("_", ".");
      const files = fs.readdirSync(pt.join(testDir, folder)).map(toTestFilePath);

      if (!files.length) {
        throw new Error(`Found folder with no test files: ${folder}`);
      }

      const schemaFileWithPath = `schemas/json/${name}.json`;
      if (schema_2_PassScan) {
        callbackParameter = {
          // Return the real Raw file for BOM file test rejection
          rawFile: fs.readFileSync(schemaFileWithPath),
          jsonName: path.basename(schemaFileWithPath),
          urlOrFilePath: schemaFileWithPath,
          schemaScan: false
        }
        schema_2_PassScan(callbackParameter);
      }

      if (test_1_PassScan) {
        // Test file may have BOM. But this must be strip for the next process
        grunt.file.preserveBOM = false; // Strip file from BOM
        files.forEach(function (file) {
          // must ignore BOM in test
          callbackParameter = {
            rawFile: grunt.file.read(file),
            jsonName: path.basename(file.toString()),
            urlOrFilePath: file,
            schemaScan: false
          }
          test_1_PassScan(callbackParameter);
        });
        if (test_1_PassScanDone) {
          test_1_PassScanDone();
        }
      }
    });
  }

  function testSchemaFileForBOM(callbackParameter){
    // JSON schema file must not have any BOM type
    const buffer = callbackParameter.rawFile;

    if(buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF){
      throw new Error(`Schema file must not have UTF-8 BOM: ${callbackParameter.urlOrFilePath}`);
    }
    if(buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF){
      throw new Error(`Schema file must not have UTF-16 (BE) BOM: ${callbackParameter.urlOrFilePath}`);
    }
    if(buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE){
      throw new Error(`Schema file must not have UTF-16 (LE) BOM: ${callbackParameter.urlOrFilePath}`);
    }
    if(buffer.length >= 4 && buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0xFF && buffer[3] === 0xFE){
      throw new Error(`Schema file must not have UTF-32 (BE) BOM: ${callbackParameter.urlOrFilePath}`);
    }
    if(buffer.length >= 4 && buffer[0] === 0xFF && buffer[1] === 0xFE && buffer[2] === 0x00 && buffer[3] === 0x00){
      throw new Error(`Schema file must not have UTF-32 (LE) BOM: ${callbackParameter.urlOrFilePath}`);
    }
  }

  function tv4() {
    const schemaV4JSON = require('./schemas/json/schema-draft-v4.json');
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
    const schemaValidation = require('./schema-validation.json');
    const includeErrors = true;
    const { validator } = require('@exodus/schemasafe')
    const textValidate = "validate    | ";
    const textPassSchema = "pass schema | ";
    const textPassTest = "pass test   | ";
    const textFailedTest = "failed test | ";

    let validate = undefined;
    let selectedParserModeString = "(default mode) ";
    let countSchema = 0;
    let schemas = [];

    const fillExternalSchemaArray = () => {
      const ExternalSchema = schemaValidation["externalschema"];
      for( const schema_file_name of ExternalSchema){
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
      // mode can be 'strong' | lax | undefined
      let mode = undefined;
      selectedParserModeString = "(default mode)  ";

      if(schemaValidation["strongmode"].includes(callbackParameter.jsonName)){
        mode = 'strong';
        selectedParserModeString = "(strong mode)  ";
      }else{
        if(schemaValidation["laxmode"].includes(callbackParameter.jsonName)){
          mode = 'lax';
          selectedParserModeString = "(lax mode)     ";
        }
      }

      // Start validate the JSON schema
      try {
        validate = validator(JSON.parse(callbackParameter.rawFile) , {schemas, mode, includeErrors});
      }catch (e) {
        grunt.log.error(`${selectedParserModeString}${textValidate}${callbackParameter.urlOrFilePath}`);
        throw new Error(e);
      }
      countSchema++;
      grunt.log.ok(selectedParserModeString + textPassSchema + callbackParameter.urlOrFilePath);
    }

    const processTestFile = (callbackParameter) => {
      let json;
      try {
        json = JSON.parse(callbackParameter.rawFile);
      }catch (e) {
        grunt.log.error(`Error in test: ${callbackParameter.urlOrFilePath}`)
        throw new Error(e);
      }

      if(validate(json)){
        grunt.log.ok(selectedParserModeString+textPassTest + callbackParameter.urlOrFilePath);
      }else{
        grunt.log.error(selectedParserModeString+textFailedTest + callbackParameter.urlOrFilePath);
        grunt.log.error("(Schema file) keywordLocation: " + validate.errors[0].keywordLocation);
        grunt.log.error("(Test file) instanceLocation: " + validate.errors[0].instanceLocation);
        throw new Error(`Error in test`);
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
      testTestFile: processTestFile
    }
  }

  grunt.registerTask("local_tv4_only_for_non_compliance_schema", "Dynamically load local schema file for validation with /test/", function () {
    const x = tv4();
    localSchemaFileAndTestFile({
      schema_2_PassScan: x.testSchemaFile,
      schema_1_PassScanDone: x.testSchemaFileDone,
      test_1_PassScan: x.testTestFile,
      test_1_PassScanDone: x.testTestFileDone
    }, {tv4OnlyMode: true});
    // The tv4 task is actually run after this registerTask()
  })

  grunt.registerTask("local_schemasafe_test", "Dynamically load local schema file for validation with /test/", function () {
    const x = schemasafe();
    localSchemaFileAndTestFile({
      schema_2_PassScan: x.testSchemaFile,
      test_1_PassScan: x.testTestFile,
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
    await remoteSchemaFile(testSchemaFileForBOM);
    done();
  })

  grunt.registerTask("local_catalog", "Catalog validation", function () {
    const {validator} = require('@exodus/schemasafe');
    const catalogFile = require("./api/json/catalog.json");
    const catalogSchema = require("./schemas/json/schema-catalog.json");

    const validate = validator(catalogSchema, {includeErrors: true});
    if (validate(catalogFile)) {
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
    localSchemaFileAndTestFile( {test_1_PassScan : findDuplicatedProperty}, {logTestFolder : false});
    grunt.log.ok('No duplicated property key found in test files. Total files scan: ' + countScan);
  })

  grunt.registerTask("local_url-present-in-catalog", "local url must reference to a file", function () {
    const fs = require('fs')
    const httpPath = "http://json.schemastore.org"
    const httpsPath = "https://json.schemastore.org"
    const schemaPath = './schemas/json/'
    let countScan = 0;

    getUrlFromCatalog(catalogUrl => {
      if (catalogUrl.startsWith(httpsPath) || catalogUrl.startsWith(httpPath)) {
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
    const schemaValidation = require('./schema-validation.json');
    const httpPath = "http://json.schemastore.org"
    const httpsPath = "https://json.schemastore.org"
    let countScan = 0;
    let allCatalogLocalJsonFiles = [];

    // Read all the JSON file name from catalog and add it to allCatalogLocalJsonFiles[]
    getUrlFromCatalog(catalogUrl => {
      if (catalogUrl.startsWith(httpsPath) || catalogUrl.startsWith(httpPath)) {
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
    const catalog = require('./api/json/catalog.json');
    const schemaValidation = require('./schema-validation.json');
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
        "local_catalog",
        "local_catalog-fileMatch-conflict",
        "local_url-present-in-catalog",
        "local_schema-present-in-catalog-list",
        "local_bom",
        "local_find-duplicated-property-keys",
        "local_tv4_only_for_non_compliance_schema",
        "tv4",
        "local_schemasafe_test"
      ]);
  grunt.registerTask("remote_test", ["remote_bom", "remote_schemasafe_test"]);
  //grunt.registerTask("build", ["setup", "tv4"]); // deprecated, "setup" is no longer used
  grunt.registerTask("build", ["local_test"]); // "local_test"
  grunt.registerTask("default", ["http", "build"]);
  grunt.registerTask("schemasafe", ["local_test"]);


  grunt.loadNpmTasks("grunt-tv4");
  grunt.loadNpmTasks("grunt-contrib-watch");
  grunt.loadNpmTasks("grunt-http");
};
