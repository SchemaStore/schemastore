/// <binding SolutionOpened='watch' />

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
                    root: grunt.file.readJSON("schemas/json/schema-draft-v4.json"),
                },
                src: ["schemas/json/*.json"]
            },
            options: {
                schemas: {
                    "http://json-schema.org/draft-04/schema#": grunt.file.readJSON("schemas/json/schema-draft-v4.json"),
                    "http://json.schemastore.org/jshintrc": grunt.file.readJSON("schemas/json/jshintrc.json"),
                    "http://json.schemastore.org/grunt-task": grunt.file.readJSON("schemas/json/grunt-task.json")
                },
            }
        },

        watch: {
            tv4: {
                files: ["test/**/*.json", "schemas/json/*.json", "api/json/*.json"],
                tasks: ["default"]
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
        var fs = require("fs");
        var dir = "test";
        var schemas = fs.readdirSync("schemas/json");

        var folders = fs.readdirSync(dir);
        var tv4 = {};

        schemas.forEach(function (schema) {
            var name = schema.replace(".json", "")//.replace(".", "_");
            tv4[name] = {};
            tv4[name].files = [];
        });

        folders.forEach(function (folder) {

            // If it's a file, ignore and continue. We only care about folders.
            if (folder.indexOf('.') > -1)
                return;

            var name = folder.replace("_", ".");
            var schema = grunt.file.readJSON("schemas/json/" + name + ".json");
            var files = fs.readdirSync(dir + "/" + folder).map(function (file) { return dir + "/" + folder + "/" + file });

            grunt.config.set("tv4." + folder, {
                options: {
                    root: schema,
                    banUnknown: false
                },
                src: files
            });

            tv4[name].files = files;

            // Write the config to disk so it can be consumed by the browser based test infrastru
            fs.writeFileSync("test/tests.json", JSON.stringify(tv4));
        });
    });

    grunt.loadNpmTasks("grunt-tv4");
    grunt.loadNpmTasks("grunt-contrib-watch");

    grunt.registerTask("default", ["setup", "tv4"]);
};
