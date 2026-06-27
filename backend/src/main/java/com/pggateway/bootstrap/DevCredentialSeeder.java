package com.pggateway.bootstrap;

import com.pggateway.developer.ApiKeyService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Publishes fixed, well-known SANDBOX credentials for two demo PJPs so the SNAP signature flow can
 * be exercised end-to-end (curl, the smoke test, the Developer portal "try it") without first
 * creating a key. These are sandbox-only and intentionally public — never use a fixed secret in
 * production. Real integrators mint random keys via POST /api/dev/keys.
 *
 * Disable with pggateway.seed.enabled=false.
 */
@Component
@Order(0) // before SyntheticSeeder, purely cosmetic ordering for the startup log
@ConditionalOnProperty(name = "pggateway.seed.enabled", havingValue = "true", matchIfMissing = true)
public class DevCredentialSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DevCredentialSeeder.class);

    private final ApiKeyService keys;

    public DevCredentialSeeder(ApiKeyService keys) {
        this.keys = keys;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<String> scopes = List.of("ingest:write", "transactions:read", "alerts:read");
        keys.register("PJP Demo (sandbox)", "sandbox", scopes,
                "PJP-DEMO", "pgk_sandbox_DEMOKEY", "pgs_sandbox_DEMOSECRET");
        keys.register("PJP Beta (sandbox)", "sandbox", scopes,
                "PJP-BETA", "pgk_sandbox_BETAKEY", "pgs_sandbox_BETASECRET");
        log.info("Seeded SANDBOX credentials — PJP-DEMO: clientKey=pgk_sandbox_DEMOKEY "
                + "secret=pgs_sandbox_DEMOSECRET (demo only; sign ingest requests per SNAP HMAC).");
    }
}
