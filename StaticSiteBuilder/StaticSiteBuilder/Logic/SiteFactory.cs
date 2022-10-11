using AutoMapper;
using HandlebarsDotNet;
using JsonFeedNet;
using Markdig;
using Markdig.Extensions.Yaml;
using Markdig.Syntax;
using StaticSiteBuilder.Models;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Web;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace StaticSiteBuilder.Logic {

    public class SiteFactory {

        public SiteFactory() {
            var rootPath = RunCommandWithResponse("git", "rev-parse --show-toplevel");
            RootPath = string.IsNullOrEmpty(rootPath) ? throw new ArgumentNullException("Must be in a directory with git") : Path.GetFullPath(rootPath.Trim());
            SrcPath = Path.Combine(RootPath, "src");
            DestPath = Path.Combine(RootPath, "docs");
            SiteGlobalMeta = ParseYaml<SiteGlobalMeta>(File.ReadAllText(Path.Combine(RootPath, "index.yml")));
            SiteGlobalMeta.Path = new Uri(SiteGlobalMeta.Url);
            SiteGlobalMeta.Title = SiteGlobalMeta.Company;
            _pipeline = new MarkdownPipelineBuilder()
                        .UseEmphasisExtras()
                        .UseGridTables()
                        .UseMediaLinks()
                        .UsePipeTables()
                        .UseTaskLists()
                        .UseYamlFrontMatter()
                        .UseAdvancedExtensions()
                        .Build();
        }

        //--- Properties ---
        public string RootPath {
            get;
        }

        public string SrcPath {
            get;
        }

        public string DestPath {
            get;
        }

        public SiteGlobalMeta SiteGlobalMeta {
            get;
        }

        private MarkdownPipeline _pipeline;

        //--- Methods ---
        public void Build() {
            // Clear build directory
            DeleteSubDirectoriesAndFilesInRoot(DestPath);
            Concat(SiteGlobalMeta.Css, "site.css");
            Concat(SiteGlobalMeta.Js, "site.js");
            RegisterHandlebars();
            var posts = GetBlogPosts();
            RenderHandlebarPages(posts);

            // Get the latest posts then update all the posts
            var topPosts = posts.OrderByDescending(x => x.Date).Take(5).ToList();
            foreach (var post in posts) {
                post.Posts = topPosts.Where(x => x.Path != post.Path).ToList();
            }
            RenderBlogPosts(posts);
            GenerateJsonRssFeed(SrcPath, SiteGlobalMeta, posts);
            CopyFiles(SrcPath, DestPath);
            CopyAll(Path.Combine(SrcPath, "images"), Path.Combine(DestPath, "images"));
            CopyAll(Path.Combine(SrcPath, ".well-known"), Path.Combine(DestPath, ".well-known"));
        }

        private void GenerateJsonRssFeed(string srcPath, SiteGlobalMeta site, List<BlogPostMeta> posts) {
            var author = new JsonFeedAuthor {
                Name = site.Author,
                Url = site.Twitter,
            };
            var jsonFeed = new JsonFeed {
                Title = site.Company,
                Description = site.Description,
                HomePageUrl = site.Url,
                FeedUrl = $"{site.Url}/feed.json",
                Authors = new[] { author },
                Language = "en-us", 
                FavIcon = $"{site.Url}/favicon.ico", 
                Items = new List<JsonFeedItem>()
            };
            foreach (var post in posts) {
                var uriBuilder = new UriBuilder(site.Url) {
                    Path = Path.GetFileNameWithoutExtension(post.Path.ToString()),
                    Port = -1
                };
                var imageUri = post.Image;
                if (!imageUri.StartsWith("http")) {
                    var imagePathBuilder = new UriBuilder(site.Url);
                    imagePathBuilder.Path = imageUri;
                    imageUri = imagePathBuilder.Uri.ToString();
                }
                var item = new JsonFeedItem {
                    Id = uriBuilder.Uri.ToString(),
                    Title = post.Title,
                    DatePublished = post.Date,
                    Tags = post.Keywords.ToList(),
                    Authors = new[] { author },
                    Summary = post.Description,
                    Url = uriBuilder.Uri.ToString(),
                    Image = imageUri
                };
                if (post.Modified != DateTime.MinValue) { 
                    item.DateModified = post.Modified;
                }
                jsonFeed.Items.Add(item);

            }
            var jsonFeedString = jsonFeed.Write();
            File.WriteAllText(Path.Combine(srcPath, "feed.json"), jsonFeedString);
        }

        private void RegisterHandlebars() {
            foreach (var partial in Directory.GetFiles(Path.Combine(SrcPath, "partials"))) {
                Handlebars.RegisterTemplate(Path.GetFileNameWithoutExtension(partial), File.ReadAllText(partial));
            }
            Handlebars.RegisterHelper("formatDate", (writer, context, parameters) => {
                if (DateTime.TryParse(context["date"].ToString(), out var date)) {
                    writer.WriteSafeString(date.ToString("MMM dd yyyy"));
                }
            });
            Handlebars.RegisterHelper("schemaDate", (writer, context, parameters) => {
                var dateField = parameters[0];
                if (dateField != null
                    && dateField is DateTime dateTimeValidated
                    && dateTimeValidated != DateTime.MinValue) {
                    writer.WriteSafeString($"\"{dateTimeValidated:yyyy-MM-ddTHH:mm:ss.fffZ}\"");
                }
            });
            Handlebars.RegisterHelper("now", (writer, context, parameters) => {
                writer.WriteSafeString(DateTime.UtcNow.ToString("yyyy/MM/dd"));
            });
            Handlebars.RegisterHelper("year", (writer, context, parameters) => {
                writer.WriteSafeString(DateTime.UtcNow.ToString("yyyy"));
            });
            Handlebars.RegisterHelper("expires", (writer, context, parameters) => {
                writer.WriteSafeString(DateTime.UtcNow.AddMonths(6).ToString("yyyy-MM-ddTHH:mm:ss.fffZ"));
            });
            Handlebars.RegisterHelper("urlEncode", (writer, context, parameters) => {
                var linkTo = parameters[0] as string;
                if (!string.IsNullOrEmpty(linkTo)) {
                    writer.WriteSafeString(HttpUtility.UrlEncode(linkTo));
                }
            });
            Handlebars.RegisterHelper("toLower", (writer, context, parameters) => {
                var data = parameters[0] as string;
                if (!string.IsNullOrEmpty(data)) {
                    writer.WriteSafeString(data.ToLowerInvariant());
                }
            });
            foreach (var helper in new[] { "blogPath", "imagePath" }) {
                Handlebars.RegisterHelper(helper, (writer, context, parameters) => {
                    if (parameters[0].ToString() == "file") {
                        var uriBuilder = new UriBuilder(SiteGlobalMeta.Url) {
                            Path = Path.GetFileNameWithoutExtension(context["path"].ToString()),
                            Port = -1
                        };
                        writer.WriteSafeString(uriBuilder.Path.ToString());
                    }
                });
            }
        }

        private void RenderBlogPosts(List<BlogPostMeta> posts) {
            var postPath = Path.Combine(SrcPath, "partials", "post.hbs");
            if (!File.Exists(postPath)) {
                File.WriteAllText(postPath, "{{> header}}{{contents}}{{>footer}}");
            }
            var template = Handlebars.Compile(File.ReadAllText(postPath));
            foreach (var meta in posts) {
                // Create a folder for each file then add the markdown to html as index.html
                var blogPostDestFolder = Path.Combine(DestPath, Path.GetFileNameWithoutExtension(meta.Path.ToString()));
                CreateDirectoryWhenMissing(blogPostDestFolder);
                var destHtmlFile = Path.Combine(DestPath, blogPostDestFolder, "index.html");
                File.WriteAllText(destHtmlFile, template(meta), System.Text.Encoding.UTF8);
                Console.WriteLine($"Markdown: {destHtmlFile}");
            }
        }

        private void CopyFiles(string src, string dest) {
            CreateDirectoryWhenMissing(dest);
            var assets = Directory.GetFiles(src).Where(x => !(IsBuildAsset(x))).ToArray();
            foreach (var asset in assets) {
                var assetToCopy = Path.Combine(dest, Path.GetFileName(asset));
                File.Copy(asset, assetToCopy);
                Console.WriteLine($"File Copy: {assetToCopy}");
            }
        }

        private void CopyAll(string sourcePath, string destinationPath) {
            // Create all of the directories
            CreateDirectoryWhenMissing(destinationPath);
            foreach (var dirPath in Directory.GetDirectories(sourcePath, "*.*", SearchOption.AllDirectories)) {
                Directory.CreateDirectory(dirPath.Replace(sourcePath, destinationPath));
            }

            // Copy all the files & Replaces any files with the same name
            foreach (var newPath in Directory.GetFiles(sourcePath, "*.*",
                SearchOption.AllDirectories))
                File.Copy(newPath, newPath.Replace(sourcePath, destinationPath), true);
        }

        private void RenderHandlebarPages(List<BlogPostMeta> posts) {
            var pages = Directory
                .GetFiles(SrcPath)
                .Where(x =>
                    Path.GetExtension(x)
                    .Equals(".hbs", StringComparison.OrdinalIgnoreCase))
                .ToArray();

            foreach (var page in pages) {
                var extension = "html";
                var pageName = Path.GetFileNameWithoutExtension(page);
                if (pageName.ToLowerInvariant() == "security" || pageName.ToLowerInvariant() == "humans") {
                    extension = "txt";
                } else if (pageName.ToLowerInvariant() == "rss") {
                    extension = "xml";
                }
                var siteMeta = new SiteMeta();
                Map(SiteGlobalMeta as SiteMeta, ref siteMeta);
                siteMeta.Contents = File.ReadAllText(page);
                siteMeta.Posts = posts;
                var destPath = DestPath;
                if (pageName != "index" && extension == "html") {
                    destPath = Path.Combine(destPath, pageName);
                    pageName = "index";
                    CreateDirectoryWhenMissing(destPath);
                }
                var destHtmlFile = Path.Combine(destPath, $"{pageName}.{extension}");
                var template = Handlebars.Compile(File.ReadAllText(page));
                File.WriteAllText(destHtmlFile, template(siteMeta), System.Text.Encoding.UTF8);
                Console.WriteLine($"Handlebar: {destHtmlFile}");
            }
        }

        private bool IsBuildAsset(string file) {
            return Path.GetExtension(file).Equals(".md", StringComparison.OrdinalIgnoreCase)
               || Path.GetExtension(file).Equals(".hbs", StringComparison.OrdinalIgnoreCase);
        }

        private string RunCommandWithResponse(string processName, string arguments) {
            var process = new Process {
                StartInfo = {
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    Arguments = arguments,
                    FileName = processName
              }
            };
            process.Start();
            var standardOutput = string.Empty;
            while (!process.HasExited) {
                standardOutput += process.StandardOutput.ReadToEnd();
            }
            return standardOutput;
        }

        private static T ParseYaml<T>(string yml) {
            var deserializer = new DeserializerBuilder()
                .IgnoreUnmatchedProperties()
                .WithNamingConvention(UnderscoredNamingConvention.Instance)
                .Build();
            return deserializer.Deserialize<T>(yml);
        }

        private void Map<T1, T2>(T1 source, ref T2 dest) {
            var config = new MapperConfiguration(cfg => {
                cfg.CreateMap<T1, T2>();
            });
            config.CreateMapper().Map(source, dest);
        }

        private void Concat(string[] sources, string dest) {
            using Stream destStream = File.OpenWrite(Path.Combine(DestPath, dest));
            foreach (var srcFileName in sources) {
                using Stream srcStream = File.OpenRead(Path.Combine(RootPath, srcFileName));
                srcStream.CopyTo(destStream);
            }
        }

        private void CreateDirectoryWhenMissing(string directory) {
            if (!Directory.Exists(directory)) {
                Directory.CreateDirectory(directory);
            }
        }

        private void DeleteSubDirectoriesAndFilesInRoot(string path) {
            CreateDirectoryWhenMissing(path);
            var directory = new DirectoryInfo(path);
            directory.EnumerateFiles()
                .ToList().ForEach(f => f.Delete());
            directory.EnumerateDirectories()
                .ToList().ForEach(d => d.Delete(true));
        }

        private List<BlogPostMeta> GetBlogPosts() {
            //TODO: This wont scale!
            var result = new List<BlogPostMeta>();
            var markdownFiles = Directory.GetFiles(SrcPath).Where(x => x.Contains(".md")).ToArray();
            foreach (var markdownDoc in markdownFiles) {
                var markdownFileContent = File.ReadAllText(markdownDoc);
                var document = Markdown.Parse(markdownFileContent, _pipeline);
                var yamlBlock = document.Descendants<YamlFrontMatterBlock>().FirstOrDefault();
                if (yamlBlock is null) {
                    continue;
                }
                var yaml = markdownFileContent.Substring(yamlBlock.Span.Start, yamlBlock.Span.Length);

                // Trim first 3 and last 3.
                yaml = yaml[3..^3].Trim();
                var blogMeta = ParseYaml<BlogPostMeta>(yaml);
                var blogMetaValidator = new BlogPostMetaValidator();
                var results = blogMetaValidator.Validate(blogMeta);
                results.Errors.ForEach(x => {
                    var msg = $"{blogMeta.Title}:{x.PropertyName}:{x.ErrorCode}:{x.ErrorMessage}";
                    Console.WriteLine(msg);
                });

                // Merge in public wide site meta data
                var title = blogMeta.Title;
                var description = blogMeta.Description;
                var keywords = blogMeta.Keywords;
                Map(SiteGlobalMeta as SiteMeta, ref blogMeta);
                blogMeta.Title = title;
                blogMeta.Description = description;
                if (keywords.Any()) {
                    blogMeta.Keywords = keywords;
                }               

                //TODO: double parsing markdown is inefficient
                blogMeta.Contents = Markdown.ToHtml(markdownFileContent, _pipeline);
                // blogMeta.PlainText = Markdown.ToPlainText(markdownFileContent, _pipeline);

                // HACK: get lazy loading of images by default for blog content
                blogMeta.Contents = blogMeta.Contents.Replace("<img", "<img loading=\"lazy\"");
                blogMeta.Path = new Uri(markdownDoc);
                result.Add(blogMeta);
            }
            return result.OrderByDescending(x => x.Date).ToList();
        }
    }
}