using System;
using System.Collections.Generic;

namespace StaticSiteBuilder.Models {
    public class SiteMeta {

        public SiteMeta() {
        }

        public string Contents {
            get; set;
        }
        public string Company {
            get; set;
        }

        public string Twitter {
            get; set;
        }

        public string Url {
            get; set;
        }

        public string Email {
            get; set;
        }

        public string Author {
            get; set;
        }

        public Uri Path {
            get; set;
        }

        public List<BlogPostMeta> Posts {
            get; set;
        }

        public string[] Keywords {
            get; set;
        }
    }
}
