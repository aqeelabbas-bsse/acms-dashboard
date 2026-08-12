namespace AcmsDashboard.Api.Services;

/// <summary>
/// Why a language-model call failed. The failover layer needs this: a quota
/// exhaustion should park Gemini for a long while, an unreachable network
/// should park it briefly, and a malformed-request error should not park it at
/// all because retrying costs nothing and the next question may be fine.
/// </summary>
public enum NlFailureKind
{
    Unknown = 0,

    /// <summary>DNS failure, connection refused, no route to host. Offline.</summary>
    Unreachable,

    /// <summary>The request was sent but no response arrived in time.</summary>
    Timeout,

    /// <summary>Rate limit or daily quota exhausted (HTTP 429).</summary>
    Quota,

    /// <summary>API key rejected (HTTP 401/403).</summary>
    Auth,

    /// <summary>The provider rejected the request shape (HTTP 400).</summary>
    BadRequest,

    /// <summary>A response arrived but contained no usable text.</summary>
    EmptyResponse,

    /// <summary>Provider is not configured at all (no API key, no base URL).</summary>
    NotConfigured,
}

public class NlProviderException : Exception
{
    public NlFailureKind Kind { get; }

    public NlProviderException(
        string message,
        Exception? inner = null,
        NlFailureKind kind = NlFailureKind.Unknown)
        : base(message, inner)
    {
        Kind = kind;
    }
}