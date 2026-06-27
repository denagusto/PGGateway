package com.pggateway.developer;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ApiKeyServiceTest {

    @Test
    void create_returns_plaintext_once_and_verifies() {
        ApiKeyService svc = new ApiKeyService();
        var issued = svc.create("App PJP", "sandbox", List.of("ingest:write"));
        assertTrue(issued.apiKey().startsWith("pgk_sandbox_"));
        assertTrue(issued.secret().startsWith("pgs_"));
        assertEquals("active", issued.key().status());
        // the key authenticates
        assertTrue(svc.verify(issued.apiKey()).isPresent());
        // a wrong key does not
        assertTrue(svc.verify("pgk_sandbox_wrong").isEmpty());
    }

    @Test
    void list_never_exposes_secret() {
        ApiKeyService svc = new ApiKeyService();
        svc.create("k1", "production", null);
        ApiKey k = svc.list().get(0);
        assertEquals("production", k.env());
        assertTrue(k.prefix().startsWith("pgk_production_"));
        // ApiKey has no secret/hash accessor at all
        assertFalse(java.util.Arrays.stream(ApiKey.class.getRecordComponents())
                .anyMatch(c -> c.getName().toLowerCase().contains("secret")
                        || c.getName().toLowerCase().contains("hash")));
    }

    @Test
    void revoked_key_no_longer_verifies() {
        ApiKeyService svc = new ApiKeyService();
        var issued = svc.create("k", "sandbox", null);
        assertTrue(svc.revoke(issued.key().id()));
        assertTrue(svc.verify(issued.apiKey()).isEmpty());
    }
}
