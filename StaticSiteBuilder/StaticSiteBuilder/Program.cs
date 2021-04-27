using System;

namespace StaticSiteBuilder {
    class Program {
        static void Main(string[] args) {
            Console.WriteLine("Static Site Builder");
            var siteFactory = new Logic.SiteFactory();
            siteFactory.Build();
        }
    }
}
