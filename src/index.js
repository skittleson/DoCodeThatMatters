var Metalsmith = require("metalsmith");
var markdown = require("metalsmith-markdown");
var layouts = require("metalsmith-layouts");
var permalinks = require("metalsmith-permalinks");
var drafts = require("metalsmith-drafts");
var concat = require("metalsmith-concat");
var uglify = require("metalsmith-uglify");
var htmlMinifier = require("metalsmith-html-minifier");
var cleanCSS = require("metalsmith-clean-css");
var collections = require('metalsmith-collections');

Metalsmith(__dirname)
  .metadata({
    company: "Do Code That Matters",
    description: "",
    keywords: "",
    url: "https://docodethatmatters.com"
  })
  .use(drafts())  
  .use(collections({          // group all blog posts by internally
    posts: 'posts/*.md'       // adding key 'collections':'posts'
  }))                         // use `collections.posts` in layouts
  .use(markdown())            // transpile all md into html
  .use(permalinks({           // change URLs to permalink URLs
    relative: true           // put css only in /css
    , pattern: ":title"       //great for blogs
  }))
  .use(
    layouts({
      engine: "handlebars"
    })
  )
  .use(collections({
    posts: {
      articles: 'posts/*.md',
      sortBy: 'date',
      reverse: true
      },
    }))
  .source("./src")
  .destination("./build")
  .use(uglify())
  .use(htmlMinifier())
  .use(
    cleanCSS({
      files: "css/**/*.css",
      cleanCSS: {
        rebase: true
      }
    })
  )
    .build(function(err, files) {
    if (err) { throw err; }
  });
