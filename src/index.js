var metalsmith = require("metalsmith");
var markdown = require("metalsmith-markdown");
var permalinks = require("metalsmith-permalinks");
var collections = require("metalsmith-collections");
var assets = require("metalsmith-assets");
var sitemap = require("metalsmith-mapsite");
var layouts = require("metalsmith-layouts");
var inplace = require("metalsmith-in-place");
var autotoc = require("metalsmith-autotoc");
var wordcount = require("metalsmith-word-count");
var metallic = require("metalsmith-metallic");
var highlighter = require("highlighter");
var Handlebars = require("handlebars");

Handlebars.registerHelper("json", function(context) {
  const cache = new Set();
  return JSON.stringify(context, function(key, value) {
    if (typeof value === "object" && value !== null) {
      if (cache.has(value)) {
        // Circular reference found, discard key
        return;
      }
      // Store value in our set
      cache.add(value);
    }
    return value;
  });
});

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

Handlebars.registerHelper("formatDate", function(date) {
  var day = date.getDate();
  var monthIndex = date.getMonth();
  var year = date.getFullYear();

  return day + " " + monthNames[monthIndex] + " " + year;
});

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
  .use(wordcount())
  .use(
    markdown({
      gfm: true,
      tables: true,
      highlight: highlighter()
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

  .use(metallic())
  .destination("build")
  .build(function(err) {
    if (err) {
      throw err;
    }
  });
