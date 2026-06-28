package com.pggateway.auth;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Dashboard users with roles + tenant scoping. Passwords are stored BCrypt-hashed (never plain).
 * In-memory + seeded for the demo; production swaps in an identity provider (OIDC) and a user DB.
 *
 * Roles: ADMIN (platform-wide), PJP (locked to one tenant), ANALYST (platform-wide, FDS focus).
 */
@Component
public class UserStore {

    private record Stored(AuthPrincipal who, String passwordHash) {}

    private final Map<String, Stored> users = new ConcurrentHashMap<>();
    private final PasswordEncoder encoder;

    public UserStore(PasswordEncoder encoder) {
        this.encoder = encoder;
        seed("admin", "admin123", "Administrator", "ADMIN", null);
        seed("demo", "demo123", "Operator PJP Demo", "PJP", "PJP-DEMO");
        seed("beta", "beta123", "Operator PJP Beta", "PJP", "PJP-BETA");
        seed("analyst", "analyst123", "Analis Fraud", "ANALYST", null);
    }

    private void seed(String user, String pass, String name, String role, String tenant) {
        users.put(user, new Stored(new AuthPrincipal(user, name, role, tenant), encoder.encode(pass)));
    }

    public Optional<AuthPrincipal> authenticate(String username, String password, PasswordEncoder enc) {
        Stored s = username == null ? null : users.get(username);
        if (s != null && enc.matches(password, s.passwordHash())) return Optional.of(s.who());
        return Optional.empty();
    }

    public List<AuthPrincipal> list() {
        return users.values().stream()
                .map(Stored::who)
                .sorted(Comparator.comparing(AuthPrincipal::username))
                .toList();
    }

    public boolean exists(String username) {
        return username != null && users.containsKey(username);
    }

    /** Create a dashboard user (platform admin onboarding a tenant operator). */
    public AuthPrincipal create(String username, String password, String displayName, String role, String tenantId) {
        AuthPrincipal who = new AuthPrincipal(username, displayName == null || displayName.isBlank() ? username : displayName,
                role, tenantId == null || tenantId.isBlank() ? null : tenantId);
        users.put(username, new Stored(who, encoder.encode(password)));
        return who;
    }
}
