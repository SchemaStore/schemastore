/* global ga, get */

(function (global) {

    global.get = function (url, asJson, callback) {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.onload = function () {
            if (asJson)
                callback(JSON.parse(xhr.responseText), url);
            else
                callback(xhr.responseText, url);
        };

        xhr.send();
    };

    let ul = document.querySelector("#schemalist ul");
    let p = document.getElementById("count");
    let schemas = document.getElementById("schemas");

    if (!ul || !p)
        return;

    if (schemas !== null) {
        let api = schemas.getAttribute("data-api");

        get(api, true, function (catalog) {

            p.innerHTML = p.innerHTML.replace("{0}", catalog.schemas.length);
            let schemas = catalog.schemas.sort(function (a, b) { return a.name.localeCompare(b.name); });

            for (const element of schemas) {

                let schema = element;
                let li = document.createElement("li");
                let a = document.createElement("a");
                a.href = schema.url;
                a.title = schema.description;
                a.innerText = schema.name;

                li.appendChild(a);
                ul.appendChild(li);
            }

            ul.parentNode.style.maxHeight = "9999px";
        });
    }

}(typeof window !== 'undefined' ? window : this));