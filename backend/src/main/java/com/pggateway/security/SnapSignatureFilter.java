package com.pggateway.security;

import com.pggateway.developer.ApiKeyService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Enforces the SNAP symmetric signature on every ingest request. A PJP must send:
 * <pre>
 *   X-CLIENT-KEY  the pgk_ key identifying the partner
 *   X-TIMESTAMP   ISO-8601 with offset, e.g. 2026-06-27T10:00:00+07:00
 *   X-SIGNATURE   Base64( HMAC-SHA512( stringToSign, clientSecret ) )
 * </pre>
 * The gateway recomputes the signature over {METHOD:path:clientKey:sha256(body):timestamp} and
 * rejects anything that doesn't match, is stale (outside a 5-minute window), or replays a
 * signature already seen. On success it stamps the resolved tenant (PJP) onto the request so the
 * ingest pipeline knows which partner the event belongs to.
 *
 * Errors use a SNAP-shaped body: {"responseCode","responseMessage"}.
 *
 * Toggle with {@code pggateway.security.hmac.enabled} (default true).
 */
@Component
public class SnapSignatureFilter extends OncePerRequestFilter {

    public static final String ATTR_TENANT = "pggateway.tenantId";
    public static final String ATTR_CLIENT_KEY = "pggateway.clientKey";

    private static final String PROTECTED_PREFIX = "/api/ingest/";
    private static final Duration MAX_SKEW = Duration.ofMinutes(5);

    private final ApiKeyService keys;
    private final com.pggateway.developer.IntegrationLog integrationLog;
    private final boolean enabled;

    // signature -> first-seen instant; bounds replay within the freshness window.
    private final ConcurrentHashMap<String, Instant> seen = new ConcurrentHashMap<>();

    public SnapSignatureFilter(ApiKeyService keys, com.pggateway.developer.IntegrationLog integrationLog,
                               @Value("${pggateway.security.hmac.enabled:true}") boolean enabled) {
        this.keys = keys;
        this.integrationLog = integrationLog;
        this.enabled = enabled;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !enabled || !request.getRequestURI().startsWith(PROTECTED_PREFIX);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        CachedBodyHttpServletRequest req = new CachedBodyHttpServletRequest(request);
        long start = System.nanoTime();
        String method = req.getMethod();
        String path = req.getRequestURI();

        String clientKey = req.getHeader("X-CLIENT-KEY");
        String timestamp = req.getHeader("X-TIMESTAMP");
        String signature = req.getHeader("X-SIGNATURE");

        if (blank(clientKey) || blank(timestamp) || blank(signature)) {
            denyLog(response, 400, "4000001",
                    "Header X-CLIENT-KEY, X-TIMESTAMP, dan X-SIGNATURE wajib diisi", clientKey, null, method, path, start);
            return;
        }

        Optional<ApiKeyService.Resolved> resolved = keys.resolve(clientKey);
        if (resolved.isEmpty()) {
            denyLog(response, 401, "4010002", "Client key tidak dikenal atau telah dicabut", clientKey, null, method, path, start);
            return;
        }
        String tenantId = resolved.get().key().tenantId();
        if (!resolved.get().key().scopes().contains("ingest:write")) {
            denyLog(response, 403, "4030001", "Scope ingest:write tidak dimiliki kredensial ini", clientKey, tenantId, method, path, start);
            return;
        }

        Instant ts;
        try {
            ts = OffsetDateTime.parse(timestamp).toInstant();
        } catch (Exception e) {
            denyLog(response, 400, "4000002", "X-TIMESTAMP bukan format ISO-8601 yang valid", clientKey, tenantId, method, path, start);
            return;
        }
        Instant now = Instant.now();
        if (Duration.between(ts, now).abs().compareTo(MAX_SKEW) > 0) {
            denyLog(response, 401, "4010003", "Timestamp di luar toleransi 5 menit (kemungkinan replay)", clientKey, tenantId, method, path, start);
            return;
        }

        String bodyHash = SnapSignature.bodyHashHex(req.cachedBody());
        String expected = SnapSignature.sign(resolved.get().secret(),
                SnapSignature.stringToSign(method, path, clientKey, bodyHash, timestamp));
        if (!SnapSignature.matches(expected, signature)) {
            denyLog(response, 401, "4010001", "Signature tidak valid", clientKey, tenantId, method, path, start);
            return;
        }

        pruneSeen(now);
        if (seen.putIfAbsent(signature, now) != null) {
            denyLog(response, 409, "4090001", "Permintaan duplikat — signature sudah dipakai (replay)", clientKey, tenantId, method, path, start);
            return;
        }

        req.setAttribute(ATTR_TENANT, tenantId);
        req.setAttribute(ATTR_CLIENT_KEY, clientKey);
        chain.doFilter(req, response);
        int status = response.getStatus();
        integrationLog.record(clientKey, tenantId, method, path, status,
                status < 400 ? "OK" : String.valueOf(status),
                status < 400 ? "Diterima" : "Ditolak oleh handler", elapsedMs(start));
    }

    /** Write the SNAP error response AND record the failed attempt to the integration monitor. */
    private void denyLog(HttpServletResponse response, int status, String code, String message,
                         String clientKey, String tenantId, String method, String path, long start)
            throws IOException {
        integrationLog.record(clientKey, tenantId, method, path, status, code, message, elapsedMs(start));
        deny(response, status, code, message);
    }

    private static long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }

    private void pruneSeen(Instant now) {
        // keep the replay set small; anything older than the skew window can no longer be replayed.
        if (seen.size() > 1 || ThreadLocalRandom.current().nextInt(16) == 0) {
            seen.values().removeIf(t -> Duration.between(t, now).compareTo(MAX_SKEW) > 0);
        }
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static void deny(HttpServletResponse response, int status, String code, String message)
            throws IOException {
        response.setStatus(status);
        response.setCharacterEncoding("UTF-8");
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(
                "{\"responseCode\":\"" + code + "\",\"responseMessage\":\"" + message + "\"}");
    }
}
