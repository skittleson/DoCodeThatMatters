---
title: Top 5 Nuget Packages 
keywords:
  - Nuget
  - Fluent validation
  - Easy.Common counting lines
  - Microsoft Dependency Injection
  - Polly
  - Xunit, Moq, AutoMoq
date: 2021-3-7
description: Top nuget packages in dotnet including fluent validation, counting lines, dependency injection, retry logic, and testing/mocking libraries.
image: images/logo-header.svg
imageAlt: Nuget logo
priority: 0.9
---

Using these nuget projects consistently in most projects I'm building.  See the examples in the details for usage.

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
<br/>

In this example, a service collection is created using interfaces with corresponding  concrete implementation.  Then one service is used within a scope.

```csharp
var services = new ServiceCollection();
services.AddSingleton<IFoo>(new Foo());
services.AddScoped<IBar, Bar>();
var provider = services.BuildServiceProvider();

// usage
using var scope = _provider.CreateScope();
var instance = scope.ServiceProvider.GetService<IBar>();
```
</details>

[Usage reference](https://docs.microsoft.com/en-us/dotnet/core/extensions/dependency-injection-usage)

## Easy.Common

    Install-Package Easy.Common

<details>
<summary>Have you ever tried counting lines of a very large file? If not, it can get complicated quick.</summary>

```csharp
var file = new FileInfo("veryLargerFile.csv");
using var stream = file.OpenRead(); 
var lines = stream.CountLines();
```    

</details>

There are other useful extensions. [GitHub reference](https://github.com/NimaAra/Easy.Common)

## Xunit, Moq, AutoMoq

    Install-Package xunit
    Install-Package Moq 
    Install-Package AutoFixture.AutoMoq


<details>
<summary>Example of mocking </summary>

```csharp
    [Fact]
    public async Task Can_get_message_from_cache() {

        // Arrange
        var expected = _fixture.Create<uint>();
        _mock.Setup(x => x.Get(expected))
            .Returns(_fixture
                .Build<Message>()
                .Do(x => x.Headers.Add("UID", expected.ToString()))
                .Create());

        // Act
        var message = await _provider.GetMessageAsync(expected);

        // Assert
        Assert.Equal(expected, uint.Parse(message.Headers["UID"]));
    }
```
</details>



[Xunit getting started](https://xunit.net/docs/getting-started/netcore/cmdline)
https://www.developerhandbook.com/unit-testing/writing-unit-tests-with-nunit-and-moq/#:~:text=Moq%20provides%20you%20methods%20to%20confirm%20that%20particular,was%20called%20a%20particular%20number%20of%20times.%20


## Polly

    Install-Package Polly

<details>
<summary>Need retry logic?  Exponential back off? This project solves the problems easily with tons of of extensions!</summary>

```csharp
var retryPolicy = Policy.Handle<TransientException>()
.WaitAndRetry(retryCount: 3, sleepDurationProvider: _ => TimeSpan.FromSeconds(1));

var attempt = 0;
retryPolicy.Execute(() =>
{
    Log($"Attempt {++attempt}");
    throw new TransientException();
});
```
</details>

 [GitHub reference](https://github.com/App-vNext/Polly)


## Honorable mentions

- [LambdaSharp](https://lambdasharp.net) - deploy to AWS lambda and resources easier and safer.
- [PubSub](https://github.com/upta/pubsub) - publish and subscribe pattern
- [M2MqttDotnetCore](https://github.com/mohaqeq/paho.mqtt.m2mqtt) - MQTT client
- [SynthesizerAudio](https://www.nuget.org/packages/SynthesizerAudio/) - Synthesize text to speech
- [Microsoft.OpenApi](https://github.com/Microsoft/OpenAPI.NET) - like swagger but better
- [Microsoft.IdentityModel.Tokens / System.IdentityModel.Tokens.Jwt](https://docs.microsoft.com/en-us/dotnet/api/system.identitymodel.tokens.jwt?view=azure-dotnet)  Working with JWTs.  Not easiest to read but essential for understanding how to use them.
- [Refit](https://github.com/reactiveui/refit) - safe type REST library
- [S22.Imap.Core](https://www.nuget.org/packages/S22.Imap.Core/) - Interacting with email via IMAP.  The library is simple and ease to use.
- [Microsoft.Extensions.Caching.Memory](https://docs.microsoft.com/en-us/dotnet/core/extensions/caching) - caching safely
- [EmbedIO](https://github.com/unosquare/embedio) - Cross platform HTTP / WebSocket server.
- [Watson](https://github.com/jchristn/WatsonWebserver) - Cross platform HTTP server.  Has attribute routing as well.