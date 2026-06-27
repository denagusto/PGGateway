package com.pggateway.developer;

import java.time.Instant;
import java.util.List;

/**
 * A tenant API credential (metadata only — the secret is never stored in plaintext, only its
 * hash, kept in {@link ApiKeyService}). Safe to serialize to the portal: shows the prefix, not
 * the full key.
 */
public record ApiKey(
        String id,
        String tenantId,
        String name,
        String prefix,        // e.g. "pgk_sandbox_AbC1" (display only)
        List<String> scopes,
        String env,           // "sandbox" | "production"
        String status,        // "active" | "revoked"
        Instant createdAt,
        Instant lastUsedAt
) {
    public ApiKey withStatus(String s) {
        return new ApiKey(id, tenantId, name, prefix, scopes, env, s, createdAt, lastUsedAt);
    }

    public ApiKey withLastUsed(Instant t) {
        return new ApiKey(id, tenantId, name, prefix, scopes, env, status, createdAt, t);
    }
}
