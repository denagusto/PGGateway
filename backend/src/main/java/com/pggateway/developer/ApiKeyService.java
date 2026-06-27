package com.pggateway.developer;

import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Issues, lists, revokes and verifies tenant API keys. The full key and secret are shown to
 * the integrator EXACTLY ONCE at creation; only the SHA-256 hash of the key is stored, so a
 * leaked store can't reveal credentials. In-memory now; later CockroachDB.
 *
 * Single-tenant demo (tenantId fixed). Multi-tenant scoping + HMAC request signing is the
 * next step (see docs/developer-integration-plan.md).
 */
@Service
public class ApiKeyService {

    private static final String TENANT = "tenant-demo";
    private static final List<String> DEFAULT_SCOPES =
            List.of("ingest:write", "transactions:read", "alerts:read");

    private final Map<String, ApiKey> byId = new ConcurrentHashMap<>();
    private final Map<String, String> idByHash = new ConcurrentHashMap<>(); // sha256(key) -> keyId
    private final SecureRandom rnd = new SecureRandom();

    public IssuedKey create(String name, String env, List<String> scopes) {
        String e = (env == null || env.isBlank()) ? "sandbox" : env;
        String apiKey = "pgk_" + e + "_" + token(24);
        String secret = "pgs_" + token(32);
        String id = UUID.randomUUID().toString();
        String prefix = apiKey.substring(0, Math.min(16, apiKey.length()));
        ApiKey k = new ApiKey(id, TENANT,
                name == null ? "" : name, prefix,
                (scopes == null || scopes.isEmpty()) ? DEFAULT_SCOPES : scopes,
                e, "active", Instant.now(), null);
        byId.put(id, k);
        idByHash.put(sha256(apiKey), id);
        return new IssuedKey(k, apiKey, secret);
    }

    public List<ApiKey> list() {
        return byId.values().stream()
                .sorted(Comparator.comparing(ApiKey::createdAt).reversed())
                .toList();
    }

    public boolean revoke(String id) {
        ApiKey k = byId.get(id);
        if (k == null) return false;
        byId.put(id, k.withStatus("revoked"));
        return true;
    }

    /** Verify an incoming X-API-Key. Updates lastUsedAt on success. */
    public Optional<ApiKey> verify(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) return Optional.empty();
        String id = idByHash.get(sha256(apiKey));
        if (id == null) return Optional.empty();
        ApiKey k = byId.get(id);
        if (k == null || !"active".equals(k.status())) return Optional.empty();
        ApiKey used = k.withLastUsed(Instant.now());
        byId.put(id, used);
        return Optional.of(used);
    }

    private String token(int n) {
        byte[] b = new byte[n];
        rnd.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    private static String sha256(String s) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(h.length * 2);
            for (byte x : h) sb.append(String.format("%02x", x));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** Returned ONCE at creation. The plaintext key+secret are never persisted. */
    public record IssuedKey(ApiKey key, String apiKey, String secret) {}
}
