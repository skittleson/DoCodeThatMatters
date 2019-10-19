const util = require("./utils.js");
const fs = require("fs");

util.buildSiteFromJson(fs.readFileSync("site.json", "utf8"), "src", "docs");
