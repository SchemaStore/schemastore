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
      catalog: {
        options: {
          root: grunt.file.readJSON("schemas/json/schema-catalog.json")
        },
        src: ["api/json/catalog.json"]
      },

      schemas: {
        options: {
          banUnknown: false,
          root: grunt.file.readJSON("schemas/json/schema-draft-v4.json")
        },
        src: ["schemas/json/*.json", "!schemas/json/ninjs-1.0.json"] // ninjs 1.0 is draft v3
      },
      options: {
        schemas: {
          "http://json-schema.org/draft-04/schema#": grunt.file.readJSON("schemas/json/schema-draft-v4.json"),
          "http://json.schemastore.org/jshintrc": grunt.file.readJSON("schemas/json/jshintrc.json"),
          "http://json.schemastore.org/grunt-task": grunt.file.readJSON("schemas/json/grunt-task.json"),
          "http://json.schemastore.org/jsonld": grunt.file.readJSON("schemas/json/jsonld.json"),
          "http://json.schemastore.org/schema-org-thing": grunt.file.readJSON("schemas/json/schema-org-thing.json"),
          "http://json.schemastore.org/xunit.runner.schema": grunt.file.readJSON("schemas/json/xunit.runner.schema.json"),
          "http://json.schemastore.org/feed-1": grunt.file.readJSON("schemas/json/feed-1.json"),
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
        options: { url: "https://xunit.github.io/schema/v2.3/xunit.runner.schema.json" },
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

  grunt.registerTask("setup", "Dynamically load schema validation based on the files and folders in /test/", function () {
    var fs = require('fs');

    var testDir = "test";
    var schemas = fs.readdirSync("schemas/json");

    var folders = fs.readdirSync(testDir);
    var tv4 = {};

    const notCovered = schemas.filter(schemaName => {
      const folderName = schemaName.replace("\.json","");
      return !folders.includes(folderName.replace("_", "."));
    });

    if(notCovered.length) {
      const percent = (notCovered.length / schemas.length) * 100;
      console.log(`${parseInt(percent)}% of schemas do not have tests or have malformed test folders`);
    }

    schemas.forEach(function (schema) {
      var name = schema.replace(".json", "");
      tv4[name] = {};
      tv4[name].files = [];
    });

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

  grunt.registerTask("schemasafe_test", "Dynamically load schema validation based on the files and folders in /test/", function () {

    const validationModeDefault = { includeErrors: true, allErrors: true};

    const validationModeStrong = { includeErrors: true, allErrors: true , mode: 'strong'};

    const { validator } = require('@exodus/schemasafe')

    const fs = require('fs');

    const schemaValidation = grunt.file.readJSON('schema-validation.json');

    const testDir = "test";
    const schemas = fs.readdirSync("schemas/json");

    const folders = fs.readdirSync(testDir);

    const notCovered = schemas.filter(schemaName => {
      const folderName = schemaName.replace("\.json","");
      return !folders.includes(folderName.replace("_", "."));
    });

    if(notCovered.length) {
      const percent = (notCovered.length / schemas.length) * 100;
      console.log(`${parseInt(percent)}% of schemas do not have tests or have malformed test folders`);
    }

    // Verify each schema file
    schemas.forEach(function (schema_file_name) {

      const schema_full_path_name = `schemas/json/${schema_file_name}`

      // If not a file, ignore and continue. We only care about files.
      if (!isFile(schema_full_path_name)) {
        return;
      }

      // If it's the .DS_Store folder from macOS, ignore and continue.
      if (schema_file_name === ".DS_Store") {
        return;
      }

      // skip test if present in the list 'skiptest'
      const skipTest = schemaValidation.skiptest.find(
          function(value, index) {
            return value === schema_file_name;}
            );
      if(skipTest){
        console.log(`========> ${skipTest} Skip this schema for validation. This schema does not pass with the latest validator.`);
        return;
      }

      // Must this schema be parse in strong mode?
      const strongMode = schemaValidation.strongmode.find(
          function(value, index) {
            return value === schema_file_name;}
      );
      let selectedParserMode =  strongMode ? validationModeStrong : validationModeDefault;
      let selectedParserModeString =  strongMode ? "(strong mode)  " : "(default mode) ";
      // Start validate the JSON schema
      console.log(`${selectedParserModeString}validate   | ${schema_full_path_name}`);
      const x = grunt.file.readJSON(schema_full_path_name);
      validator(x, selectedParserMode);
      console.log(`${selectedParserModeString}pass       | ${schema_full_path_name}`);
    });

    // Mow run all test in each test folder
    folders.forEach(function (folder) {

      // If it's a file, ignore and continue. We only care about folders.
      if (isFile(folder)) {
        return;
      }

      // If it's the .DS_Store folder from macOS, ignore and continue.
      if (folder === ".DS_Store") {
        return;
      }

      console.log(``);
      console.log(`test folder   : ${folder}`);

      // skip test if present in the list 'skiptest'
      const skipTest = schemaValidation.skiptest.find(
          function(value, index) {
            return value === `${folder}.json`;}
      );
      if(skipTest){
        console.log(`========> Skip this test folder for validation: ${folder}`);
        console.log(`This schema or test does not pass with the latest validator.`);
        console.log(`see file: schema-validation.json`);
        return;
      }

      // Must this schema be parse in strong mode?
      const strongMode2 = schemaValidation.strongmode.find(
          function(value, index) {
            return value === `${folder}.json`;}
      );

      let selectedParserMode2 =  strongMode2 ? validationModeStrong : validationModeDefault;
      let selectedParserModeString2 =  strongMode2 ? "(strong mode)  " : "(default mode) ";

      const toTestFilePath = toPath(testDir, folder);

      const name = folder.replace("_", ".");

      const schema = grunt.file.readJSON(`schemas/json/${name}.json`);

      const files = fs.readdirSync(pt.join(testDir, folder)).map(toTestFilePath);

      if(!files.length) {
        throw new Error(`Found folder with no test files: ${folder}`);
      }

      const validate = validator(schema, selectedParserMode2);
      if(!validate){
        throw new Error(`Error in schema: ${name}`);
      }

      files.forEach(function (file) {
        const x = grunt.file.readJSON(file);
        if(validate(x)){
          console.log(`${selectedParserModeString2}test pass: ${file}`);
        }else{
          console.log(`${selectedParserModeString2}test failed: ${file}`);
          throw new Error(`Error in test: ${validate.errors}`);
        }
      })
    });
  });


  grunt.registerTask("build", ["setup", "tv4"]);
  grunt.registerTask("default", ["http", "build"]);
  grunt.registerTask("schemasafe", ["schemasafe_test"]);



  grunt.loadNpmTasks("grunt-tv4");
  grunt.loadNpmTasks("grunt-contrib-watch");
  grunt.loadNpmTasks("grunt-http");
};
