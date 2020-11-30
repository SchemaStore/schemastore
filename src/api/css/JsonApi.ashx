<%@ WebHandler Language="C#" Class="JsonApi" %>

using System;
using System.Web;
using System.Xml;
using System.Collections.Generic;

public class JsonApi : IHttpHandler
{

    public void ProcessRequest(HttpContext context)
    {
        string path = System.IO.Path.Combine(context.Request.PhysicalApplicationPath, "api\\css\\css-main.xml");

        SetHeaders(context, path);

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
                url = "https://css.schemastore.org/" + file
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

    private void SetHeaders(HttpContext context, string path)
    {
        context.Response.ContentType = "application/json";
        context.Response.AddFileDependency(path);
        context.Response.Cache.SetCacheability(HttpCacheability.ServerAndPrivate);
        context.Response.Cache.SetLastModifiedFromFileDependencies();
        context.Response.Cache.SetValidUntilExpires(true);
    }

    public bool IsReusable
    {
        get { return false; }
    }
}
