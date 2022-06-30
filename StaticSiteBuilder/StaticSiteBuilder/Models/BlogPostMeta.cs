using FluentValidation;
using System;

namespace StaticSiteBuilder.Models {
    public class BlogPostMeta : SiteMeta {

        public DateTime Date {
            get; set;
        }

        public DateTime Modified {
            get; set;
        }

        public string Image {
            get; set;
        }

        public string Alt {
            get; set;
        }

        public new string Description {
            get; set;
        }

        public double Priority {
            get; set;
        }
    }

    public class BlogPostMetaValidator : AbstractValidator<BlogPostMeta> {
        public BlogPostMetaValidator() {
            RuleFor(x => x.Date).NotEmpty();
            RuleFor(x => x.Image).NotEmpty().WithMessage("Must contain image");
            RuleFor(x => x.Alt).NotEmpty().WithMessage("Must contain image description");
            RuleFor(x => x.Title).Length(5, 50);
            RuleFor(x => x.Description).Length(25, 150);
            //RuleFor(x => x.Discount).NotEqual(0).When(x => x.HasDiscount);
            //RuleFor(x => x.Postcode).Must(BeAValidPostcode).WithMessage("Please specify a valid postcode");
        }
    }
}
