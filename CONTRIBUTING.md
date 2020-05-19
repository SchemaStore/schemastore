## JSON Schema
You can contribute in a variety of ways. For a detailed tutorial, read [Scott Addie](https://twitter.com/Scott_Addie)'s [**Community-Driven JSON Schemas in Visual Studio 2015**](https://scottaddie.com/2016/08/02/community-driven-json-schemas-in-visual-studio-2015/) blog post.

1. Submit new JSON schema files
2. Add a JSON schema file to the [catalog](#catalog)
3. Modify/update existing schema files

Versioning of schema files are handled by modifying the file name to include
the version number: *myschema-1.2.json*

When uploading a new schema file, make sure it targets a file that is commonly
used or has potential for broad uptake.

If you don't have Visual Studio (using macOS or Linux?), you can check your modifications are fine by running:
```Shell
make
```

### <a name="catalog"></a>Adding to catalog

After adding schema files, register them in [schema catalog](src/api/json/catalog.json) by adding an entry corresponding to your schema:

```JSON
{
    "name": "Friendly schema name",
    "description": "Schema description",
    "fileMatch": [
        "list of well-known filenames matching schema"
    ],
    "url": "http://json.schemastore.org/<schemaName>.json"
}
```


### Adding tests

To make sure that files are validated against your schema correctly (we strongly suggest adding at least one before creating a pull request):

1. Create a subfolder in [`src/test`](src/test) named as your schema file
2. Create one or more `.json` files in that folder
3. Run `npm run build`

If the build succeeds, your changes are valid and you can safely create a PR.

### Self-hosting schemas

If you wish to retain full control over your schema definition, simply register it in the [schema catalog](src/api/json/catalog.json) by providing a `url` pointing to the self-hosted schema file to the [entry](#catalog).

## CSS spec
The CSS specification is divided into multple XML documents
> one for each CSS module as specified by the W3C.

Each XML document can contain properies, @-directives and
pseudo elements/classes with descriptions, example usage
and allowed values.

Here are some ways to contribute:

1. Add missing descriptions
2. Add missing properties and values
3. Update the supported browsers attribute
4. Add new CSS modules by creating a new file

The easiest way to contribute is to use Visual Studio 2012
or newer, since it has native support for this XML format.

After cloning this project to your local machine, copy
the [XML schema files](/src/schemas/css) to this folder:

**C:\Users\[username]\AppData\Roaming\Microsoft\VisualStudio\14.0\schemas\css** where **14.0** refers to the version of Visual Studio.

If the last part of the path (_schemas\css_) doesn't exist, 
you should create it manually. 

Visual Studio will now use these schema files instead of
the ones it ships with.