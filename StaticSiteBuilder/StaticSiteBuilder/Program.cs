using System;

namespace StaticSiteBuilder {
    class Program {
        static void Main(string[] args) {
            Console.WriteLine("Static Site Builder for My Personal Blog");
            var siteFactory = new Logic.SiteFactory();
            siteFactory.Build();
        }
    }
}
