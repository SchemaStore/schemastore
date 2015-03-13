/// <binding AfterBuild='build' />
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
                src: ["schemas/json/*.json", "!schemas/json/ninjs.json"] // ninjs is draft v3
            },
            options: {
                schemas: {
                    "http://json-schema.org/draft-04/schema#": grunt.file.readJSON("schemas/json/schema-draft-v4.json"),
                    "http://json.schemastore.org/jshintrc": grunt.file.readJSON("schemas/json/jshintrc.json"),
                    "http://json.schemastore.org/grunt-task": grunt.file.readJSON("schemas/json/grunt-task.json")
                },
            }
        },

        http: {
            composer: {
                options: { url: "https://raw.githubusercontent.com/composer/composer/master/res/composer-schema.json" },
                dest: "schemas/json/composer.json"
            },
            contribute: {
                options: { url: "https://raw.githubusercontent.com/mozilla/contribute.json/master/schema.json" },
                dest: "schemas/json/contribute.json"
            },
            swagger20: {
                options: { url: "https://raw.githubusercontent.com/swagger-api/swagger-spec/master/schemas/v2.0/schema.json" },
                dest: "schemas/json/swagger-2.0.json"
            },
            resume: {
                options: { url: "https://raw.githubusercontent.com/jsonresume/resume-schema/master/schema.json" },
                dest: "schemas/json/resume.json"
            },
            jsonld: {
                options: { url: "https://raw.githubusercontent.com/json-ld/json-ld.org/master/schemas/jsonld-schema.json" },
                dest: "schemas/json/jsonld.json"
            },
            ninjs: {
                options: { url: "http://www.iptc.org/std/ninjs/ninjs-schema_1.1.json" },
                dest: "schemas/json/ninjs.json"
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
        var dir = "test";
        var schemas = fs.readdirSync("schemas/json");

        var folders = fs.readdirSync(dir);
        var tv4 = {};

        schemas.forEach(function (schema) {
            var name = schema.replace(".json", "");
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

            //tv4[name].files = files;

            //// Write the config to disk so it can be consumed by the browser based test infrastru
            //fs.writeFileSync("test/tests.json", JSON.stringify(tv4));
        });
    });

    grunt.registerTask("build", ["setup", "tv4"]);
    grunt.registerTask("default", ["http", "build"]);

    grunt.loadNpmTasks("grunt-tv4");
    grunt.loadNpmTasks("grunt-contrib-watch");
    grunt.loadNpmTasks("grunt-http");
};
