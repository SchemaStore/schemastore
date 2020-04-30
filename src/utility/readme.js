const fs = require("fs");
const { homepage } = require("../package.json");
const { README_PATH, TLS_URL } = require("./fixtures.json");

const template = fs.readFileSync("./README_template.md", { encoding: "utf8" });

/**
 * @param {string} link 
 * @param {string} [text] 
 * @returns {string}
 */
function anchor(link, text = link) {
    return `<a href="${link}" referrerpolicy="no-referrer">${text}</a>`;
}

/**
 * @param  {...string} cells
 * @returns {string}
 */
const mdRow = (...cells) => {
    return `| ${cells.join(" | ")} |`;
};

/**
 * @param {string} content 
 * @param {function} callback
 * @param {string[]} acc
 * @returns {string[]}
 */
function readLines(content, callback, acc = []) {
    const lines = content.split(/\r|\n/);
    for (const line of lines) {
        callback(line, acc);
    }
    return acc;
}

const placeholderMap = new Map()
    .set("domain", () => {
        return homepage.replace(/http(?:s)*:\/\/(?:www\.)*/, "");
    })
    .set("homepage", () => homepage)
    .set("https", () => TLS_URL)
    .set("schemas", () => {

        const jsonHTTP = anchor(`${homepage}/json/`, "JSON");
        const cssHTTP = anchor(`${homepage}/css/`, "CSS");
        const jsHTTP = anchor(`${homepage}/javascript/`, "JS");

        const jsonTLS = anchor(`${TLS_URL}/schemas/json/`, "JSON");
        const cssTLS = anchor(`${TLS_URL}/schemas/css/`, "CSS");
        const jsTLS = anchor(`${TLS_URL}/schemas/javascript/`, "JS");

        return [
            mdRow("HTTP", "HTTP/TLS"),
            mdRow("---", "---"),
            mdRow(
                [cssHTTP, jsonHTTP, jsHTTP].join(" \\| "),
                [cssTLS, jsonTLS, jsTLS].join(" \\| ")
            )
        ].join("\n");
    });

/**
 * @param {string} line 
 * @param {string[]} acc
 * @returns {void}
 */
function parsePlaceholders(line, acc) {

    const updated = line.replace(/\$\{(\w+)\}/g, (full, name) => {
        const handler = placeholderMap.get(name);
        return handler ? handler() : "";
    });

    acc.push(updated);
}

function run() {
    const parsed = readLines(template, parsePlaceholders);
    const output = fs.createWriteStream(README_PATH);
    output.write(parsed.join("\n"));
}

run();