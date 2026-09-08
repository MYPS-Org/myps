using Hangfire.Models;
using Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Xunit;

namespace MYPS.UnitTests;

public sealed class ExceptionHandlerTests
{
    [Fact]
    [Trait("Layer", "Characterization")]
    public void NullableValueException_ProducesSpecificDeveloperDiagnostic()
    {
        var logger = new CapturingLogger<ExceptionHandler>();
        var context = CreateContext("/api/Project/addproject/");
        var handler = new ExceptionHandler(
            logger,
            new HttpContextAccessor { HttpContext = context },
            new TestHostEnvironment(Environments.Development));

        ObjectResult result = handler.Handle(
            new InvalidOperationException("Nullable object must have a value."),
            new { DetailedDesign = 1, DetailedDesignDate = (DateTime?)null },
            "test-user");

        Assert.Equal(StatusCodes.Status400BadRequest, result.StatusCode);
        string response = System.Text.Json.JsonSerializer.Serialize(result.Value);
        Assert.Contains("NullableValueAccess", response, StringComparison.Ordinal);
        Assert.Contains("NullableValueAccess", logger.LastMessage, StringComparison.Ordinal);
        Assert.Contains("FAILURE LOCATION", logger.LastMessage, StringComparison.Ordinal);
        Assert.Contains("RECOMMENDED FIX", logger.LastMessage, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "Characterization")]
    public void PayloadSecrets_AreRedactedFromLog()
    {
        var logger = new CapturingLogger<ExceptionHandler>();
        var handler = new ExceptionHandler(
            logger,
            new HttpContextAccessor { HttpContext = CreateContext("/api/test") },
            new TestHostEnvironment(Environments.Development));

        handler.Handle(
            new TimeoutException("test timeout"),
            new { UserName = "tester", Password = "test-user-password", Token = "test-token-value" },
            "tester");

        Assert.Contains("Timeout", logger.LastMessage, StringComparison.Ordinal);
        Assert.Contains("[REDACTED]", logger.LastMessage, StringComparison.Ordinal);
        Assert.DoesNotContain("test-user-password", logger.LastMessage, StringComparison.Ordinal);
        Assert.DoesNotContain("test-token-value", logger.LastMessage, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "Characterization")]
    public void HangfireJobPayload_ProducesDiagnosticWithRequestedByAsUserId()
    {
        // ReportJobService/ImportProjectJobService's top-level "job failed" catch blocks now call
        // _exceptionHandler.Handle(ex, payload, payload.RequestedBy) outside any HTTP request
        // context (Hangfire jobs run off the job queue, not a controller pipeline) -- confirms the
        // handler still produces a well-formed diagnostic report for a job-payload-shaped dto, with
        // no HttpContext available, and that the job's own RequestedBy field flows through as the
        // report's userId the same way _Session.UserId does for a controller action.
        var logger = new CapturingLogger<ExceptionHandler>();
        var handler = new ExceptionHandler(
            logger,
            new HttpContextAccessor { HttpContext = null }, // no HTTP context in a background job
            new TestHostEnvironment(Environments.Development));

        var payload = new ReportJobPayload
        {
            JobId = "test-job-id",
            ReportName = "aip-executive-2",
            QueryString = "programid=P_TEST",
            RequestedBy = "test-requester"
        };

        ObjectResult result = handler.Handle(
            new InvalidOperationException("simulated report job failure"),
            payload,
            payload.RequestedBy);

        Assert.Equal(StatusCodes.Status400BadRequest, result.StatusCode);
        Assert.Contains("test-job-id", logger.LastMessage, StringComparison.Ordinal);
        Assert.Contains("test-requester", logger.LastMessage, StringComparison.Ordinal);
    }

    private static DefaultHttpContext CreateContext(string path)
    {
        var context = new DefaultHttpContext();
        context.Request.Method = HttpMethods.Post;
        context.Request.Path = path;
        context.TraceIdentifier = "TEST-TRACE";
        context.Connection.RemoteIpAddress = System.Net.IPAddress.Loopback;
        return context;
    }
}

internal sealed class CapturingLogger<T> : ILogger<T>
{
    public string LastMessage { get; private set; } = string.Empty;
    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
    public bool IsEnabled(LogLevel logLevel) => true;
    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state,
        Exception? exception, Func<TState, Exception?, string> formatter)
        => LastMessage = formatter(state, exception);
}

internal sealed class TestHostEnvironment(string environmentName) : IHostEnvironment
{
    public string EnvironmentName { get; set; } = environmentName;
    public string ApplicationName { get; set; } = "MYPS.UnitTests";
    public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
