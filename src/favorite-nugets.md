<!-- ---
title: Top 10 Nuget Packages
keywords:
  - Nugets
  - Fluent validation
  - Easy.Common counting lines
  - Microsoft Dependency Injection
date: 2021-10-10
description: Favorite nuget packages 
image:
imageAlt: Nugets
priority: 0.9
--- -->

I find myself using these nuget projects for most projects I build.

## FluentValidation

    Install-Package FluentValidation

<details>
<summary>Doing user input validation can be tedious. This makes it less so.</summary>


```csharp
public class CustomerValidator: AbstractValidator<Customer> {
    public CustomerValidator() {
        RuleFor(x => x.Surname).NotEmpty();
        RuleFor(x => x.Forename).NotEmpty().WithMessage("Please specify a first name");
        RuleFor(x => x.Discount).NotEqual(0).When(x => x.HasDiscount);
        RuleFor(x => x.Address).Length(20, 250);
        RuleFor(x => x.Postcode).Must(BeAValidPostcode).WithMessage("Please specify a valid postcode");
    }

    private bool BeAValidPostcode(string postcode) {
        // custom postcode validating logic goes here
    }
}

// Usage
var customer = new Customer();
var validator = new CustomerValidator();
ValidationResult results = validator.Validate(customer);

bool success = results.IsValid;
IList<ValidationFailure> failures = results.Errors;
```

</details>

[GitHub reference](https://github.com/FluentValidation/FluentValidation)

## Microsoft.Extensions.DependencyInjection

    Install-Package Microsoft.Extensions.DependencyInjection

<details>
<summary>
Dependency injection aka inversion of control is a popular pattern.  Lately I've stuck with the Microsoft version as it integrates nicely with ASP.net and fairly simple. Unit testing becomes easier since the interfaces can be mocked.
</summary>


In this example, a service collection is created using interfaces with corresponding  concrete implementation.  Then one service is used within a scope.

    var services = new ServiceCollection();
    services.AddSingleton<IMemoryCache>(new MemoryCache(new MemoryCacheOptions()));
    services.AddScoped<IEmailMessageCache, EmailMessageCache>();
    services.AddScoped<IEmailQueryProvider, EmailQueryProvider>();
    var provider = services.BuildServiceProvider();

    // usage
    using var scope = _provider.CreateScope();
    var emailProvider = scope.ServiceProvider.GetService<IEmailQueryProvider>();

</details>

[Usage reference](https://docs.microsoft.com/en-us/dotnet/core/extensions/dependency-injection-usage)

## Easy.Common

    Install-Package Easy.Common

<details>
<summary>Have you ever tried counting lines of a very large file? If not, it can get complicated quick.</summary>

    var file = new FileInfo("veryLargerFile.csv");
    using var stream = file.OpenRead(); 
    var lines = stream.CountLines();

</details>

There are other useful extensions. [GitHub reference](https://github.com/NimaAra/Easy.Common)

## Xunit, Moq, AutoMoq

    Install-Package xunit
    Install-Package Moq 
    Install-Package AutoFixture.AutoMoq


<details>
<summary></summary>

    [Fact]
        public async Task Can_get_message_from_cache() {

            // Arrange
            var expected = _fixture.Create<uint>();
            _spyCache.Setup(x => x.Get(expected))
                .Returns(_fixture
                    .Build<MailMessage>()
                    .Do(x => x.Headers.Add("UID", expected.ToString()))
                    .Create());

            // Act
            var message = await _provider.GetMessageAsync(expected);

            // Assert
            Assert.Equal(expected, uint.Parse(message.Headers["UID"]));
        }
</details>



[Xunit getting started](https://xunit.net/docs/getting-started/netcore/cmdline)
https://www.developerhandbook.com/unit-testing/writing-unit-tests-with-nunit-and-moq/#:~:text=Moq%20provides%20you%20methods%20to%20confirm%20that%20particular,was%20called%20a%20particular%20number%20of%20times.%20



## Polly

    Install-Package Polly

## PubSub

## Microsoft.OpenApi

## M2MqttDotnetCore

## LambdaSharp

## Microsoft.IdentityModel.Tokens / System.IdentityModel.Tokens.Jwt

## Refit

## SynthesizerAudio

## Honorable mentions

### S22.Imap.Core

Interacting with email via IMAP.  The library is simple and ease to use.

### Microsoft.Extensions.Caching.Memory

### EmbedIO

Cross platform HTTP / WebSocket server.

### Watson

Cross platform HTTP server.  Has attribute routing as well.