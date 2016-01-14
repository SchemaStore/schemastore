# JSON Schema Store

 A collection of JSON schemas

[![Build status](https://ci.appveyor.com/api/projects/status/ab34h2jsrjfiw2xq?svg=true)](https://ci.appveyor.com/project/madskristensen/schemastore-371)

The repository is meant as a universal JSON schema store,
where schemas for popular JSON documents can be found.

Website: [schemastore.org](http://schemastore.org)

## Contribute
Contributions are more than welcome. Both to the website
itself or to the various schema files.

### JSON Schema
You can contribute in a various different ways.

1. Submit new JSON schema files
2. Add a JSON schema file to the [schema catalog](src/api/json/catalog.json)
3. Modify/update existing schema files

Versioning of schema files are handled by modifying the file name to include
the version number: *myschema-1.2.json*

When uploading a new schema file, make sure it targets a file that is commonly
used or has potential for broad uptake.

### CSS spec
The CSS specification is divided into multple XML documents
- one for each CSS module as specified by the W3C.

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
the 
[XML schema files](/src/schemas/css) to this folder:

**C:\Users\[username]\AppData\Roaming\Microsoft\VisualStudio\14.0\schemas\css**

If the folder doesn't exist, you should create it. Visual
Studio will now use these schema files instead of the ones
it ships with.
