// BeZhasConnect — BeZhas integration client for .NET / C#.
//
// The same outward-facing surface as the JS @bezhas/connect, for the platforms
// that run on .NET: CargoWise add-ins, Windows customs-broker software, WPF/WinForms
// back-office tools, ASP.NET middleware.
//
// Depends only on the BCL (System.Net.Http + System.Text.Json) — no NuGet packages.
// Targets .NET 6+ (works on .NET Framework 4.7.2+ with System.Text.Json reference).
//
//   var bz = new BeZhasConnect(apiKey: "sk_live_...");
//   var order = await bz.Pay.BuyAsync(amountUSD: 49.9m, paymentMethod: "card", email: "a@b.com");
//   Console.WriteLine(order.GetProperty("checkoutUrl").GetString());

using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace BeZhas.Connect
{
    public sealed class BeZhasApiException : Exception
    {
        public int Status { get; }
        public string? Body { get; }
        public string? Endpoint { get; }
        public BeZhasApiException(string message, int status, string? body, string? endpoint) : base(message)
        {
            Status = status; Body = body; Endpoint = endpoint;
        }
    }

    public sealed class BeZhasConnect : IDisposable
    {
        private static readonly string[] PaymentMethods = { "card", "crypto", "qr", "bank" };
        private static readonly string[] ReceiveMethods = { "card", "bank", "crypto" };

        private readonly HttpClient _http;
        private readonly string? _apiKey;
        private readonly string? _userToken;
        public string BaseUrl { get; }
        public PayModule Pay { get; }
        public CargoLinkModule CargoLink { get; }

        public BeZhasConnect(string? apiKey = null, string? userToken = null,
            string baseUrl = "https://api.bez.digital", HttpClient? httpClient = null, double timeoutSeconds = 15)
        {
            _apiKey = apiKey;
            _userToken = userToken;
            BaseUrl = baseUrl.TrimEnd('/');
            _http = httpClient ?? new HttpClient { Timeout = TimeSpan.FromSeconds(timeoutSeconds) };
            Pay = new PayModule(this);
            CargoLink = new CargoLinkModule(this);
        }

        internal async Task<JsonElement> RequestAsync(HttpMethod method, string path,
            IDictionary<string, object?>? query = null, object? body = null, string? bearer = null,
            CancellationToken ct = default)
        {
            var url = BaseUrl + path;
            if (query != null)
            {
                var parts = new List<string>();
                foreach (var kv in query)
                    if (kv.Value != null)
                        parts.Add(Uri.EscapeDataString(kv.Key) + "=" + Uri.EscapeDataString(kv.Value.ToString()!));
                if (parts.Count > 0) url += "?" + string.Join("&", parts);
            }

            using var req = new HttpRequestMessage(method, url);
            req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            if (_apiKey != null) req.Headers.TryAddWithoutValidation("x-api-key", _apiKey);
            var token = bearer ?? _userToken;
            if (token != null) req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            if (body != null)
                req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

            HttpResponseMessage res;
            try { res = await _http.SendAsync(req, ct).ConfigureAwait(false); }
            catch (Exception e) { throw new BeZhasApiException($"Network error calling {path}: {e.Message}", 0, null, path); }

            var text = await res.Content.ReadAsStringAsync().ConfigureAwait(false);
            if (!res.IsSuccessStatusCode)
            {
                string msg = $"{(int)res.StatusCode} {res.ReasonPhrase}";
                try { if (JsonDocument.Parse(text).RootElement.TryGetProperty("error", out var e)) msg = e.GetString() ?? msg; }
                catch { /* non-JSON body */ }
                throw new BeZhasApiException($"BeZhas API {(int)res.StatusCode}: {msg}", (int)res.StatusCode, text, path);
            }
            return string.IsNullOrEmpty(text) ? default : JsonDocument.Parse(text).RootElement.Clone();
        }

        public void Dispose() => _http.Dispose();

        public sealed class PayModule
        {
            private readonly BeZhasConnect _c;
            internal PayModule(BeZhasConnect c) => _c = c;

            public Task<JsonElement> BuyAsync(decimal amountUSD, string paymentMethod, string? walletAddress = null,
                string? stripeUseCase = null, string? email = null, CancellationToken ct = default)
            {
                if (Array.IndexOf(PaymentMethods, paymentMethod) < 0)
                    throw new ArgumentException("paymentMethod must be one of " + string.Join(", ", PaymentMethods));
                if (amountUSD < 1) throw new ArgumentException("amountUSD must be >= 1");
                return _c.RequestAsync(HttpMethod.Post, "/api/gateway/v1/payments/buy", body: new
                {
                    amountUSD, paymentMethod, walletAddress, stripeUseCase, email
                }, ct: ct);
            }

            public Task<JsonElement> SellAsync(string walletAddress, decimal amountBEZ, string receiveMethod, CancellationToken ct = default)
            {
                if (Array.IndexOf(ReceiveMethods, receiveMethod) < 0)
                    throw new ArgumentException("receiveMethod must be one of " + string.Join(", ", ReceiveMethods));
                return _c.RequestAsync(HttpMethod.Post, "/api/gateway/v1/payments/sell",
                    body: new { walletAddress, amountBEZ, receiveMethod }, ct: ct);
            }

            public Task<JsonElement> SendAsync(string sender, string recipient, decimal amount, string? note = null, CancellationToken ct = default)
                => _c.RequestAsync(HttpMethod.Post, "/api/gateway/v1/payments/send",
                    body: new { sender, recipient, amount, note }, ct: ct);

            public Task<JsonElement> HistoryAsync(string address, int? limit = null, CancellationToken ct = default)
                => _c.RequestAsync(HttpMethod.Get, $"/api/gateway/v1/payments/history/{address}",
                    query: new Dictionary<string, object?> { ["limit"] = limit }, ct: ct);

            public Task<JsonElement> PriceAsync(CancellationToken ct = default)
                => _c.RequestAsync(HttpMethod.Get, "/api/gateway/v1/token/price", ct: ct);
        }

        public sealed class CargoLinkModule
        {
            private readonly BeZhasConnect _c;
            private readonly string? _roleKey;
            internal CargoLinkModule(BeZhasConnect c, string? roleKey = null) { _c = c; _roleKey = roleKey; }
            public CargoLinkModule WithRoleKey(string roleKey) => new CargoLinkModule(_c, roleKey);
            private string? Bearer(string? rk) => rk ?? _roleKey;

            public Task<JsonElement> HealthAsync(CancellationToken ct = default)
                => _c.RequestAsync(HttpMethod.Get, "/api/cargolink/health", ct: ct);

            public Task<JsonElement> LinkPosAsync(string baseUrl, string provider = "generic", string ordersPath = "/orders",
                string? apiKey = null, string? roleKey = null, CancellationToken ct = default)
                => _c.RequestAsync(HttpMethod.Post, "/api/cargolink/v1/pos/link",
                    body: new { baseUrl, provider, ordersPath, apiKey }, bearer: Bearer(roleKey), ct: ct);

            public Task<JsonElement> SyncOrdersAsync(string? roleKey = null, CancellationToken ct = default)
                => _c.RequestAsync(HttpMethod.Post, "/api/cargolink/v1/pos/sync", bearer: Bearer(roleKey), ct: ct);

            public Task<JsonElement> CreateTxAsync(object tx, string? roleKey = null, CancellationToken ct = default)
                => _c.RequestAsync(HttpMethod.Post, "/api/cargolink/v1/tx", body: tx, bearer: Bearer(roleKey), ct: ct);

            public Task<JsonElement> AdvanceTxAsync(string bUid, object? body = null, string? roleKey = null, CancellationToken ct = default)
                => _c.RequestAsync(HttpMethod.Post, $"/api/cargolink/v1/tx/{bUid}/advance",
                    body: body ?? new { }, bearer: Bearer(roleKey), ct: ct);

            public Task<JsonElement> RegisterWebhookAsync(string url, string[] events, string? roleKey = null, CancellationToken ct = default)
                => _c.RequestAsync(HttpMethod.Post, "/api/cargolink/v1/webhooks/register",
                    body: new { url, events }, bearer: Bearer(roleKey), ct: ct);
        }
    }

    /// <summary>Verify signed webhook deliveries (X-BeZhas-Signature: sha256=hex), timing-safe.</summary>
    public static class BeZhasWebhooks
    {
        public const string SignatureHeader = "X-BeZhas-Signature";
        public const string EventHeader = "X-BeZhas-Event";

        public static bool Verify(string rawBody, string signature, string secret)
        {
            if (string.IsNullOrEmpty(secret) || string.IsNullOrEmpty(signature)) return false;
            var idx = signature.IndexOf('=');
            var sig = (idx >= 0 ? signature.Substring(idx + 1) : signature).Trim().ToLowerInvariant();
            using var h = new System.Security.Cryptography.HMACSHA256(Encoding.UTF8.GetBytes(secret));
            var expected = BitConverter.ToString(h.ComputeHash(Encoding.UTF8.GetBytes(rawBody))).Replace("-", "").ToLowerInvariant();
            if (expected.Length != sig.Length) return false;
            // constant-time compare
            int diff = 0;
            for (int i = 0; i < expected.Length; i++) diff |= expected[i] ^ sig[i];
            return diff == 0;
        }
    }
}
