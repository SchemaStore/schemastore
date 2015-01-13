(function (global) {
    "use strict";

    var visibleEnvironments = ["all", "dev", "prod", "staging", "dist", "test", "build"],
        hiddenEnvironments = ["development", "production", "tests", "release", "core", "assets", "example", "examples", "docs", "main", "demo", "app", "server", "client", "i18n", "base"];

    var _configObject = function () {
        var baseConfig = {
            /// <field name="cwd" type="String">All src matches are relative to (but don't include) this path.</field>
            cwd: "",

            /// <field name="dest" type="String">Destination path prefix.</field>
            dest: "",

            /// <field name="dot" type="Boolean">Allow patterns to match filenames starting with a period, even if the pattern does not explicitly have a period in that spot.</field>
            dot: true,

            /// <field name="expand" type="Boolean">Process a dynamic src-dest file mapping.</field>
            expand: true,

            /// <field name="ext" type="String">Replace any existing extension with this value in generated dest paths.</field>
            ext: "",

            /// <field name="extDot" type="String">Used to indicate where the period indicating the extension is located. Can take either "first" (extension begins after the first period in the file name) or "last" (extension begins after the last period), and is set by default to 'first".</field>
            extDot: "",

            /// <field name="files" type="String, Array or Object" />
            files: {},

            /// <field name="filter" type="String or Function">Either a valid "fs.Stats" method name or a function that is passed the matched src filepath and returns true or false.</field>
            filter: "",

            /// <field name="flatten" type="Boolean">Remove all path parts from generated dest paths.</field>
            flatten: true,

            /// <field name="matchBase" type="String">If set, patterns without slashes will be matched against the basename of the path if it contains slashes. For example, a?b would match the path /xyz/123/acb, but not /xyz/acb/123.</field>
            matchBase: "",

            /// <field name="nonull" type="Boolean">If set to true then the operation will include non-matching patterns.</field>
            nonull: true,
            options: {},

            /// <field name="rename" type="function(destBase, destPath)">This function is called for each matched src file, (after extension renaming and flattening). The dest and matched src path are passed in, and this function must return a new dest value. If the same dest is returned more than once, each src which used it will be added to an array of sources for it.</field>
            rename: function (destBase, destPath) { },

            /// <field name="src" type="String or Array">Pattern(s) to match, relative to the cwd.</field>
            src: []
        };

        var bowerConfig = {
            install: {
                options: {
                    /// <field name="targetDir" type="String">A directory where you want to keep your Bower packages.</field>
                    targetDir: "",

                    /// <field name="install" type="Boolean">Whether you want to run bower install task itself (e.g. you might not want to do this each time on CI server).</field>
                    install: true,

                    /// <field name="cleanTargetDir" type="Boolean">Will clean target dir before running install.</field>
                    cleanTargetDir: false,

                    /// <field name="cleanBowerDir" type="Boolean">Will remove bower's dir after copying all needed files into target dir.</field>
                    cleanBowerDir: false,

                    /// <field name="copy" type="Boolean">Copy Bower packages to target directory.</field>
                    copy: true,

                    /// <field name="cleanup" type="Boolean">If set to true or false then both "cleanBowerDir" & "cleanTargetDir" are set to the value of cleanup.</field>
                    cleanup: undefined,

                    /// <field name="layout" type="String">There are two built-in named layouts: "byType" and "byComponent".</field>
                    layout: true,

                    /// <field name="verbose" type="Boolean">The task will provide more (debug) output when this option is set to true. You can also use --verbose when running task for same effect.</field>
                    verbose: true,

                    /// <field name="bowerOptions" type="Object">An options object passed through to the bower.install API.</field>
                    bowerOptions: {
                        /// <field name="forceLatest" type="Boolean">Force latest version on conflict.</field>
                        forceLatest: true,

                        /// <field name="production" type="Boolean">Do not install project devDependencies.</field>
                        production: true
                    }
                }
            }
        };

        var lessConfig = {
            options: {
                /// <field name="paths" type="String, Array or Function">Specifies directories to scan for @import directives when parsing. Default value is the directory of the source, which is probably what you want.</field>
                paths: "",

                /// <field name="rootpath" type="Boolean">A path to add on to the start of every URL resource.</field>
                rootpath: "",

                /// <field name="compress" type="Boolean">Compress output by removing some whitespaces.</field>
                compress: false,

                /// <field name="yuicompress" type="Boolean" />
                yuicompress: false,

                /// <field name="cleancss" type="Boolean" />
                cleancss: true,

                /// <field name="plugins" type="Array" elementType="String">Allows passing plugins.</field>
                plugins: [""],

                /// <field name="ieCompat" type="Boolean">Enforce the CSS output is compatible with Internet Explorer 8.</field>
                ieCompat: true,

                /// <field name="optimization" type="Integer">Set the parser's optimization level. The lower the number, the less nodes it will create in the tree. This could matter for debugging, or if you want to access the individual nodes in the tree.</field>
                optimization: false,

                /// <field name="strictImports" type="Boolean">Force evaluation of imports.</field>
                strictImports: false,

                /// <field name="strictMath" type="Boolean">When enabled, math is required to be in parenthesis.</field>
                strictMath: false,

                /// <field name="strictUnits" type="Boolean">When enabled, less will validate the units used (e.g. 4px/2px = 2, not 2px and 4em/2px throws an error).</field>
                strictUnits: false,

                /// <field name="syncImport" type="Boolean">Read @import'ed files synchronously from disk.</field>
                syncImport: false,

                /// <field name="dumpLineNumbers" type="Boolean">Configures -sass-debug-info support. Accepts following values: "comments", "mediaquery", "all".</field>
                dumpLineNumbers: false,

                /// <field name="relativeUrls" type="Boolean">Rewrite URLs to be relative. false: do not modify URLs.</field>
                relativeUrls: false,

                /// <field name="customFunctions" type="Object">Define custom functions to be available within your LESS stylesheets.</field>
                customFunctions: {},

                /// <field name="sourcemap" type="Boolean">Enable source maps</field>
                sourcemap: false,

                /// <field name="sourceMapFilename" type="String">Write the source map to a separate file with the given filename.</field>
                sourceMapFilename: "",

                /// <field name="sourceMapBasepath" type="String">Sets the base path for the less file paths in the source map.</field>
                sourceMapBasepath: "",

                /// <field name="sourceMapRootpath" type="String">Adds this path onto the less file paths in the source map.</field>
                sourceMapRootpath: "",

                /// <field name="modifyVars" type="Object">Overrides global variables. Equivalent to  --modify-vars='VAR=VALUE'  option in less.</field>
                modifyVars: {},

                /// <field name="banner" type="String">A banner text to inject at the top of the compiled CSS file.</field>
                banner: ""
            }
        };

        var typescriptConfig = {
            options: {
                /// <field name="noLib" type="Boolean">Do not include a default lib.d.ts with global declarations.</field>
                noLib: true,

                /// <field name="target" type="String">Specify ECMAScript target version: "ES3" (default) or "ES5".</field>
                target: "ES3",

                /// <field name="module" type="String">Specify module code generation: "commonjs" (default) or "amd".</field>
                module: "commonjs",

                /// <field name="sourceMap" type="Boolean">Generates corresponding .map files</field>
                sourceMap: false,

                /// <field name="declaration" type="Boolean">Generates corresponding .d.ts file</field>
                declaration: true,

                /// <field name="removeComments" type="Boolean">Do not emit comments to output.</field>
                removeComments: false,

                /// <field name="noImplicitAny" type="Boolean">Warn on expressions and declarations with an implied 'any' type.</field>
                noImplicitAny: true,

                /// <field name="noResolve" type="Boolean">Skip resolution and preprocessing.</field>
                noResolve: false
            }
        };

        var watchConfig = function () {

            var base = {
                /// <field name="files" type="String or Array">One of more globbing patterns for files to watch.</field>
                files: {},
                /// <field name="tasks" type="String or Array">One or more names of tasks to execute.</field>
                tasks: []
            };

            return {
                js: base,
                javascript: base,
                css: base,
                less: base,
                sass: base,
                gruntfile: base,
                jsx: base,
                ts: base,
                typescript: base
            };
        };

        var generic = addEnvironments(baseConfig);

        return {
            autoprefixer: generic,
            bower: bowerConfig,
            clean: generic,
            coffee: generic,
            compass: generic,
            compress: generic,
            concat: generic,
            copy: generic,
            csslint: generic,
            cssmin: generic,
            imagemin: generic,
            jasmine: generic,
            jshint: generic,
            jscs: generic,
            less: addEnvironments(merge(baseConfig, lessConfig)),
            pkg: {},
            qunit: {},
            sass: generic,
            typescript: addEnvironments(merge(baseConfig, typescriptConfig)),
            uglify: generic,
            usemin: generic,
            watch: watchConfig()
        };
    };

    var _grunt = function () {
        return {
            config: _config,
            event: _event,
            fail: {
                // Display a warning and abort Grunt immediately. Grunt will continue processing tasks if the --force command-line option was specified. The error argument can be a string message or an error object.
                warn: function (error, errorcode) { },

                // Display a warning and abort Grunt immediately. The error argument can be a string message or an error object.
                fatal: function (error, errorcode) { }
            },
            file: _file,
            /**
             * Initializes the Grunt configuration.
             * @param {configObject} config Grunt configuration.
             */
            initConfig: function () { },
            loadNpmTasks: _task.loadNpmTasks,
            loadTasks: _task.loadTasks,
            log: merge(_verbose, _utils),
            registerMultiTask: _task.registerMultiTask,
            registerTask: _task.registerTask,
            renameTask: _task.renameTask,
            task: _task,
            template: _template,
            verbose: _verbose
        };
    };

    var _file = {
        /// <field name="defaultEncoding" type="String" />
        defaultEncoding: "utf-8",

        /// <field name="preserveBOM" type="Boolean" />
        preserveBOM: false,

        // Read and return a file's contents. Returns a string, unless options.encoding is null in which case it returns a Buffer.
        read: function (filepath, options) { },

        // Read a file's contents, parsing the data as JSON and returning the result. See grunt.file.read for a list of supported options.
        readJSON: function (filepath, options) { },

        // Read a file's contents, parsing the data as YAML and returning the result. See grunt.file.read for a list of supported options.
        readYAML: function (filepath, options) { },

        // Write the specified contents to a file, creating intermediate directories if necessary. Strings will be encoded using the specified character encoding, Buffers will be written to disk as-specified.
        write: function (filepath, contents, options) { },

        // Copy a source file to a destination path, creating intermediate directories if necessary.
        copy: function (srcpath, destpath, options) { },

        // Delete the specified filepath. Will delete files and folders recursively.
        "delete": function (filepath, contents, options) { },

        // Create a directory along with any intermediate directories.
        mkdir: function (dirpath, mode) { },

        // Recurse into a directory, executing callback for each file.
        recurse: function (rootdir, callback) { },

        // Return a unique array of all file or directory paths that match the given globbing pattern(s).
        expand: function (patterns) { },

        // Returns an array of src-dest file mapping objects.
        expandMapping: function (patterns, dest, options) { },

        // Returns a uniqued array of all file paths that match any of the specified globbing patterns.
        match: function (patterns, filepaths) { return [""]; },

        // This method contains the same signature and logic as the grunt.file.match method, but simply returns true if any files were matched, otherwise false.
        isMatch: function (patterns, filepaths) { return true; },

        // Check if a file exist on disk.
        exists: function (path) { return true; },

        // Check if the given path is a symbolic link.
        isLink: function (path) { return true; },

        // Check if the given path is a directory.
        isDir: function (path) { return true; },

        // Check if the given path is a file.
        isFile: function (path) { return true; },

        // Check if the given file path is absolute.
        isPathAbsolute: function (path) { return true; },

        // Do all the specified paths refer to the same path? Returns a boolean.
        arePathsEquivalent: function (path1, path2) { return true; },

        // Are all descendant path(s) contained within the specified ancestor path? Returns a boolean.
        doesPathContain: function (ancestorPath, descendantPath1) { return true; },

        // Is a given file path the CWD? Returns a boolean.
        isPathCwd: function (path) { return true; },

        // Is a given file path inside the CWD? Note: CWD is not inside CWD. Returns a boolean.
        isPathInCwd: function (path) { return true; },

        // Change grunt's current working directory (CWD). By default, all file paths are relative to the Gruntfile. This works just like the --base command-line option.
        setBase: function (path) { return true; }
    };

    var _template = {
        // Process a Lo-Dash template string.
        process: function (template, options) { },

        // Set the Lo-Dash template delimiters to a predefined set in case grunt.util._.template needs to be called manually.
        setDelimiters: function (name) { },

        // Add a named set of Lo-Dash template delimiters
        addDelimiters: function (name, opener, closer) { },

        // Format a date using the dateformat library.
        date: function (date, format) { },

        // Format today's date using the dateformat library.
        today: function (format) { }
    };

    var _task = {
        registerTask: function () {
            /// <signature>
            ///   <summary>Registers a Grunt task.</summary>
            ///   <param name="name" type="string">The name of the task.</param>
            ///   <param name="callback" type="function">A function that is run when the task is executed.</param>
            /// </signature>
            /// <signature>
            ///   <summary>Registers a new aliased task made up of one or more other tasks and targets.</summary>
            ///   <param name="name" type="string">The name of the task.</param>
            ///   <param name="message" type="string">Log a message.</param>
            ///   <param name="callback" type="function">A function that is run when the task is executed.</param>
            /// </signature>
            /// <signature>
            ///   <summary>Registers a new aliased task made up of one or more other tasks and targets.</summary>
            ///   <param name="name" type="string">The name of the task.</param>
            ///   <param name="tasks" type="Array" elementType="String">A string array of task names.</param>
            /// </signature>
        },

        // Registers a new aliased task made up of one or more other tasks and targets.
        registerMultiTask: function (name, description, fn) { },

        // Fail the task if some other task failed or never ran.
        requires: function (taskName) { },

        // Check with the name, if a task exists in the registered tasks. Return a boolean.
        exists: function (taskName) { return true; },

        // Rename a task. This might be useful if you want to override the default behavior of a task, while retaining the old name.
        renameTask: function (oldName, newName) { },

        // Load task-related files from the specified directory, relative to the Gruntfile. This method can be used to load task-related files from a local Grunt plugin by specifying the path to that plugin's "tasks" subdirectory.
        loadTasks: function (tasksPath) { },

        // Loads a task from npm.
        loadNpmTasks: function (name) { },

        // Runs grunt tasks.
        run: function (tasks) { },

        // Empty the task queue completely. Unless additional tasks are enqueued, no more tasks will be run.
        clearQueue: function () { },

        // Normalizes a task target configuration object into an array of src-dest file mappings. This method is used internally by the multi task system this.files / grunt.task.current.files property.
        normalizeMultiTaskFiles: function () { }
    };

    var _config = {
        // Gets the entire configration object or a sinble property specified by name.
        get: function (prop) { return {}; },

        // Sets a propety value.
        set: function (prop, value) { },

        // Process a value, recursively expanding &lt;% %&gt; templates in the context of the Grunt config, as they are encountered. this method is called automatically by grunt.config.get but not by grunt.config.getRaw.
        process: function (value) { },

        // Get a raw value from the project's Grunt configuration, without processing &lt;% %&gt; template strings. If prop is specified, that property's value is returned, or null if that property is not defined.
        getRaw: function (value) { },

        // Escape . dots in the given propString. This should be used for property names that contain dots.
        escape: function (propString) { },

        /**
         * Recursively merges properties of the specified configObject into the current project configuration.
         * @param {configObject} config Grunt configuration object.
         */
        merge: function () { },

        // Fail the current task if one or more required config properties is missing, null or undefined. One or more string or array config properties may be specified.
        requiresConfig: function (task) { }
    };

    var _event = {
        // Adds a listener to the end of the listeners array for the specified event.
        on: function (event, listener) { },

        // Adds a one time listener for the event. The listener is invoked only the first time the event is fired, after which it is removed.
        once: function (event, listener) { },

        // Adds a listener that will execute n times for the event before being removed.
        many: function (event, timesToListen, listener) { },

        // Remove a listener from the listener array for the specified event.
        off: function (event, listener) { },

        // Removes all listeners, or those of the specified event.
        removeAllListeners: function (ArrayOfEventNames) { },

        // Execute each of the listeners that may be listening for the specified event name in order with the list of arguments.
        emit: function (event, Array) { }
    };

    var _verbose = {
        // Outputs a warning.
        warn: function (message) { },

        // Outputs a warning.
        write: function (message) { },

        // Outputs a warning.
        writeln: function (message) { },

        // Outputs a warning.
        error: function (message) { },

        // Outputs a warning.
        errorlns: function (message) { },

        // Outputs a warning.
        debug: function (message) { },

        // Logs 'ok' or the message in green to the console.
        ok: function (message) { },

        // Logs 'ok' in green to the console with the message wrapped to 80 columns.
        oklns: function (message) { },

        // Log the specified msg string in bold, with trailing newline.
        subhead: function (message) { },

        /**
         * Log the specified msg string in bold, with trailing newline.
         * @param {Object} obj The object to log.
         * @param {String} prefix
         */
        writeflags: function () { }
    };

    var _utils = {
        // Returns a comma-separated list of arr array items.
        wordlist: function (arr) { },

        // Removes all color information from a string, making it suitable for testing .length or perhaps logging to a file.
        uncolor: function (str) { },

        // Wrap text string to width characters with \n, ensuring that words are not split in the middle unless absolutely necessary.
        wraptext: function (width, text) { },

        // Wrap texts array of strings to columns widths characters wide. A wrapper for the grunt.log.wraptext method that can be used to generate output in columns.
        table: function (widths, texts) { }
    };

    // Helper function that merges two objects
    function merge(obj1, obj2) {
        for (var attrname in obj2) { obj1[attrname] = obj2[attrname]; }
        return obj1;
    }

    function addEnvironments(obj) {
        var temp = {};
        visibleEnvironments.forEach(function (value) { temp[value] = obj; });
        hiddenEnvironments.forEach(function (value) { temp[value] = obj; });
        return temp;
    }

    intellisense.addEventListener('statementcompletion', function (event) {
        if (!module || !module.exports) {
            return;
        }

        event.items = event.items.filter(function (item) {
            return item.name !== "configObject" && !(hiddenEnvironments.indexOf(item.name) > -1 && item.scope === "member");
        });
    });

    // Call the module.exports function after a delay, to pass in the 'grunt' parameter.
    setTimeout(function () {
        global.module.exports(_grunt());
    }, 2000);

    // Set global properties to make them visible in Intellisense inside gruntfile.js.

    global.configObject = _configObject;
    global.module = { exports: {} };

    /**
    * Require a node module.
    * @param {String} module The name/path of the module to require.
    */
    global.require = function (module) {
        return function () { };
    };

})(this);