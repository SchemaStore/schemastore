/* global ga, tv4, get */
/// <reference path="http://geraintluff.github.io/tv4/tv4.js" />
/// <reference path="http://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.js" />

(function () {

    var list = document.getElementById("result");
    var recap = document.getElementById("recap");
    var progress = document.querySelector("progress");
    var draftV4, errorCount = 0, rnd = Math.random();

    function validateFile(element, schema, file) {
        get("/" + file + "?" + rnd, true, function (data) {
            validateSchema(element, data, schema);
        });
    }

    function validateSchema(element, data, schema) {

        var result = tv4.validateResult(data, schema, true);
        element.setAttribute("aria-invalid", !result.valid);
        reportProgress();

        if (!result.valid) {
            var href = element.firstChild.attributes["href"].value;
            var msg = document.createElement("a");
            msg.innerHTML = "Show in validator";

            if (href == "schemas/json/schema-draft-v4.json")
                msg.href = "/validator.html#schema-draft-v4|" + element.parentNode.parentNode.id;
            else
                msg.href = "/validator.html#" + element.parentNode.parentNode.id + "|" + href;

            element.appendChild(msg);

            errorCount += 1;
            progress.setAttribute("aria-invalid", true);
            recap.innerHTML = errorCount + " of the " + progress.max + " tests failed";
            recap.setAttribute("aria-invalid", true);
        }

        return result.valid;
    }

    function reportProgress() {
        progress.value = 1 + progress.value;

        if (progress.value === progress.max && progress.attributes["aria-invalid"] === undefined) {
            setTimeout(function () {
                recap.innerHTML = "All " + progress.max + " tests ran successfully";
                recap.setAttribute("aria-invalid", false);
            }, 1000);
        }
    }

    function cleanName(url) {

        var index = url.lastIndexOf("/");
        url = url.substring(index + 1);

        index = url.indexOf("?");

        if (index > -1)
            url = url.substring(0, index);

        return url.replace(".json", "").replace(/-/g, " ");
    }

    function createElement(ul, name, file) {
        var isDraft = file == "http://json-schema.org/draft-04/schema";
        var a = document.createElement("a");
        a.innerHTML = isDraft ? "[schema draft v4]" : cleanName(file);
        a.href = isDraft ? "schemas/json/schema-draft-v4.json" : file;
        a.title = "The '" + a.innerHTML + "' JSON file";
        a.setAttribute("data-id", file);
        a.setAttribute("aria-describedby", name);

        var li = document.createElement("li");
        li.appendChild(a);
        ul.appendChild(li);
        return li;
    }

    function createBlock(test) {

        var ul = document.createElement("ul");
        ul.setAttribute("role", "group");

        var cat = document.createElement("li");
        cat.innerHTML = cleanName(test.name)
        cat.id = test.name;
        cat.appendChild(ul);

        var schema = createElement(ul, test.name, "http://json-schema.org/draft-04/schema");

        for (var i = 0; i < test.files.length; i++) {
            var file = test.files[i];
            var li = createElement(ul, test.name, file);
        }

        get("schemas/json/" + test.name + ".json?" + rnd, true, function (data, url) {

            if (!validateSchema(schema, data, draftV4))
                return;

            var links = ul.getElementsByTagName("li");

            for (var i = 1; i < links.length; i++) {
                validateFile(links[i], data, links[i].firstChild.attributes["data-id"].value);
            }
        });

        list.appendChild(cat);
    }

    function setupTests(data) {

        var count = (Object.keys(data).length);
        progress.max = count;

        for (var test in data) {
            var files = data[test].files;
            data[test].name = test;
            progress.max += files.length;
            createBlock(data[test]);
        }

        recap.innerHTML = "Executing tests...";
    }

    get("schemas/json/schema-draft-v4.json?" + rnd, true, function (data) {
        draftV4 = data;
        tv4.addSchema("http://json-schema.org/draft-04/schema", data);
    }, true);

    get("test/tests.json?_=" + Math.random(), true, function (data) {
        setTimeout(function () { setupTests(data) }, 100);
    });
})();
