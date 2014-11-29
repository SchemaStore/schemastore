#JSON Schema Store

###A collection of JSON schemas 
[![Build status](https://ci.appveyor.com/api/projects/status/ab34h2jsrjfiw2xq?svg=true)](https://ci.appveyor.com/project/madskristensen/schemastore-371)  
[![Deploy to Azure](http://azuredeploy.net/deploybutton.png)](https://azuredeploy.net/)

The repository is meant as a universal JSON schema store, 
where schemas for popular JSON documents can be found.

Website: [schemastore.org](http://schemastore.org)

###Contribute
You can contribute in a various different ways.

1. Submit new JSON schema files
2. Add a JSON schema file to the [schema catalog](src/api/json/catalog.json)
2. Modify/update existing schema files
3. Update the website [schemastore.org](http://schemastore.org)

Versioning of schema files are handled by modifying the file name to include
the version number: *myschema-1.2.json*

When uploading a new schema file, make sure it targets a file that is commonly
used or has potential for broad uptake.
