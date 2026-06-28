package com.pggateway.developer;

import com.pggateway.security.SnapSignature;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Signature playground — the dev tool integrators reach for most. Given a request (method, path,
 * body) and a sandbox client key, it returns every piece of the SNAP signature: the timestamp, the
 * body SHA-256, the exact {@code stringToSign}, and the Base64 HMAC-SHA512 signature, plus the
 * ready-to-paste headers. It reuses the SAME {@link SnapSignature} code the ingest filter verifies
 * with, so what the playground produces is guaranteed to validate. JWT-authed; signs only with keys
 * the caller's tenant owns (resolved server-side — the secret never reaches the browser).
 */
@RestController
@RequestMapping("/api/dev/sign")
public class SignatureController {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final ApiKeyService keys;

    public SignatureController(ApiKeyService keys) {
        this.keys = keys;
    }

    @PostMapping
    public ResponseEntity<?> sign(@RequestBody SignRequest req) {
        if (req.clientKey() == null || req.clientKey().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "clientKey wajib diisi"));
        }
        Optional<ApiKeyService.Resolved> resolved = keys.resolve(req.clientKey());
        if (resolved.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "clientKey tidak dikenal"));
        }
        String method = blank(req.method()) ? "POST" : req.method().toUpperCase();
        String path = blank(req.path()) ? "/api/ingest/mirror" : req.path();
        String body = req.body() == null ? "" : req.body();
        String timestamp = OffsetDateTime.now(ZoneId.of("Asia/Jakarta")).format(ISO);

        String bodyHash = SnapSignature.bodyHashHex(body.getBytes(StandardCharsets.UTF_8));
        String stringToSign = SnapSignature.stringToSign(method, path, req.clientKey(), bodyHash, timestamp);
        String signature = SnapSignature.sign(resolved.get().secret(), stringToSign);

        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("X-CLIENT-KEY", req.clientKey());
        headers.put("X-TIMESTAMP", timestamp);
        headers.put("X-SIGNATURE", signature);
        headers.put("Content-Type", "application/json");

        return ResponseEntity.ok(new SignResult(timestamp, bodyHash, stringToSign, signature, headers));
    }

    private static boolean blank(String s) { return s == null || s.isBlank(); }

    public record SignRequest(String clientKey, String method, String path, String body) {}
    public record SignResult(String timestamp, String bodyHashHex, String stringToSign, String signature,
                             Map<String, String> headers) {}
}
