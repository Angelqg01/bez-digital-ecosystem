package digital.bez.connect;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * BeZhasConnect — BeZhas integration client for Java.
 *
 * The outward-facing surface (Pay + CargoLink) for the platforms that run the
 * enterprise logistics/customs/banking world on the JVM: SAP TM, Oracle OTM,
 * CargoWise, customs-broker middleware, SWIFT/SEPA back-office.
 *
 * Zero third-party dependencies — only the JDK (java.net.http, JDK 11+). Request
 * bodies are built with a tiny JSON writer; responses are returned as the raw
 * JSON String for the caller to parse with whatever they already use (Jackson,
 * Gson, JSON-B). This keeps the connector deployable in locked-down environments.
 *
 *   BeZhasConnect bz = new BeZhasConnect.Builder().apiKey("sk_live_...").build();
 *   String order = bz.pay().buy(49.90, "card", null, null, "a@b.com");
 *
 * Auth: apiKey -> x-api-key ; userToken -> Authorization Bearer ;
 *       CargoLink roleKey -> per-call bearer.
 */
public final class BeZhasConnect {

    public static final class BeZhasApiException extends RuntimeException {
        public final int status;
        public final String body;
        public final String endpoint;
        BeZhasApiException(String message, int status, String body, String endpoint) {
            super(message);
            this.status = status; this.body = body; this.endpoint = endpoint;
        }
    }

    private final HttpClient http;
    private final String apiKey;
    private final String userToken;
    private final String baseUrl;
    private final Duration timeout;
    private final Pay pay;
    private final CargoLink cargolink;

    private BeZhasConnect(Builder b) {
        this.apiKey = b.apiKey;
        this.userToken = b.userToken;
        this.baseUrl = b.baseUrl.replaceAll("/$", "");
        this.timeout = Duration.ofMillis(b.timeoutMs);
        this.http = b.httpClient != null ? b.httpClient
                : HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        this.pay = new Pay(this);
        this.cargolink = new CargoLink(this, null);
    }

    public Pay pay() { return pay; }
    public CargoLink cargolink() { return cargolink; }

    public static final class Builder {
        private String apiKey, userToken;
        private String baseUrl = "https://api.bez.digital";
        private long timeoutMs = 15000;
        private HttpClient httpClient;
        public Builder apiKey(String v) { this.apiKey = v; return this; }
        public Builder userToken(String v) { this.userToken = v; return this; }
        public Builder baseUrl(String v) { this.baseUrl = v; return this; }
        public Builder timeoutMs(long v) { this.timeoutMs = v; return this; }
        public Builder httpClient(HttpClient v) { this.httpClient = v; return this; }
        public BeZhasConnect build() { return new BeZhasConnect(this); }
    }

    /** Core request. Returns the raw JSON response body as a String. */
    String request(String method, String path, String query, String jsonBody, String bearer) {
        String url = baseUrl + path + (query != null && !query.isEmpty() ? "?" + query : "");
        HttpRequest.Builder rb = HttpRequest.newBuilder(URI.create(url)).timeout(timeout)
                .header("Accept", "application/json");
        if (apiKey != null) rb.header("x-api-key", apiKey);
        String token = bearer != null ? bearer : userToken;
        if (token != null) rb.header("Authorization", "Bearer " + token);

        if (jsonBody != null) {
            rb.header("Content-Type", "application/json");
            rb.method(method, HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8));
        } else {
            rb.method(method, HttpRequest.BodyPublishers.noBody());
        }

        HttpResponse<String> res;
        try {
            res = http.send(rb.build(), HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            throw new BeZhasApiException("Network error calling " + path + ": " + e.getMessage(), 0, null, path);
        }
        if (res.statusCode() < 200 || res.statusCode() >= 300) {
            throw new BeZhasApiException("BeZhas API " + res.statusCode() + ": " + res.body(),
                    res.statusCode(), res.body(), path);
        }
        return res.body();
    }

    // ── Pay ──────────────────────────────────────────────────────────────────
    public static final class Pay {
        private final BeZhasConnect c;
        Pay(BeZhasConnect c) { this.c = c; }

        public String buy(double amountUSD, String paymentMethod, String walletAddress,
                          String stripeUseCase, String email) {
            if (!Json.contains(new String[]{"card", "crypto", "qr", "bank"}, paymentMethod))
                throw new IllegalArgumentException("paymentMethod must be card|crypto|qr|bank");
            if (amountUSD < 1) throw new IllegalArgumentException("amountUSD must be >= 1");
            Map<String, Object> b = new LinkedHashMap<>();
            b.put("amountUSD", amountUSD);
            b.put("paymentMethod", paymentMethod);
            if (walletAddress != null) b.put("walletAddress", walletAddress);
            if (stripeUseCase != null) b.put("stripeUseCase", stripeUseCase);
            if (email != null) b.put("email", email);
            return c.request("POST", "/api/gateway/v1/payments/buy", null, Json.obj(b), null);
        }

        public String send(String sender, String recipient, double amount, String note) {
            Map<String, Object> b = new LinkedHashMap<>();
            b.put("sender", sender); b.put("recipient", recipient); b.put("amount", amount);
            if (note != null) b.put("note", note);
            return c.request("POST", "/api/gateway/v1/payments/send", null, Json.obj(b), null);
        }

        public String history(String address, Integer limit) {
            String q = limit != null ? "limit=" + limit : null;
            return c.request("GET", "/api/gateway/v1/payments/history/" + Json.enc(address), q, null, null);
        }

        public String price() { return c.request("GET", "/api/gateway/v1/token/price", null, null, null); }
    }

    // ── CargoLink ────────────────────────────────────────────────────────────
    public static final class CargoLink {
        private final BeZhasConnect c;
        private final String roleKey;
        CargoLink(BeZhasConnect c, String roleKey) { this.c = c; this.roleKey = roleKey; }
        public CargoLink withRoleKey(String rk) { return new CargoLink(c, rk); }
        private String bearer(String rk) { return rk != null ? rk : roleKey; }

        public String health() { return c.request("GET", "/api/cargolink/health", null, null, null); }

        public String linkPos(String baseUrl, String provider, String ordersPath, String apiKey, String roleKey) {
            Map<String, Object> b = new LinkedHashMap<>();
            b.put("baseUrl", baseUrl);
            b.put("provider", provider != null ? provider : "generic");
            b.put("ordersPath", ordersPath != null ? ordersPath : "/orders");
            if (apiKey != null) b.put("apiKey", apiKey);
            return c.request("POST", "/api/cargolink/v1/pos/link", null, Json.obj(b), bearer(roleKey));
        }

        public String syncOrders(String roleKey) {
            return c.request("POST", "/api/cargolink/v1/pos/sync", null, null, bearer(roleKey));
        }

        /** Create a B-UID transaction. Pass an already-built JSON object body. */
        public String createTx(String jsonBody, String roleKey) {
            return c.request("POST", "/api/cargolink/v1/tx", null, jsonBody, bearer(roleKey));
        }

        public String advanceTx(String bUid, String jsonBody, String roleKey) {
            return c.request("POST", "/api/cargolink/v1/tx/" + Json.enc(bUid) + "/advance",
                    null, jsonBody != null ? jsonBody : "{}", bearer(roleKey));
        }

        public String registerWebhook(String url, String[] events, String roleKey) {
            Map<String, Object> b = new LinkedHashMap<>();
            b.put("url", url);
            b.put("events", events);
            return c.request("POST", "/api/cargolink/v1/webhooks/register", null, Json.obj(b), bearer(roleKey));
        }
    }

    // ── Webhook verification ───────────────────────────────────────────────────
    public static final String SIGNATURE_HEADER = "X-BeZhas-Signature";
    public static final String EVENT_HEADER = "X-BeZhas-Event";

    /** Timing-safe HMAC-SHA256 verify. Accepts `sha256=<hex>` and bare hex. */
    public static boolean verifyWebhook(String rawBody, String signature, String secret) {
        if (secret == null || secret.isEmpty() || signature == null || signature.isEmpty()) return false;
        int eq = signature.indexOf('=');
        String sig = (eq >= 0 ? signature.substring(eq + 1) : signature).trim().toLowerCase();
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] raw = mac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(raw.length * 2);
            for (byte x : raw) hex.append(Character.forDigit((x >> 4) & 0xF, 16)).append(Character.forDigit(x & 0xF, 16));
            String expected = hex.toString();
            if (expected.length() != sig.length()) return false;
            int diff = 0;
            for (int i = 0; i < expected.length(); i++) diff |= expected.charAt(i) ^ sig.charAt(i);
            return diff == 0;
        } catch (Exception e) {
            return false;
        }
    }

    // ── Minimal JSON writer (flat request bodies only) ─────────────────────────
    static final class Json {
        static boolean contains(String[] arr, String v) {
            for (String s : arr) if (s.equals(v)) return true;
            return false;
        }
        static String enc(String s) { return URLEncoder.encode(s, StandardCharsets.UTF_8); }

        static String obj(Map<String, Object> map) {
            StringBuilder sb = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<String, Object> e : map.entrySet()) {
                if (!first) sb.append(',');
                first = false;
                sb.append(str(e.getKey())).append(':').append(val(e.getValue()));
            }
            return sb.append('}').toString();
        }

        static String val(Object v) {
            if (v == null) return "null";
            if (v instanceof Number || v instanceof Boolean) return v.toString();
            if (v instanceof String[]) {
                StringBuilder sb = new StringBuilder("[");
                String[] a = (String[]) v;
                for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(','); sb.append(str(a[i])); }
                return sb.append(']').toString();
            }
            return str(v.toString());
        }

        static String str(String s) {
            StringBuilder sb = new StringBuilder("\"");
            for (int i = 0; i < s.length(); i++) {
                char ch = s.charAt(i);
                switch (ch) {
                    case '"': sb.append("\\\""); break;
                    case '\\': sb.append("\\\\"); break;
                    case '\n': sb.append("\\n"); break;
                    case '\r': sb.append("\\r"); break;
                    case '\t': sb.append("\\t"); break;
                    default:
                        if (ch < 0x20) sb.append(String.format("\\u%04x", (int) ch));
                        else sb.append(ch);
                }
            }
            return sb.append('"').toString();
        }
    }
}
