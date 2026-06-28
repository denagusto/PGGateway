package com.pggateway.admin;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;

/**
 * Registry of PJP tenants — the source of truth for onboarding. The platform super-admin registers
 * new PJPs, sets their status, and the rest of the system scopes by these tenant ids. In-memory +
 * seeded for the demo; durable later (same Jdbc* pattern as rules/watchlist).
 */
@Component
public class TenantStore {

    public record Tenant(String id, String name, String status, String env, Instant createdAt) {
        public Tenant withStatus(String s) { return new Tenant(id, name, s, env, createdAt); }
    }

    private final Map<String, Tenant> tenants = new ConcurrentHashMap<>();

    public TenantStore() {
        seed("PJP-DEMO", "PT Dompet Cepat", "active", "production");
        seed("PJP-BETA", "PT Bayar Beta", "active", "sandbox");
    }

    private void seed(String id, String name, String status, String env) {
        tenants.put(id, new Tenant(id, name, status, env, Instant.EPOCH));
    }

    public List<Tenant> all() {
        return tenants.values().stream()
                .sorted(Comparator.comparing(Tenant::id))
                .toList();
    }

    public Optional<Tenant> get(String id) {
        return Optional.ofNullable(tenants.get(id));
    }

    public boolean exists(String id) {
        return id != null && tenants.containsKey(id);
    }

    /** Onboard a new PJP. Id is normalized to PJP-XXX uppercase. */
    public Tenant register(String id, String name, String env, Instant now) {
        String normId = id.trim().toUpperCase().replaceAll("[^A-Z0-9-]", "-");
        if (!normId.startsWith("PJP-")) normId = "PJP-" + normId;
        Tenant t = new Tenant(normId, name == null || name.isBlank() ? normId : name.trim(),
                "active", (env == null || env.isBlank()) ? "sandbox" : env, now);
        tenants.put(normId, t);
        return t;
    }

    public Optional<Tenant> setStatus(String id, String status) {
        Tenant t = tenants.get(id);
        if (t == null) return Optional.empty();
        Tenant updated = t.withStatus(status);
        tenants.put(id, updated);
        return Optional.of(updated);
    }
}
