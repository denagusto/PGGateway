package com.pggateway.developer;

import com.pggateway.audit.AuditService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Developer / integration API — backs the Developer Portal. Lets a tenant manage API keys and
 * verify that a key authenticates ("how PJP connect with us").
 */
@RestController
@RequestMapping("/api/dev")
public class DeveloperController {

    private final ApiKeyService keys;
    private final AuditService audit;

    public DeveloperController(ApiKeyService keys, AuditService audit) {
        this.keys = keys;
        this.audit = audit;
    }

    public record CreateKeyRequest(String name, String env, List<String> scopes) {}

    /** Create a key — response carries the plaintext key + secret shown ONCE. */
    @PostMapping("/keys")
    public ApiKeyService.IssuedKey create(@RequestBody CreateKeyRequest req) {
        ApiKeyService.IssuedKey issued = keys.create(req.name(), req.env(), req.scopes());
        audit.append("key.create", issued.key().id(),
                issued.key().name() + " (" + issued.key().env() + ")");
        return issued;
    }

    @GetMapping("/keys")
    public List<ApiKey> list() {
        return keys.list();
    }

    @DeleteMapping("/keys/{id}")
    public ResponseEntity<Void> revoke(@PathVariable String id) {
        boolean ok = keys.revoke(id);
        if (ok) audit.append("key.revoke", id, "");
        return ok ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    /**
     * Machine-readable SNAP signing guide for the portal / Swagger: the exact string-to-sign,
     * required headers, and the sandbox credentials an integrator can use to try it immediately.
     */
    @GetMapping("/snap-guide")
    public Map<String, Object> snapGuide() {
        Map<String, Object> sandbox = new LinkedHashMap<>();
        sandbox.put("clientKey", "pgk_sandbox_DEMOKEY");
        sandbox.put("clientSecret", "pgs_sandbox_DEMOSECRET");
        sandbox.put("tenantId", "PJP-DEMO");
        Map<String, Object> g = new LinkedHashMap<>();
        g.put("endpoint", "POST /api/ingest/mirror");
        g.put("headers", List.of("X-CLIENT-KEY", "X-TIMESTAMP (ISO-8601 + offset)", "X-SIGNATURE"));
        g.put("stringToSign", "{HTTP-METHOD}:{path}:{X-CLIENT-KEY}:{lowerHex(SHA-256(body))}:{X-TIMESTAMP}");
        g.put("signature", "Base64( HMAC-SHA512( stringToSign, clientSecret ) )");
        g.put("rules", List.of(
                "Timestamp wajib dalam rentang ±5 menit dari waktu server",
                "Tandatangani byte body persis seperti yang dikirim (body di-hash apa adanya)",
                "Setiap signature hanya boleh dipakai sekali — replay ditolak"));
        g.put("sandbox", sandbox);
        return g;
    }

    /** Demo of authenticated access: send your key as X-API-Key. */
    @GetMapping("/ping")
    public ResponseEntity<Map<String, Object>> ping(
            @RequestHeader(value = "X-API-Key", required = false) String apiKey) {
        return keys.verify(apiKey)
                .map(k -> ResponseEntity.ok(Map.<String, Object>of(
                        "ok", true, "tenantId", k.tenantId(), "name", k.name(),
                        "scopes", k.scopes(), "env", k.env())))
                .orElse(ResponseEntity.status(401).body(Map.of(
                        "ok", false, "error", "API key tidak valid atau dicabut")));
    }
}
