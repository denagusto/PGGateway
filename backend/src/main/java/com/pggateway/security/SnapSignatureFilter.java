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
    private final boolean enabled;

    // signature -> first-seen instant; bounds replay within the freshness window.
    private final ConcurrentHashMap<String, Instant> seen = new ConcurrentHashMap<>();

    public SnapSignatureFilter(ApiKeyService keys,
                               @Value("${pggateway.security.hmac.enabled:true}") boolean enabled) {
        this.keys = keys;
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

        String clientKey = req.getHeader("X-CLIENT-KEY");
        String timestamp = req.getHeader("X-TIMESTAMP");
        String signature = req.getHeader("X-SIGNATURE");

        if (blank(clientKey) || blank(timestamp) || blank(signature)) {
            deny(response, 400, "4000001",
                    "Header X-CLIENT-KEY, X-TIMESTAMP, dan X-SIGNATURE wajib diisi");
            return;
        }

        Optional<ApiKeyService.Resolved> resolved = keys.resolve(clientKey);
        if (resolved.isEmpty()) {
            deny(response, 401, "4010002", "Client key tidak dikenal atau telah dicabut");
            return;
        }
        if (!resolved.get().key().scopes().contains("ingest:write")) {
            deny(response, 403, "4030001", "Scope ingest:write tidak dimiliki kredensial ini");
            return;
        }

        Instant ts;
        try {
            ts = OffsetDateTime.parse(timestamp).toInstant();
        } catch (Exception e) {
            deny(response, 400, "4000002", "X-TIMESTAMP bukan format ISO-8601 yang valid");
            return;
        }
        Instant now = Instant.now();
        if (Duration.between(ts, now).abs().compareTo(MAX_SKEW) > 0) {
            deny(response, 401, "4010003", "Timestamp di luar toleransi 5 menit (kemungkinan replay)");
            return;
        }

        String bodyHash = SnapSignature.bodyHashHex(req.cachedBody());
        String expected = SnapSignature.sign(resolved.get().secret(),
                SnapSignature.stringToSign(req.getMethod(), req.getRequestURI(), clientKey, bodyHash, timestamp));
        if (!SnapSignature.matches(expected, signature)) {
            deny(response, 401, "4010001", "Signature tidak valid");
            return;
        }

        pruneSeen(now);
        if (seen.putIfAbsent(signature, now) != null) {
            deny(response, 409, "4090001", "Permintaan duplikat — signature sudah dipakai (replay)");
            return;
        }

        req.setAttribute(ATTR_TENANT, resolved.get().key().tenantId());
        req.setAttribute(ATTR_CLIENT_KEY, clientKey);
        chain.doFilter(req, response);
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
