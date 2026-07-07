# JSON Schema Store

The largest collection of independent JSON schemas in the world.

[![pre-commit.ci status](https://results.pre-commit.ci/badge/github/SchemaStore/schemastore/master.svg)](https://results.pre-commit.ci/latest/github/SchemaStore/schemastore/master)

The repository is a universal JSON schema store, where schemas for popular JSON documents can be found.

## MCP Server

An [MCP (Model Context Protocol) server](https://github.com/SchemaStore/SchemaStoreMcpServer) is available for SchemaStore, allowing AI assistants and editors to search, browse, and retrieve JSON schemas from the catalog.

The server is publicly hosted at **https://mcp.schemastore.org** — no local setup required.

### Visual Studio Code

Create `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "SchemaStore": {
      "url": "https://mcp.schemastore.org/",
      "type": "http"
    }
  }
}
```

### Visual Studio

Add a `.mcp.json` file to your solution root:

```json
{
  "inputs": [],
  "servers": {
    "SchemaStore": {
      "url": "https://mcp.schemastore.org/",
      "type": "http",
      "headers": {}
    }
  }
}
```

### Any MCP Client

Point your client at `https://mcp.schemastore.org/` using HTTP transport.

## Contribute

Contributions are more than welcome! Read [CONTRIBUTING.md](./CONTRIBUTING.md) for more information.

## Help us out

Keeping Schemastore.org running smoothly requires time, effort, and resources. While it’s still volunteer-driven, the infrastructure and maintenance costs have grown alongside its popularity.

And here’s the thing: for-profit organizations are among the biggest beneficiaries of Schemastore.org. They use the schemas to validate configurations, streamline workflows, and, ultimately, save time and money. If you’re part of such an organization - whether you’re contributing schemas or relying on them - I have a request: consider sponsoring Schemastore.org.

Your support would help cover hosting, maintenance, and development costs, ensuring this resource remains free and open for the entire community. It’s a small way to give back to something that likely saves you (and your team) time and effort every day.

You can find [sponsorship details on the site](https://github.com/sponsors/madskristensen), or feel free to reach out to me directly.
