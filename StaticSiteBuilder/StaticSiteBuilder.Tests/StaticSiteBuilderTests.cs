using System.Threading.Tasks;
using Xunit;

namespace StaticSiteBuilder.Tests
{
    public class StaticSiteBuilderTests
    {
        private Logic.SiteFactory _logic;

        public StaticSiteBuilderTests(){
            _logic = (new Logic.SiteFactory());
            
            // Act
            _logic.Build(); 
        }

        [Fact]
        public async Task Ensure_All_Images_Rendered_In_Markdown_Lazy_Load(){

            // Assert
            var srcFile = await System.IO.File.ReadAllTextAsync(System.IO.Path.Combine(_logic.SrcPath, "power-switch-monitor.md") );
            var destFile = await System.IO.File.ReadAllTextAsync(
                System.IO.Path.Combine(_logic.DestPath, "power-switch-monitor", "index.html"));
            Assert.True(srcFile.IndexOf("![](https://media.giphy.com/media/1M9fmo1WAFVK0/source.gif)") != -1);
            Assert.True(destFile.IndexOf("loading=\"lazy\" src=\"https://media.giphy.com/media/1M9fmo1WAFVK0/source.gif\"") != -1);
        }
    }
}
