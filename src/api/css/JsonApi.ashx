<%@ WebHandler Language="C#" Class="JsonApi" %>

using System;
using System.Web;
using System.Xml;
using System.Collections.Generic;

public class JsonApi : IHttpHandler
{

    public void ProcessRequest(HttpContext context)
    {
        context.Response.ContentType = "application/json";
        string path = System.IO.Path.Combine(context.Request.PhysicalApplicationPath, "api\\css\\css-main.xml");

        XmlDocument doc = new XmlDocument();
        doc.Load(path);

        var list = new List<object>();

        foreach (XmlNode node in doc.SelectNodes("//CssModuleRef"))
        {
            string file = node.Attributes["file"].InnerText;

            list.Add(new
            {
                name = file.Replace("css-module-", "").Replace(".xml", ""),
                description = "",
                url = "http://css.schemastore.org/" + file
            });
        }

        var api = new {
            version = "1.0",
            schemas = list
        };

        var serializer = new System.Web.Script.Serialization.JavaScriptSerializer();
        string output = serializer.Serialize(api);

        context.Response.Write(output);
    }

    public bool IsReusable
    {
        get { return false; }
    }
}
