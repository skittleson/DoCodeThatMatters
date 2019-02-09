var metalsmith = require("metalsmith");
var markdown = require("metalsmith-markdown");
var permalinks = require("metalsmith-permalinks");
var collections = require("metalsmith-collections");
var assets = require("metalsmith-assets");
var sitemap = require("metalsmith-mapsite");
var layouts = require("metalsmith-layouts");
var inplace = require("metalsmith-in-place");
var metallic = require("metalsmith-metallic");
var handlebars = require("handlebars");
var fs = require("fs");

handlebars.registerHelper("json", function(context) {
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

handlebars.registerHelper("formatDate", function(date) {
  var day = date.getDate();
  var monthIndex = date.getMonth();
  var year = date.getFullYear();

  return day + " " + monthNames[monthIndex] + " " + year;
});

handlebars.registerHelper("importFile", function(file) {
  let contents;
  try {
    contents = fs.readFileSync(__dirname + file, "utf8");
  } catch (error) {
    contents = error.message;
  }
  return contents;
});

const siteMeta = {
  domain: "https://docodethatmatters.com",
  name: "Do Code That Matters",
  description:
    "Personal blog about software development, 3d printing, diy, and c#",
  keywords: "maker,code,diy,c#,csharp,3d printing",
  rootpath: __dirname
};

metalsmith(__dirname)
  .metadata({
    company: siteMeta.name,
    description: siteMeta.description,
    url: siteMeta.domain,
    keywords: siteMeta.keywords
  })
  .clean(true)
  .source("src")
  .use(
    collections({
      articles: {
        pattern: "posts/**/*.md",
        sortBy: "date",
        reverse: true
      },
      articlesRecent: {
        pattern: "posts/**/*.md",
        sortBy: "date",
        reverse: true,
        limit: 5
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
  .use(metallic())
  .destination("build")
  .build(function(err) {
    fs.createReadStream("node_modules/spectre.css/dist/spectre.min.css").pipe(
      fs.createWriteStream("build/css/spectre.min.css")
    );

    if (err) {
      throw err;
    }
  });
