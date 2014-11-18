/* global ga, CodeMirror, tv4, get */
/// <reference path="http://geraintluff.github.io/tv4/tv4.js" />
/// <reference path="http://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.js" />

(function () {
    //$.ajaxSetup({ cache: false });

    function createTextEditor(textarea) {
        return CodeMirror.fromTextArea(textarea, {
            mode: { name: "javascript", json: true },
            lineNumbers: true,
            indentUnit: 4,
        });
    }

    var select = document.querySelector("select");
    var schema = createTextEditor(document.getElementById("schema"));
    var json = createTextEditor(document.getElementById("json"));
    var toggle = document.getElementById("toggle");
    var output = document.querySelector("output");
    var jsonheader = document.getElementById("jsonheader");
    var schemavalid = document.getElementById("schemavalid");
    var jsonvalid = document.getElementById("jsonvalid");
    var rnd = new Date().getDate();

    function onSelectChange() {

        if (select.selectedIndex > 0)
            history.pushState(null, "Schema selected", "#" + select.options[select.selectedIndex].value); //location.hash = select.options[select.selectedIndex].value;
        else
            history.pushState(null, "Custom schema", location.pathname);

        loadSchema();
    }

    function loadSchema() {

        if (select.selectedIndex === 0) {
            schema.setValue("{\n\t\"$schema\": \"http://json-schema.org/draft-04/schema#\"\n\}");
            toggleEditor(true);
            setTimeout(function () { validate(); }, 100);
        }
        else {
            var url = select.options[select.selectedIndex].value;
            location.hash.substr(1).split("|")[0]
            get("/schemas/json/" + url + "?" + rnd, false, function (data) {
                schema.setValue(data);
                setTimeout(function () { validate(); }, 500);
            });
        }
    }

    function toggleSchemaEditor() {
        var visible = schema.getWrapperElement().style.visibility === "hidden";
        toggleEditor(visible);
        return false;
    }

    function toggleEditor(visible) {
        var element = schema.getWrapperElement();
        element.style.height = visible ? "" : "0px";
        toggle.innerHTML = visible ? "Hide schema" : "Show schema";
        toggle.setAttribute("aria-expanded", visible);
        element.setAttribute("aria-hidden", !visible);
        localStorage.toggle = visible;

        if (visible)
            element.style.visibility = "visible";
        else
            setTimeout(function () { element.style.visibility = "hidden"; }, 1000);
    }

    function loadSelect() {
        get("/api/json/catalog.json?" + rnd, true, function (data) {

            for (var i = 0; i < data.schemas.length; i++) {

                var schema = data.schemas[i];

                // Only show schemas hosted on SchemaStore.org
                if (schema.url.indexOf("schemastore.org") < 0)
                    continue;

                var option = document.createElement("option");
                option.text = schema.name;
                option.value = schema.url.replace("http://json.schemastore.org/", "");

                select.lastElementChild.appendChild(option);
            }

            selectCurrent();
            loadSchema();
        });
    }

    function selectCurrent() {
        for (var i = 0; i < select.options.length; i++) {
            var option = select.options[i];
            if (option.value === location.hash.substr(1).split("|")[0]) {
                option.selected = "selected";
            }
        }
    }

    function validate() {

        var jsonValue = json.getValue();
        var schemaValue = schema.getValue();
        var isSchemaValid = IsJsonString(schemaValue);
        var isJsonValid = IsJsonString(jsonValue);

        showSyntaxError(schemavalid, isSchemaValid);
        showSyntaxError(jsonvalid, isJsonValid);

        if (isSchemaValid !== true || isJsonValid !== true)
            return;

        localStorage.json = jsonValue;

        var result = tv4.validateMultiple(JSON.parse(jsonValue), JSON.parse(schemaValue), true);

        if (result.valid) {
            output.innerHTML = "Congrats! All " + json.getDoc().lineCount() + " lines of JSON validates against the schema";
            output.className = "true";
            jsonheader.className = "true";
            jsonheader.innerHTML = "No errors found";
        }
        else {
            var errors = "";
            for (var i = 0; i < result.errors.length; i++) {

                var error = result.errors[i];
                errors += "<dl>";

                if (error.dataPath)
                    errors += "<dd>Data path</dd><dt>#" + error.dataPath + "</dt>";

                errors += "<dd>Message</dd><dt>" + error.message + "</dt>";
                errors += "<dd>Schema path</dd><dt>#" + error.schemaPath + "</dt>";
                errors += "</dl>";
            }

            output.innerHTML = errors;
            output.className = "false";
            jsonheader.innerHTML = "Found " + result.errors.length + " error(s)";
            jsonheader.className = "false";
        }

        jsonvalid.removeAttribute("aria-invalid");
        schemavalid.removeAttribute("aria-invalid");
    }

    function showSyntaxError(element, valid) {
        if (valid === true)
            element.removeAttribute("aria-invalid");
        else {
            var error = valid.toString();
            element.setAttribute("aria-invalid", true);
            element.innerHTML = error.substr(error.lastIndexOf(":") + 1);
            clearValidation();
        }
    }

    function clearValidation() {
        jsonheader.className = "";
        jsonheader.innerHTML = "";
        output.className = "";
        output.innerHTML = "";
    }

    function IsJsonString(str) {
        try {
            JSON.parse(str);
        } catch (e) {
            return e;
        }
        return true;
    }

    window.onload = function () {

        var args = location.hash.substr(1).split("|");

        if (args.length === 2) {
            get("/schemas/json/" + args[0] + "?" + rnd, false, function (data) {
                schema.setValue(data);
            });
            var url = args[1].indexOf("/") > -1 ? args[1] : "schemas/json/" + args[1];
            get(url + "?" + rnd, false, function (data) {
                json.setValue(data);
            });
        }
        else
            json.setValue(localStorage.json || "{\n\t\n}");

        if (location.hash === "")
            toggleEditor(true);
        else if (localStorage.toggle === "false")
            toggleEditor(false);

        select.onchange = onSelectChange;
        schema.on("change", validate);
        json.on("change", validate);
        toggle.onclick = toggleSchemaEditor;
        window.onpopstate = function () {
            selectCurrent();
            loadSchema();
        };
    };

    loadSelect();

})();