using System;

namespace StaticSiteBuilder.Models {
    public class BlogPostMeta : SiteMeta {
        public string Title {
            get; set;
        }
        public DateTime Date {
            get; set;
        }



        public string Image {
            get; set;
        }

        public string ImageAlt {
            get; set;
        }

        public string Description {
            get; set;
        }

        public double Priority {
            get; set;
        }
    }
}
