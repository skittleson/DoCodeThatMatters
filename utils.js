const handlebars = require("handlebars");
const path = require("path");
const fs = require("fs-extra");
const uglify = require("uglify-js");
const markdown = require("markdown-it")({
  html: true,
  breaks: true,
});
const concat = require("concat-files");

// TODO process images https://web.dev/use-imagemin-to-compress-images/

function saveHandlebarsToHtml(inFile, outFile, data) {
  let source = fs.readFileSync(inFile, "utf8");

  // markdown files can't have handlebar syntax
  const isMarkdown = data.file.includes(".md");
  data.contents = isMarkdown
    ? markdown.render(source)
    : handlebars.compile(source, { strict: true })(data);

  let templateHbs = "src/partials/standard.hbs";
  if (isMarkdown) {
    templateHbs = "src/partials/post.hbs";
  }
  if (data.file.includes("admin.hbs")) {
    templateHbs = "src/partials/private.hbs";
  }
  const template = fs.readFileSync(templateHbs, "utf8");
  ensureDirectoryExistence(outFile);
  fs.writeFileSync(
    outFile,
    handlebars.compile(template, { strict: true })(data),
    {}
  );
}

module.exports.buildSiteFromJson = function buildSiteFromJson(json, src, dest) {
  var store = JSON.parse(json);
  if (!store.site) {
    throw new Error("Site property must be in file.");
  }
  if (!store.pages && Array.isArray(store.pages)) {
    throw new Error("Site pages must be an array");
  }
  store.site.staticRandom = Math.floor(Math.random() * Math.floor(1000000000));
  let partials = [];
  store.partials.forEach((partial) => {
    const partialName = partial.split(".")[0];
    partials.push({ name: partialName, path: `${src}/partials/${partial}` });
  });
  registerPartials(partials);

  const posts = store.pages.filter((pageToFilter) =>
    pageToFilter.file.includes(".md")
  );

  // build a site map
  store.pages.forEach((page) => {
    const pageKeyValue = Object.assign(store.site, page);

    //only posts
    pageKeyValue.posts = posts;
    const folder = page.file.replace(".hbs", "").replace(".md", "");
    let saveToPath = `${dest}/${folder}/index.html`;
    if (page.file === "index.hbs") {
      saveToPath = `${dest}/index.html`;
    }
    saveHandlebarsToHtml(`${src}/${page.file}`, saveToPath, pageKeyValue);
  });

  // Create RSS feed
  let rss = fs.readFileSync(`${src}/rss.hbs`, "utf8");
  fs.writeFileSync(
    `${dest}/rss.xml`,
    handlebars.compile(rss, { strict: true })({
      site: store.site,
      posts: posts,
    }),
    {}
  );

  // Create site map
  let siteMap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">`;
  store.pages
    .filter((page) => page.file !== "admin.hbs")
    .filter((page) => page.file !== "offline.hbs")
    .forEach((page) => {
      let folder = page.file.replace(".hbs", "").replace(".md", "");
      let priority = 0.8;
      if (page.file === "index.hbs") {
        priority = 1.0;
        folder = "";
      }
      siteMap += `<url><loc>${store.site.url}/${folder}</loc><priority>${priority}</priority></url>`;
    });
  siteMap += "</urlset>";
  fs.writeFileSync(`${dest}/sitemap.xml`, siteMap);

  // Create site map
  let securityTxt = fs.readFileSync(`${src}/.well-known/security.hbs`, "utf8");
  fs.writeFileSync(
    `${dest}/.well-known/security.txt`,
    handlebars.compile(securityTxt, { strict: true })({
      site: store.site,
      date: 'random-date',
    }),
    {}
  );

  // Collect on js files, compress, and push to destination
  let jsc = [];
  store.js.forEach((file) => {
    jsc.push(`${file}.c.js`);
    compressJs(file, `${file}.c.js`);
  });
  concat(jsc, `${dest}/js/site.js`, function (err) {
    if (err) throw err;
    jsc.forEach((file) => {
      fs.unlink(file);
    });
  });
  concat(store.css, `${dest}/css/site.css`);

  // copy asset files over
  store.assets.forEach((asset) => {
    fs.copy(`${src}/${asset}`, `${dest}/${asset}`, (err) => {
      if (err) throw err;
    });
  });
};

function ensureDirectoryExistence(filePath) {
  var dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

function registerPartials(partials) {
  partials.forEach((partial) => {
    handlebars.registerPartial(
      partial.name,
      fs.readFileSync(partial.path, "utf8")
    );
  });
}

function compressJs(inFile, outFile) {
  var result = uglify.minify(fs.readFileSync(inFile, "utf8"), {});
  fs.writeFileSync(outFile, result.code, {});
  if (result.error) {
    console.log(result.error);
  }
  //console.log(result.code); // minified output//
  //console.log(result.map);  // source map
}

handlebars.registerHelper("json", function (context) {
  const cache = new Set();
  return JSON.stringify(context, function (key, value) {
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
  "December",
];

handlebars.registerHelper("formatDate", function (dateStr) {
  let date = new Date(dateStr);
  const day = date.getDate();
  const monthIndex = date.getMonth();
  const year = date.getFullYear();
  return `${day} ${monthNames[monthIndex]} ${year}`;
});

handlebars.registerHelper("schemaDate", function (dateStr) {
  return new handlebars.SafeString(JSON.stringify(new Date(dateStr)));
});

handlebars.registerHelper("blogPath", function (file) {
  return file.split(".md")[0];
});

handlebars.registerHelper("imagePath", function (imagePath, siteUrl) {
  if (imagePath.indexOf("http") != -1) {
    return imagePath;
  }
  return siteUrl + "/" + imagePath;
});

