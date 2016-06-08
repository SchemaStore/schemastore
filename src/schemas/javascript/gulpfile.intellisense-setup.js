(function (global) {
    "use strict";

    // A collection of all supported modules.
    var modules = {};

    // The default return type for unknown modules.
    var defaultModule = function () { return function () { }; };

    /**
    * Require a node module.
    * @param {String} module The name/path of the module to require.
    */
    var require = function (module) {
        var fn = modules[module] || defaultModule;
        return fn.call();
    };

    // The Node.js EventEmitter class.
    var EventEmitter = function () {
        /**
         * Add an event listener.
         * @param {String} event The name of the event, such as "data", "error" etc.
         * @param {Function} listener The function to execute when the event fires.
         */
        this.addListener = function (event, listener) { return this; };

        /**
         * Adds a listener to the end of the listeners array for the specified event.
         * @param {String} event The name of the event, such as "data", "error" etc.
         * @param {Function} listener The function to execute when the event fires.
         */
        this.on = function () { return this; };

        /**
         * Adds a one time listener for the event. This listener is invoked only the next time the event is fired, after which it is removed.
         * @param {String} event The name of the event, such as "data", "error" etc.
         * @param {Function} listener The function to execute when the event fires.
         */
        this.once = function () { return this; };

        /**
         * Remove a listener from the listener array for the specified event. Caution: changes array indices in the listener array behind the listener.
         * @param {String} event The name of the event, such as "data", "error" etc.
         * @param {Function} listener The function to execute when the event fires.
         */
        this.removeListener = function () { return this; };

        /**
         * Removes all listeners, or those of the specified event. It's not a good idea to remove listeners that were added elsewhere in the code, especially when it's on an emitter that you didn't create (e.g. sockets or file streams).
         * @param {String} [event] The name of the event, such as "data", "error" etc.
         */
        this.removeAllListeners = function () { return this; };

        /**
         * Returns an array of listeners for the specified event.
         * @param {String} event The name of the event, such as "data", "error" etc.
         */
        this.listeners = function () { return [this]; };

        /**
         * Returns an array of listeners for the specified event.
         * @param {String} event The name of the event, such as "data", "error" etc.
         */
        this.emit = function () { return true; };

        /**
         * By default EventEmitters will print a warning if more than 10 listeners are added for a particular event. This is a useful default which helps finding memory leaks. Obviously not all Emitters should be limited to 10. This function allows that to be increased.
         * @param {Number} max Set to zero for unlimited.
         */
        this.setMaxListeners = function () { };
    };

    // The Node.js Stream interface.
    var Stream = function () {
        var readable = {

            // This method will cause a stream in flowing-mode to stop emitting data events. Any data that becomes available will remain in the internal buffer.
            pause: function () { },

            /**
             * This method pulls all the data out of a readable stream, and writes it to the supplied destination, automatically managing the flow so that the destination is not overwhelmed by a fast readable stream.
             * @param {Stream} stream The destination for writing data.
             * @param {Object} [options]
             * @returns {Stream}
             */
            pipe: function (stream) {

                if (!stream || !stream._$append) {
                    return this;
                }

                for (var prop in stream) {
                    if (prop.indexOf("_$") !== 0) {
                        this[prop] = stream[prop];
                    }
                }

                return this;
            },

            /**
            * The read() method pulls some data out of the internal buffer and returns it. If there is no data available, then it will return null.
            * @param {Number} [size] Optional argument to specify how much data to read.
            */
            read: function () { },

            // This method will cause the readable stream to resume emitting data events.
            resume: function () { },

            /**
            * Call this function to cause the stream to return strings of the specified encoding instead of Buffer objects.
            * @param {String} encoding The encoding to use.
            */
            setEncoding: function () { },

            /**
            * This method will remove the hooks set up for a previous pipe() call.
            * @param {Stream} [stream] The specific stream to unpipe.
            */
            unpipe: function () { },

            /**
            * This is useful in certain cases where a stream is being consumed by a parser, which needs to "un-consume" some data that it has optimistically pulled out of the source, so that the stream can be passed on to some other party.
            * @param {String or Buffer} chunk The specific stream to unpipe.
            */
            unshift: function () { },

            wrap: function () { }
        };

        var writable = {
            write: function (data, encoding, callback) { },
            end: function (chunk, encoding, callback) { }
        };

        var duplex = merge(readable, writable);

        EventEmitter.call(readable);
        EventEmitter.call(writable);

        return {
            Readable: function () { return readable; },
            Writable: function () { return writable; },
            Duplex: function () { return duplex; },
            Transform: function () { return duplex; }
        };
    };

    modules["events"] = function () {
        return {
            EventEmitter: new EventEmitter()
        };
    };

    modules["gulp"] = function () {
        var dependencies = {
            vfs: modules["vinyl-fs"]()
        };

        var gulp = {
            /**
             * Registers a Gulp task.
             * @param {String} name The name of the task. Tasks that you want to run from the command line should not have spaces in them.
             * @param {Array} [deps] An array of tasks to be executed and completed before your task will run.
             * @param {Function} [fn] The function that performs the task's operations. Generally this takes the form of gulp.src().pipe(someplugin()).
             * @returns {Task}
             */
            task: function () {
                return this;
            },

            /// <field name="tasks" type="Array">Names of task(s) to run when a file changes, added with gulp.task().</field>
            tasks: [],

            /**
             * Checks if a task has been registered with Gulp.
             * @param {String} name The name of the task.
             * @returns {Boolean}
             */
            hasTask: function () { return true; },

            /// <field name="isRunning" type="Boolean" />
            isRunning: true,
            domain: null,
            seq: [],

            /**
             * A function that is being called after all tasks have finished.
             * @param {Object} err Error object
             * @returns {Function}
             */
            doneCallback: function (err) { },

            /**
             * Starts a task.
             * @param {String|Array} task The name of the task or an array of names.
             * @param {Function} [cb] Callback to call after run completed. Passes single argument: err (Boolean).
             */
            start: function () { },

            /**
            * Stop an orchestration run currently in process
            */
            stop: function () { },

            dest: dependencies.vfs.dest,
            src: dependencies.vfs.src,
            watch: dependencies.vfs.watch
        };

        return gulp;
    };

    modules["gulp-coffee"] = function () {

        global.coffeeScriptConfig = function () {
            return {
                bare: true,
                shiftLine: true,
                header: "",
                sandbox: {}
            };
        };

        /**
         * Compiles CoffeeScript files to JavaScript.
         * @param {coffeeScriptConfig} [options] A configuration object for CoffeeScript.
         */
        return function () { };
    };

    modules["gulp-concat"] = function () {

        global.concatConfig = function () {
            return {
                path: "",
                newline: true,
                stat: {
                    mode: 0
                }
            };
        };

        /**
         * This will concat files by your operating systems newLine. It will take the base directory from the first file that passes through it.
         * @param {String} [filename]
         * @param {concatConfig} [options] A configuration object for concat.
         */
        return function () { };
    };

    modules["gulp-jshint"] = function () {

        global.jshintConfig = function () {
            return {
                maxerr: 500,

                bitwise: true,
                camelcase: false,
                curly: false,
                eqeqeq: true,
                forin: true,
                immed: false,
                indent: 4,

                latedef: false,
                newcap: false,
                noarg: true,
                noempty: true,
                nonew: false,
                plusplus: false,
                quotmark: false,

                undef: true,
                unused: true,
                strict: false,
                maxparams: false,
                maxdepth: false,
                maxstatements: false,
                maxcomplexity: false,
                maxlen: false,

                asi: false,
                boss: false,
                debug: true,
                eqnull: false,
                es5: false,
                esnext: false,
                moz: false,

                evil: false,
                expr: true,
                funcscope: false,
                globalstrict: false,
                iterator: false,
                lastsemic: false,
                laxbreak: true,
                laxcomma: true,
                loopfunc: false,
                multistr: false,
                proto: false,
                scripturl: false,
                shadow: false,
                sub: false,
                supernew: false,
                validthis: false,

                browser: true,
                couch: false,
                devel: true,
                dojo: false,
                jquery: true,
                mootools: false,
                node: false,
                nonstandard: false,
                prototypejs: false,
                rhino: false,
                worker: false,
                wsh: false,
                yui: false,

                globals: {}
            };
        };

        /**
         * JavaScript linting task.
         * @param {jshintConfig} [options] A configuration object for JSHint.
         */
        var jshint = function () { };

        jshint.reporter = function () { };

        /**
         * Tells JSHint to extract JavaScript from HTML files before linting (see JSHint CLI flags). Keep in mind that it doesn't override the file's content after extraction.
         * @param {String} flags The flag can be "auto", "always" or "never". The default is "auto".
         */
        jshint.extract = function () { };

        return jshint;
    };

    modules["gulp-less"] = function () {

        global.lessConfig = function () {
            return {
                /// <field name="paths" type="String, Array or Function">Specifies directories to scan for @import directives when parsing. Default value is the directory of the source, which is probably what you want.</field>
                paths: "",

                /// <field name="rootpath" type="Boolean">A path to add on to the start of every URL resource.</field>
                rootpath: "",

                /// <field name="compress" type="Boolean">Compress output by removing some whitespaces.</field>
                compress: false,

                /// <field name="yuicompress" type="Boolean" />
                yuicompress: false,

                /// <field name="plugins" type="Array">Allows passing plugins.</field>
                plugins: [],

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

                /// <field name="sourceMapBasepath" type="String">Sets the base path for the less file paths in the source map.</field>
                sourceMapBasepath: "",

                /// <field name="sourceMapRootpath" type="String">Adds this path onto the less file paths in the source map.</field>
                sourceMapRootpath: "",

                /// <field name="modifyVars" type="Object">Overrides global variables. Equivalent to  --modify-vars='VAR=VALUE'  option in less.</field>
                modifyVars: {},

                /// <field name="banner" type="String">A banner text to inject at the top of the compiled CSS file.</field>
                banner: ""
            };
        };

        /**
         * Compiles LESS files into CSS.
         * @param {lessConfig} [options] A configuration object for LESS.
         */
        return function () { };
    };

    modules["gulp-sourcemaps"] = function () {

        global.sourcemapsInitConfig = function () {
            return {
                /// <field name="loadMaps" type="Boolean">Set to true to load existing maps for source files.</field>
                loadMaps: true,
                /// <field name="debug" type="Boolean">Set this to  true  to output debug messages (e.g. about missing source content).</field>
                debug: false
            };
        };

        global.sourcemapsWriteConfig = function () {
            return {
                /// <field name="addComment" type="Boolean">By default a comment containing / referencing the source map is added. Set this to  false  to disable the comment (e.g. if you want to load the source maps by header).</field>
                addComment: true,
                /// <field name=" includeContent" type="Boolean">By default the source maps include the source code. Pass  false  to use the original files.</field>
                includeContent: false,
                /// <field name="sourceRoot" type="String">Set the path where the source files are hosted.</field>
                sourceRoot: "",
                /// <field name="sourceMappingURLPrefix" type="String">Specify a prefix to be prepended onto the source map URL when writing external source maps. Relative paths will have their leading dots stripped.</field>
                sourceMappingURLPrefix: false,
                /// <field name="debug" type="Boolean">Set this to  true  to output debug messages (e.g. about missing source content).</field>
                debug: false
            };
        };

        return {
            /**
             * Initializes the source mapping.
             * @param {sourcemapsInitConfig} [options] A configuration object for sourcemaps.
             */
            init: function () { },

            /**
             * Writes the sourcemap.
             * @param {sourcemapsWriteConfig} [options] A configuration object for sourcemaps.
             * @param {string} [path] To write external source map files, pass a path relative to the destination to  sourcemaps.write()
             */
            write: function () { }
        };
    };

    modules["gulp-tslint"] = function () {

        global.tslintConfig = function () {
            return {
                configuration: {
                    rules: {
                        "ban": "",
                        "class-name": true,
                        "comment-format": "",
                        "component-class-suffix": true,
                        "component-selector-name": [true, "kebab-case"],
                        "component-selector-prefix": [true, "sg"],
                        "component-selector-type": [true, "element"],
                        "curly": true,
                        "directive-class-suffix": true,
                        "directive-selector-name": [true, "camelCase"],
                        "directive-selector-prefix": [true, "sg"],
                        "directive-selector-type": [true, "attribute"],
                        "eofline": false,
                        "forin": true,
                        "indent": true,
                        "interface-name": true,
                        "jsdoc-format": true,
                        "label-position": true,
                        "label-undefined": true,
                        "max-line-length": true,
                        "no-arg": true,
                        "no-attribute-parameter-decorator": true,
                        "no-bitwise": true,
                        "no-console": true,
                        "no-construct": true,
                        "no-debugger": true,
                        "no-duplicate-key": true,
                        "no-duplicate-variable": true,
                        "no-empty": true,
                        "no-eval": true,
                        "no-forward-ref": true,
                        "no-input-rename": true,
                        "no-output-rename": true,
                        "no-string-literal": true,
                        "no-trailing-comma": true,
                        "no-trailing-whitespace": true,
                        "no-unused-expression": true,
                        "no-unused-variable": true,
                        "no-unreachable": true,
                        "no-use-before-declare": true,
                        "one-line": true,
                        "pipe-naming": [true, "camelCase", "sg"],
                        "quotemark": true,
                        "radix": true,
                        "semicolon": true,
                        "triple-equals": true,
                        "typedef": true,
                        "typedef-whitespace": true,
                        "use-host-property-decorator": true,
                        "use-input-property-decorator": true,
                        "use-life-cycle-interface": true,
                        "use-output-property-decorator": true,
                        "use-pipe-transform-interface": true,
                        "use-strict": true,
                        "variable-name": false,
                        "whitespace": true
                    }
                },
                rulesDirectory: null,
                emitError: true
            };
        };

        /**
         * Runs static code analysis on TypeScript files.
         * @param {tslintConfig} [options] A configuration object for TSLint.
         */
        var fn = function () { };

        /**
         * Specify a TSLint reporter.
         * @param {String or Function} reporter
         * @param {Object} [options] A configuration object for TSLint reporting.
         */
        fn.report = function () { };

        return fn;
    };

    modules["gulp-typescript"] = function () {

        global.typescriptConfig = function () {
            return {
                /// <field name="charset" type="String" />
                charset: "",
                /// <field name="codepage" type="Number" />
                codepage: 0,
                /// <field name="declaration" type="Boolean">Generates corresponding d.ts files.</field>
                declaration: true,
                /// <field name="diagnostics" type="Boolean" />
                diagnostics: true,
                /// <field name="emitBOM" type="Boolean" />
                emitBOM: true,
                /// <field name="listFiles" type="Boolean" />
                listFiles: true,
                /// <field name="locale" type="String" />
                locale: true,
                /// <field name="mapRoot" type="String">Specifies the location where debugger should locate map files instead of generated locations.</field>
                mapRoot: "",
                /// <field name="module" type="String">Specify module code generation: 'commonjs' or 'amd'.</field>
                module: "",
                /// <field name="noEmit" type="Boolean">Do not emit output.</field>
                noEmit: "",
                /// <field name="noEmitOnError" type="Boolean">Do not emit outputs if any type checking errors were reported.</field>
                noEmitOnError: "",
                /// <field name="noImplicitAny" type="Boolean">Warn on expressions and declarations with an implied 'any' type.</field>
                noImplicitAny: true,
                /// <field name="noLib" type="Boolean" />
                noLib: true,
                /// <field name="noLibCheck" type="Boolean" />
                noLibCheck: true,
                /// <field name="noResolve" type="Boolean" />
                noResolve: true,
                /// <field name="out" type="String">Concatenate and emit output to single file.</field>
                out: "",
                /// <field name="outDir" type="String">Redirect output structure to the directory.</field>
                outDir: "",
                /// <field name="preserveConstEnums" type="Boolean">Do not erase const enum declarations in generated code.</field>
                preserveConstEnums: true,
                /// <field name="project" type="String">Compile the project in the given directory.</field>
                project: "",
                /// <field name="removeComments" type="Boolean">Do not emit comments to output.</field>
                removeComments: true,
                /// <field name="sourceMap" type="Boolean">Generates corresponding '.map' file.</field>
                sourceMap: true,
                /// <field name="sourceRoot" type="String">Specifies the location where debugger should locate TypeScript files instead of source locations.</field>
                sourceRoot: "",
                /// <field name="suppressImplicitAnyIndexErrors" type="Boolean">Suppress noImplicitAny errors for indexing objects lacking index signatures.</field>
                suppressImplicitAnyIndexErrors: true,
                /// <field name="target" type="String">Specify ECMAScript target version. Valid values are 'es3', 'es5' and 'es6'.</field>
                target: "",
                /// <field name="version" type="Boolean">Print the compiler's version.</field>
                version: true,
                /// <field name="watch" type="Boolean">Watch input files.</field>
                watch: true
            };
        };

        /**
         * Creates a TypeScript project.
         * @param {typescriptConfig} [options] A configuration object for TypeScript.
         * @param {object} [filterSettings] A filter object for TypeScript.
         * @param {function} [reporter] Specify a reporter for TypeScript.
         */
        var fn = function () {
            return {
                _$append: true,
                dts: new Stream().Readable(),
                js: new Stream().Readable()
            };
        };

        /**
         * Creates a TypeScript project.
         * @param {typescriptConfig} [options] A configuration object for TypeScript.
         */
        fn.createProject = function () { };

        /**
         * Adds a filter to the TypeScript compiler.
         * @param {Object} [options] A filter object for TypeScript.
         */
        fn.filter = function () {

        };

        fn.reporter = {
            voidReporter: function () { },
            defaultReporter: function () { },
            fullReporter: function () { }
        };

        return fn;
    };

    modules["gulp-uglify"] = function () {

        global.uglifyConfig = function () {
            return {
                /// <field name="mangle" type="Boolean" />
                mangle: true,
                /// <field name="output" type="Boolean or Object" />
                output: {},
                /// <field name="compress" type="Boolean or Object" />
                compress: true,
                /// <field name=" preserveComments" type="String" />
                preserveComments: "",
                /// <field name=" outSourceMap" type="Boolean" />
                outSourceMap: ""
            };
        };

        /**
         * Uglifies JavaScript files
         * @param {uglifyConfig} [options] A configuration object for uglify.
         */
        return function () { };
    };

    modules["glob-watcher"] = function () {

        global.watchConfig = function () {
            return {
                /// <field name="interval" type="Integer">Interval to pass to 'fs.watchFile'.</field>
                interval: 0,
                /// <field name="debounceDelay" type="Integer">Delay for events called in succession for the same file/event.</field>
                debounceDelay: 0,
                /// <field name="mode" type="String">Force the watch mode. Either 'auto' (default), 'watch' (force native events), or 'poll' (force stat polling).</field>
                mode: "default",
                /// <field name="cwd" type="String">The current working directory to base file patterns from. Default is 'process.cwd()'.</field>
                cwd: ""
            }
        };

        /**
         * Watch files and do something when a file changes. This always returns an EventEmitter that emits change events.
         * @param {String|Array} glob A single glob or array of globs that indicate which files to watch for changes.
         * @param {watchConfig} [options] Optional configuration object, that are passed to "gaze".
         * @param {Array|Function} tasks Names of task(s) to run when a file changes, added with "gulp.task()" or a callback function.
         * @returns {EventEmitter}
         */
        function fn() { }

        return fn;
    };

    modules["vinyl-fs"] = function () {
        var dependencies = {
            watcher: modules["glob-watcher"]()
        };

        global.srcConfig = function () {
            return {
                /// <field name="buffer" type="Boolean">Setting this to false will return 'file.contents' as a stream and not buffer files. This is useful when working with large files.</field>
                buffer: true,
                /// <field name="read" type="Boolean">Setting this to false will return 'file.contents' as null and not read the file at all.</field>
                read: true,
                /// <field name="base" type="String" />
                base: ""
            }
        };

        global.destConfig = function () {
            return {
                /// <field name="cwd" type="String">'cwd' for the output folder, only has an effect if provided output folder is relative.</field>
                cwd: "",
                /// <field name="mode" type="String">Octal permission string specifying mode for any folders that need to be created for output folder.</field>
                mode: "",
            }
        };

        return {
            /**
            * Emits files matching provided glob or an array of globs. Returns a stream of Vinyl files that can be piped to plugins.
            * @param {String|Array} glob Glob or array of globs to read.
            * @param {srcConfig} [options] Options to pass to node-glob through glob-stream.
            * @returns {Stream}
            */
            src: function () { return new Stream().Readable(); },

            /**
             * @param {String} outFolder The path (output folder) to write files to.
             * @param {destConfig} [options] A configuration object.
             * @returns {Stream}
             */
            dest: function () { return new Stream().Readable(); },

            watch: dependencies.watcher
        };
    };

    modules["stream"] = function () {
        return new Stream();
    };

    modules["fs"] = function () {

        var stats = {
            isFile: function () { return true; },
            isDirectory: function () { return true; },
            isBlockDevice: function () { return true; },
            isCharacterDevice: function () { return true; },
            isSymbolicLink: function () { return true; },
            isFIFO: function () { return true; },
            isSocket: function () { return true; },
        };

        return {
            rename: function (oldName, newName, callback) { },
            renameSync: function (oldName, newName) { },
            ftruncate: function (fd, len, callback) { },
            ftruncateSync: function (fd, len) { },
            truncate: function (path, len, callback) { },
            truncateSync: function (path, len) { },
            fchown: function (fd, uid, gid, callback) { },
            fchownSync: function (fd, uid, gid) { },
            lchown: function (fd, uid, gid, callback) { },
            lchownSync: function (fd, uid, gid) { },
            chown: function (path, uid, gid, callback) { },
            chownSync: function (path, uid, gid, callback) { },
            chmod: function (path, mode, callback) { },
            chmodSync: function (path, mode) { },
            stat: function (path, callback) { return stats },
            statSync: function (path) { },
            lstat: function (path, callback) { return stats },
            lstatSync: function (path) { },
            fstat: function (fd, callback) { return stats },
            fstatSync: function (fd) { },
            link: function (srcpath, dstpath, callback) { },
            linkSync: function (srcpath, dstpath) { },
            symlink: function (srcpath, dstpath, type, callback) { },
            symlinkSync: function (srcpath, dstpath, type) { },
            // The callback gets two arguments (err, linkString).
            readlink: function (path, callback) { },
            // Returns the symbolic link's string value.
            readlinkSync: function (path) { },
            realpath: function (path, cache, callback) { },
            // Returns the resolved path.
            realpathSync: function (path, cache) { },
            // No arguments other than a possible exception are given to the completion callback.
            unlink: function (path, callback) { },
            unlinkSync: function (path) { },
            // No arguments other than a possible exception are given to the completion callback.
            rmdir: function (path, callback) { },
            rmdirSync: function (path) { },
            mkdir: function (path, mode, callback) { },
            mkdirSync: function (path, mode) { },
            readdir: function (path, callback) { },
            // Returns an array of filenames excluding '.' and '..'.
            readdirSync: function (path, callback) { },
            // No arguments other than a possible exception are given to the completion callback.
            close: function (fd, callback) { },
            closeSync: function (fd) { },
            // Asynchronous file open.
            open: function (path, flags, mode, callback) { },
            // Synchronous version of fs.open().
            openSync: function (path, flags, mode) { },
            // Change file timestamps of the file referenced by the supplied path.
            utimes: function (path, atime, mtime, callback) { },
            // Change file timestamps of the file referenced by the supplied path.
            utimesSync: function (path, atime, mtime) { },
            write: function (fd, buffer, offset, length, position, callback) { },
            writeSync: function (fd, buffer, offset, length, position) { },
            read: function (fd, buffer, offset, length, position, callback) { },
            readSync: function (fd, buffer, offset, length, position) { },
            readFile: function (filename, options, callback) { },
            readFileSync: function (filename, options) { },
            writeFile: function (filename, data, options, callback) { },
            writeFileSync: function (filename, data, options) { },
            appendFile: function (filename, data, options, callback) { },
            appendFileSync: function (filename, data, options) { },
            // Watch for changes on filename. The callback listener will be called each time the file is accessed.
            watchFile: function (filename, options, listener) { },
            // Stop watching for changes on filename. If listener is specified, only that particular listener is removed. Otherwise, all listeners are removed and you have effectively stopped watching filename.
            unwatchFile: function (filename, listener) { },
            // Watch for changes on filename, where filename is either a file or a directory.
            watch: function (filename, options, listener) { },
            // Test whether or not the given path exists by checking with the file system. Then call the callback argument with either true or false.
            exists: function (path, callback) { },
            // Synchronous version of fs.exists.
            existsSync: function (path) { },
            // Tests a user's permissions for the file specified by path. mode is an optional integer that specifies the accessibility checks to be performed.
            access: function (path, mode, callback) { },
            accessSync: function (path, mode) { },
            createReadStream: function (path, options) { return new Stream().Readable(); },
            createWriteStream: function (path, options) { return new Stream().Writable(); },
        };
    };

    modules["del"] = function () {

        global.delConfig = function () {
            return {
                /// <field name="force" type="Boolean">Allow deleting the current working directory and files/folders outside it.</field>
                force: false
            }
        };

        /**
         * Delete files/folders using globs.
         * @param {String|Array} patterns Globbing pattern(s).
         * @param {delConfig} [options]
         * @param {Function} callback
         */
        var del = function () { };

        /**
         * Delete files/folders using globs.
         * @param {String|Array} patterns Globbing pattern(s).
         * @param {delConfig} [options]
         */
        del.sync = function () { };

        return del;
    };

    modules["rimraf"] = function () {

        global.rimrafConfig = function () {
            return {
                /// <field name="maxBusyTries" type="Integer">The number of times to retry a file or folder in the event of an EBUSY error. The default is 3.</field>
                maxBusyTries: false,
                /// <field name="gently" type="String">If provided a gently path, then rimraf will only delete files and folders that are beneath this path, and only delete symbolic links that point to a place within this path.</field>
                gently: false
            }
        };

        /**
         * A deep deletion module for node
         * @param {String} pattern File globbing pattern.
         * @param {rimrafConfig} [options]
         * @param {Function} callback
         */
        var rimraf = function () { };

        /**
         * A deep deletion module for node
         * @param {String} pattern File globbing pattern.
         * @param {rimrafConfig} [options]
         */
        rimraf.sync = function () { };

        return rimraf;
    };

    modules["gulp-watch"] = function () {

        global.gulpWatchConfig = function () {
            return {
                /// <field name="ignoreInitial" type="Boolean">Indicates whether chokidar should ignore the initial add events or not.</field>
                ignoreInitial: false,
                /// <field name="gently" type="Array">List of events, that should be watched by gulp-watch. Contains event names from chokidar.</field>
                events: [],
                /// <field name="base" type="String">Use explicit base path for files from glob. Read more about base and cwd in gulpjs docs.</field>
                base: "",
                /// <field name="name" type="String">Name of the watcher. If it present in options, you will get more readable output.</field>
                name: "",
                /// <field name="verbose" type="Boolean">This options will enable verbose output.</field>
                verbose: "",
                /// <field name="readDelay" type="Number">Wait for readDealy milliseconds before read file.</field>
                readDelay: "",
            }
        };

        /**
         * File watcher, that uses super-fast chokidar and emits vinyl objects.
         * @param {String|Array} pattern File globbing pattern.
         * @param {gulpWatchConfig} [options]
         * @param {Function} [callback]
         * @returns {Stream}
         */
        var gulpwatch = function () {
            var writeable = new Stream().Writable();

            var obj = {

                /**
                 * Adds files to be .
                 * @param {String|Array} pattern File globbing pattern.
                 */
                add: function () { },
                /**
                 * Removes files from being watched.
                 * @param {String|Array} pattern File globbing pattern.
                 */
                unwatch: function () { },

                // Closes the watcher.
                close: function () { }
            }

            return merge(writeable, obj);
        };

        return gulpwatch;
    };

    modules["gulp-rename"] = function () {

        global.renameConfig = function () {
            return {
                /// <field name="dirname" type="String">The relative path from the base directory set by gulp.src to the filename.</field>
                dirname: "",
                /// <field name="basename" type="String">The filename without the extension like path.basename(filename, path.extname(filename)).</field>
                basename: "",
                /// <field name="prefix" type="String" />
                prefix: "",
                /// <field name="suffix" type="String" />
                suffix: "",
                /// <field name="extname" type="String">The file extension including the '.' like path.extname(filename).</field>
                extname: ""
            }
        };

        var rename = function () {
            /// <signature>
            ///   <param name="config" type="renameConfig">A configuration object.</param>
            ///   <returns type="Stream" />
            /// </signature>
            /// <signature>
            ///   <param name="fileName" type="String">The resulting file name.</param>
            ///   <returns type="Stream" />
            /// </signature>
            /// <signature>
            ///   <param name="fn(path)" type="Funtion">A custom function.</param>
            ///   <returns type="Stream" />
            /// </signature>
        };

        return rename;
    };

    modules["gulp-imagemin"] = function () {

        global.imageminConfig = function () {
            return {
                /// <field name="optimizationLevel" type="Number">Select an optimization level between 0 and 7.</field>
                optimizationLevel: 3,
                /// <field name="progressive" type="Boolean">Lossless conversion to progressive.</field>
                progressive: true,
                /// <field name="interlaced" type="Boolean">Interlace gif for progressive rendering.</field>
                interlaced: "",
                /// <field name="multipass" type="Boolean">Optimize svg multiple times until it's fully optimized.</field>
                multipass: "",
                /// <field name="svgoPlugins" type="Array">Customize which SVGO plugins to use.</field>
                svgoPlugins: "",
                /// <field name="use" type="Array">Additional plugins to use with imagemin.</field>
                use: ""
            }
        };

        /**
         * Minify PNG, JPEG, GIF and SVG images
         * @param {imageminConfig} options
         * @returns {Stream}
         */
        return function () { return new Stream().Writable(); };
    };

    modules["gulp-plumber"] = function () {

        global.plumberConfig = function () {
            return {
                /// <field name="inherit" type="Boolean|Function">Monkeypatch pipe functions in underlying streams in pipeline.</field>
                inherit: false,
                /// <field name="errorHandler" type="Boolean|Function">Handle errors in underlying streams and output them to console.</field>
                errorHandler: false
            }
        };

        /**
         * Prevent pipe breaking caused by errors from gulp plugins.
         * @param {plumberConfig} [options]
         * @returns {Stream}
         */
        var plumber = function () { return new Stream().Writable(); };

        // This method will return default behaviour for pipeline after it was piped.
        plumber.stop = function () { };

        return plumber;
    };

    // Helper function that merges two objects
    function merge(obj1, obj2) {
        for (var attrname in obj2) { obj1[attrname] = obj2[attrname]; }
        return obj1;
    }

    intellisense.addEventListener('statementcompletion', function (event) {
        event.items = event.items.filter(function (item) {
            return item.name.indexOf("Config") === -1 || (item.name.length - item.name.indexOf("Config")) !== "Config".length;
        });
    });

    // Set global properties to make them visible in Intellisense inside gulpfile.js.
    global.require = require;
    global.EventEmitter = EventEmitter;

})(this);
