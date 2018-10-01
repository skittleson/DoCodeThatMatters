var metalsmith = require("metalsmith");
var markdown = require("metalsmith-markdown");
var permalinks = require("metalsmith-permalinks");
var collections = require("metalsmith-collections");
var assets = require("metalsmith-assets");
var sitemap = require("metalsmith-mapsite");
var layouts = require("metalsmith-layouts");
var inplace = require("metalsmith-in-place");

const siteMeta = {
  domain: "https://docodethatmatters.com",
  name: "Do Code That Matters",
  description: "Personal blog with code, 3d printing, diy",
  rootpath: __dirname
};

metalsmith(__dirname)
  .metadata({
    company: siteMeta.name,
    description: siteMeta.description,
    keywords: "maker,code,diy",
    url: siteMeta.domain
  })
  .clean(true)
  .source("src")
  .use(
    collections({
      articles: {
        pattern: "posts/**/*.md",
        sortBy: "date",
        reverse: true
      }
    })
  )
  .use(
    markdown({
      gfm: true,
      tables: true
    })
  )
  .use(
    assets({
      source: "src/images/",
      destination: "./images"
    })
  )
  .use(
    permalinks({
      relative: true,
      pattern: ":title"
    })
  )
  .use(layouts({ engine: "handlebars" }))
  .use(inplace())
  .use(
    sitemap({
      // generate sitemap.xml
      hostname: siteMeta.domain + (siteMeta.rootpath || ""),
      omitIndex: true
    })
  )
  .destination("build")
  .build(function(err) {
    if (err) {
      throw err;
    }
  });
