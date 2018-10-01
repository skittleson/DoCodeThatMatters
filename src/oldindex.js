//https://highlightjs.org/

var Metalsmith = require("metalsmith");
var markdown = require("metalsmith-markdown");
var layouts = require("metalsmith-layouts");
var permalinks = require("metalsmith-permalinks");
var uglify = require("metalsmith-uglify");
var htmlMinifier = require("metalsmith-html-minifier");
var collections = require("metalsmith-collections");
var publish = require("metalsmith-publish");
var wordcount = require("metalsmith-word-count");
var sitemap = require("metalsmith-mapsite");
var rssfeed = require("metalsmith-feed");
var inPlace = require("metalsmith-in-place");

const dir = __dirname;
const siteMeta = {
  domain: "https://docodethatmatters.com",
  name: "Do Code That Matters",
  description: "Personal blog with code, 3d printing, diy",
  rootpath: dir
};

Metalsmith(dir)
  .metadata({
    company: siteMeta.name,
    description: siteMeta.description,
    keywords: "maker,code,diy",
    url: siteMeta.domain
  })
  .source("src")
  .clean(true)
  //.use(publish())
  .use(wordcount({ raw: true }))
  .use(layouts({ engine: "handlebars" }))
  .use(markdown())
  .use(
    collections({
      posts: {
        pattern: "posts/*.md",
        sortBy: "date",
        reverse: true
      }
    })
  )
  .use(
    permalinks({
      relative: true,
      pattern: ":title"
    })
  )

  .use(
    inPlace({
      pattern: "**/*.njk",
      engineOptions: {
        path: __dirname + "/src"
      }
    })
  )

  //.use(uglify())
  //.use(htmlMinifier())
  .use(
    sitemap({
      // generate sitemap.xml
      hostname: siteMeta.domain + (siteMeta.rootpath || ""),
      omitIndex: true
    })
  )
  /*.use(
    rssfeed({
      // generate RSS feed for articles
      collection: "posts",
      site_url: siteMeta.domain + (siteMeta.rootpath || ""),
      title: siteMeta.name,
      description: siteMeta.desc
    })
  )  */
  .destination("./build")
  .build(function(err, files) {
    if (err) {
      console.log(err.message);
      throw err;
    }
  });
